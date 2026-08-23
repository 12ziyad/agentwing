import { evaluateActionPolicy, nextStepForDecision } from "@/lib/actionRunLifecycle";
import {
  createApproval,
  createReceipt,
  incrementActionCheckUsage,
  PolicyStoreUnavailableError,
  trackEvent,
  unauthorizedResponse,
  validateApiKeyFromRequest,
} from "@/lib/agentwingStore";
import { actionCheckLimitExceeded, actionCheckLimitResponse } from "@/lib/rateLimit";
import { actionTypes, type AgentAction, type PolicyEvaluation } from "@/lib/agentwingTypes";

export const runtime = "nodejs";

const MAX_COMMAND_LENGTH = 2000;
const MAX_TARGET_LENGTH = 1000;
const MAX_DESCRIPTION_LENGTH = 2000;

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function safeString(value: unknown, maxLength: number): string | undefined {
  if (typeof value !== "string") return undefined;
  return value.slice(0, maxLength);
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
    tool: safeString(body.tool, 200),
    target: safeString(body.target, MAX_TARGET_LENGTH),
    command: safeString(body.command, MAX_COMMAND_LENGTH),
    description: safeString(body.description, MAX_DESCRIPTION_LENGTH),
    metadata: isRecord(body.metadata) ? body.metadata : undefined,
  };
}

export async function POST(request: Request) {
  const auth = await validateApiKeyFromRequest(request);
  if (!auth) {
    await trackEvent("api_401", { metadata: { path: "/api/v1/check-action" } });
    return unauthorizedResponse();
  }

  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  if (!isRecord(body)) {
    return Response.json({ error: "Request body must be a JSON object." }, { status: 400 });
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
    await trackEvent("check_action_called", {
      workspaceId: auth.workspaceId,
      metadata: { apiKeyId: auth.apiKeyId, limitExceeded: true },
    });
    return actionCheckLimitResponse(usage);
  }

  // One composition implementation, shared with /execute-action. This route
  // used to carry its own copy, so a change to how custom policies layer over
  // defaults could apply to one endpoint and not the other.
  let evaluation: PolicyEvaluation;
  try {
    evaluation = await evaluateActionPolicy(action, auth.workspaceId, auth.projectId);
  } catch (error) {
    if (error instanceof PolicyStoreUnavailableError) {
      // Fail closed: without the workspace's policies we cannot know whether
      // this action is allowed, and answering from defaults alone could permit
      // something the workspace blocks.
      return Response.json(
        { error: error.message, code: error.code },
        { status: error.status, headers: { "retry-after": "5" } },
      );
    }
    throw error;
  }

  const receipt = await createReceipt(action, evaluation, auth.apiKeyId, auth.workspaceId);

  // Create approval record when human review is needed
  let approvalId: string | undefined;
  if (evaluation.decision === "approval_required" && auth.workspaceId) {
    try {
      const approval = await createApproval({
        workspaceId: auth.workspaceId,
        projectId: auth.projectId,
        receiptId: receipt.receiptId,
        action,
        decision: evaluation.decision,
        risk: evaluation.risk,
        policy: evaluation.policy,
        reason: evaluation.feedback,
        requestedByAgent: action.agentId,
      });
      approvalId = approval.approvalId;
      await trackEvent("approval_created", {
        workspaceId: auth.workspaceId,
        projectId: auth.projectId,
        metadata: { approvalId, receiptId: receipt.receiptId },
      });
    } catch {
      // non-fatal
    }
  }

  await trackEvent("check_action_called", {
    workspaceId: auth.workspaceId,
    projectId: auth.projectId,
    metadata: {
      apiKeyId: auth.apiKeyId,
      decision: evaluation.decision,
      risk: evaluation.risk,
      actionType: action.actionType,
    },
  });

  return Response.json({
    decision: evaluation.decision,
    risk: evaluation.risk,
    policy: evaluation.policy,
    feedback: evaluation.feedback,
    receiptId: receipt.receiptId,
    nextStep: nextStepForDecision(evaluation.decision, evaluation.risk),
    ...(approvalId ? { approvalId } : {}),
  });
}
