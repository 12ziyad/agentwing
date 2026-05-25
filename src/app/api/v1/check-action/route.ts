import { evaluateAgentAction } from "@/lib/agentwingPolicy";
import {
  createReceipt,
  incrementActionCheckUsage,
  unauthorizedResponse,
  validateApiKeyFromRequest,
} from "@/lib/agentwingStore";
import { actionCheckLimitExceeded, actionCheckLimitResponse } from "@/lib/rateLimit";
import { actionTypes, type AgentAction, type PolicyEvaluation } from "@/lib/agentwingTypes";

export const runtime = "nodejs";

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function parseAction(body: unknown): AgentAction | undefined {
  if (!isRecord(body)) return undefined;
  if (typeof body.actionType !== "string" || !actionTypes.includes(body.actionType as AgentAction["actionType"])) {
    return undefined;
  }

  return {
    projectId: typeof body.projectId === "string" ? body.projectId : undefined,
    sessionId: typeof body.sessionId === "string" ? body.sessionId : undefined,
    agentId: typeof body.agentId === "string" ? body.agentId : undefined,
    actionType: body.actionType as AgentAction["actionType"],
    tool: typeof body.tool === "string" ? body.tool : undefined,
    target: typeof body.target === "string" ? body.target : undefined,
    command: typeof body.command === "string" ? body.command : undefined,
    description: typeof body.description === "string" ? body.description : undefined,
    metadata: isRecord(body.metadata) ? body.metadata : undefined,
  };
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

  const parsedAction = parseAction(body);
  const action = parsedAction && auth.projectId ? { ...parsedAction, projectId: auth.projectId } : parsedAction;
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
    return actionCheckLimitResponse(usage);
  }

  const evaluation: PolicyEvaluation =
    evaluateAgentAction(action);
  const receipt = await createReceipt(action, evaluation, auth.apiKeyId, auth.workspaceId);

  return Response.json({
    decision: evaluation.decision,
    risk: evaluation.risk,
    policy: evaluation.policy,
    feedback: evaluation.feedback,
    receiptId: receipt.receiptId,
  });
}
