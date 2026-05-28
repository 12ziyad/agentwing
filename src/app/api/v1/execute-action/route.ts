import {
  createExecutionRun,
  createRunnerApprovalPayload,
  parseAgentActionBody,
  parseRuntimeApprovalRequest,
} from "@/lib/actionRunLifecycle";
import {
  getSandboxConfig,
  incrementActionCheckUsage,
  sandboxOwnerKeyForWorkspace,
  trackEvent,
  unauthorizedResponse,
  validateApiKeyFromRequest,
} from "@/lib/agentwingStore";
import { actionCheckLimitExceeded, actionCheckLimitResponse } from "@/lib/rateLimit";
import { actionTypes } from "@/lib/agentwingTypes";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const auth = await validateApiKeyFromRequest(request);
  if (!auth) {
    await trackEvent("api_401", { metadata: { path: "/api/v1/execute-action" } });
    return unauthorizedResponse();
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const action = parseAgentActionBody(body, auth.projectId);
  if (!action) {
    return Response.json(
      {
        error: "Invalid AgentAction body.",
        expectedActionTypes: actionTypes,
      },
      { status: 400 },
    );
  }

  const usage = await incrementActionCheckUsage(auth.apiKeyId);
  if (actionCheckLimitExceeded(usage)) {
    await trackEvent("execute_action_called", {
      workspaceId: auth.workspaceId,
      metadata: { apiKeyId: auth.apiKeyId, limitExceeded: true },
    });
    return actionCheckLimitResponse(usage);
  }

  const run = await createExecutionRun(action, auth);
  const runtime = parseRuntimeApprovalRequest(body);
  const origin = new URL(request.url).origin;
  const approval =
    run.decision === "approval_required" &&
    run.status === "waiting_approval" &&
    runtime?.interactiveApproval &&
    runtime.surface
      ? await createRunnerApprovalPayload({
          run,
          origin,
          surface: runtime.surface,
          runnerId: runtime.runnerId,
        })
      : undefined;

  const sandboxConfig =
    run.decision === "sandbox_required" && run.status === "waiting_sandbox"
      ? await getSandboxConfig(auth.workspaceId ? sandboxOwnerKeyForWorkspace(auth.workspaceId) : auth.apiKeyId)
      : undefined;
  const sandbox =
    sandboxConfig
      ? {
          required: true,
          provider: "e2b-byok",
          connected: Boolean(sandboxConfig.connected && sandboxConfig.lastTestStatus !== "failed"),
          connectUrl: `${origin}/dashboard/sandboxes`,
        }
      : undefined;

  await trackEvent("execute_action_called", {
    workspaceId: auth.workspaceId,
    projectId: auth.projectId,
    metadata: {
      apiKeyId: auth.apiKeyId,
      runId: run.runId,
      receiptId: run.receiptId,
      decision: run.decision,
      status: run.status,
      risk: run.risk,
      actionType: action.actionType,
    },
  });

  return Response.json({
    run,
    runId: run.runId,
    receiptId: run.receiptId,
    approvalId: run.approvalId,
    decision: run.decision,
    risk: run.risk,
    policy: run.policy,
    status: run.status,
    nextStep: approval
      ? "Human approval required. Approve in the dashboard or through the interactive runner before continuing."
      : sandbox
      ? "This action requires sandbox execution. Connect E2B or another sandbox runner before continuing."
      : run.nextStep,
    ...(approval ? { approval } : {}),
    ...(sandbox ? { sandbox } : {}),
  });
}
