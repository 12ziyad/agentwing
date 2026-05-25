import { evaluateAgentAction } from "@/lib/agentwingPolicy";
import {
  createReceipt,
  getE2BApiKeyForExecution,
  incrementSandboxRunUsage,
  unauthorizedResponse,
  validateApiKeyFromRequest,
} from "@/lib/agentwingStore";
import { sandboxRunLimitExceeded, sandboxRunLimitResponse } from "@/lib/rateLimit";
import { actionTypes, type AgentAction, type PolicyEvaluation } from "@/lib/agentwingTypes";
import { runE2BSandbox } from "@/lib/sandbox/providers/e2b";

export const runtime = "nodejs";

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function stringField(record: Record<string, unknown>, key: string) {
  const value = record[key];
  return typeof value === "string" ? value : undefined;
}

function parseSandboxAction(body: unknown, projectId?: string): AgentAction | undefined {
  if (!isRecord(body)) return undefined;

  const actionBody = isRecord(body.action) ? body.action : body;
  const actionType = stringField(actionBody, "actionType");
  if (!actionType || !actionTypes.includes(actionType as AgentAction["actionType"])) return undefined;

  return {
    projectId: projectId ?? stringField(actionBody, "projectId") ?? stringField(body, "projectId"),
    sessionId: stringField(actionBody, "sessionId") ?? stringField(body, "sessionId"),
    agentId: stringField(actionBody, "agentId") ?? stringField(body, "agentId"),
    actionType: actionType as AgentAction["actionType"],
    tool: stringField(actionBody, "tool"),
    target: stringField(actionBody, "target"),
    command: stringField(actionBody, "command"),
    description: stringField(actionBody, "description"),
    metadata: isRecord(actionBody.metadata) ? actionBody.metadata : undefined,
  };
}

async function receiptForSandboxFailure(
  action: AgentAction,
  evaluation: PolicyEvaluation,
  apiKeyId: string,
  feedback: string,
  error: string,
  workspaceId?: string,
  status = 502,
) {
  const receipt = await createReceipt(
    action,
    {
      ...evaluation,
      decision: evaluation.decision === "block" ? "block" : "sandbox_required",
      provider: "e2b-byok",
      mode: "error",
      feedback,
      stdout: "",
      stderr: "",
      exitCode: 1,
      durationMs: 0,
      error,
    },
    apiKeyId,
    workspaceId,
  );

  return Response.json(
    {
      ok: false,
      provider: "e2b-byok",
      mode: "error",
      receiptId: receipt.receiptId,
      stdout: "",
      stderr: "",
      exitCode: 1,
      durationMs: 0,
      error,
      decision: receipt.decision,
      risk: receipt.risk,
      policy: receipt.policy,
      feedback: receipt.feedback,
    },
    { status },
  );
}

export async function POST(request: Request) {
  const auth = await validateApiKeyFromRequest(request);
  if (!auth) return unauthorizedResponse();

  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const action = parseSandboxAction(body, auth.projectId);
  if (!action) {
    return Response.json({ error: "Sandbox run requires a valid AgentAction." }, { status: 400 });
  }

  if (action.actionType !== "shell_command" || !action.command?.trim()) {
    return Response.json({ error: "Sandbox run currently requires a shell_command action with command." }, { status: 400 });
  }

  const usage = await incrementSandboxRunUsage(auth.apiKeyId);
  if (sandboxRunLimitExceeded(usage)) {
    return sandboxRunLimitResponse(usage);
  }

  const evaluation = evaluateAgentAction(action);
  if (evaluation.decision === "block") {
    return receiptForSandboxFailure(
      action,
      evaluation,
      auth.apiKeyId,
      evaluation.feedback,
      "AgentWing policy blocked this action before sandbox execution.",
      auth.workspaceId,
      403,
    );
  }

  const e2bApiKey = await getE2BApiKeyForExecution(auth.apiKeyId, auth.workspaceId);
  if (!e2bApiKey) {
    return receiptForSandboxFailure(
      action,
      evaluation,
      auth.apiKeyId,
      "No E2B BYOK key is available server-side for sandbox execution.",
      "Save an E2B BYOK key in AgentWing or set E2B_API_KEY on the backend.",
      auth.workspaceId,
      400,
    );
  }

  try {
    const result = await runE2BSandbox({
      apiKey: e2bApiKey,
      command: action.command.trim(),
      action,
      projectId: action.projectId,
      sessionId: action.sessionId,
    });

    const receipt = await createReceipt(
      action,
      {
        ...evaluation,
        decision: "sandbox_required",
        provider: "e2b-byok",
        mode: "real-e2b",
        feedback:
          result.exitCode === 0
            ? "Sandbox run completed in E2B."
            : "Sandbox run completed in E2B with a non-zero exit code.",
        stdout: result.stdout,
        stderr: result.stderr,
        exitCode: result.exitCode,
        durationMs: result.durationMs,
        error: result.error,
      },
      auth.apiKeyId,
      auth.workspaceId,
    );

    return Response.json({
      ok: result.exitCode === 0 && !result.error,
      provider: "e2b-byok",
      mode: "real-e2b",
      receiptId: receipt.receiptId,
      stdout: result.stdout,
      stderr: result.stderr,
      exitCode: result.exitCode,
      durationMs: result.durationMs,
      sandboxId: result.sandboxId,
      error: result.error,
      decision: receipt.decision,
      risk: receipt.risk,
      policy: receipt.policy,
      feedback: receipt.feedback,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "E2B sandbox execution failed.";
    return receiptForSandboxFailure(
      action,
      evaluation,
      auth.apiKeyId,
      "E2B sandbox execution failed before the command completed.",
      message,
      auth.workspaceId,
    );
  }
}
