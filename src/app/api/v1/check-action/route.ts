import { evaluateAgentAction } from "@/lib/agentwingPolicy";
import {
  createApproval,
  createReceipt,
  incrementActionCheckUsage,
  matchCustomPolicy,
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

function nextStepForDecision(decision: string, risk: string): string {
  switch (decision) {
    case "allow":
      return "Action cleared. Proceed with execution.";
    case "block":
      return risk === "critical" || risk === "high"
        ? "Stop this action immediately and re-plan without attempting this operation."
        : "Do not execute this action. Re-plan using a safer alternative.";
    case "approval_required":
      return "Pause execution. Wait for a human to approve or reject this action in the AgentWing dashboard before continuing.";
    case "sandbox_required":
      return "Do not execute in the main environment. Route this action through the connected sandbox first. Check the sandbox result before proceeding.";
    case "restore_point_required":
      return "Create a checkpoint or restore point of current state before executing. Verify the restore point exists, then proceed.";
    default:
      return "Review the decision before proceeding.";
  }
}

function isMandatoryDefaultBlock(evaluation: PolicyEvaluation) {
  return (
    evaluation.decision === "block" &&
    (evaluation.risk === "critical" || evaluation.policy === "block-secret-file-access")
  );
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

  let evaluation: PolicyEvaluation;
  const defaultEvaluation = evaluateAgentAction(action);

  if (isMandatoryDefaultBlock(defaultEvaluation)) {
    evaluation = defaultEvaluation;
  } else if (auth.workspaceId) {
    const customMatch = await matchCustomPolicy(action, auth.workspaceId, auth.projectId);
    if (customMatch) {
      evaluation = {
        decision: customMatch.decision,
        risk: customMatch.risk,
        policy: `custom:${customMatch.policyId}:${customMatch.name}`,
        feedback: customMatch.feedback ?? `Custom policy "${customMatch.name}" matched.`,
      };
      await trackEvent("custom_policy_matched", {
        workspaceId: auth.workspaceId,
        projectId: auth.projectId,
        metadata: { policyId: customMatch.policyId, decision: customMatch.decision },
      });
    } else {
      evaluation = defaultEvaluation;
    }
  } else {
    evaluation = defaultEvaluation;
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
