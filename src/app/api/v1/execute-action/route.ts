import {
  createExecutionRun,
  createApprovalHandoff,
  parseAgentActionBody,
  parseRuntimeApprovalRequest,
} from "@/lib/actionRunLifecycle";
import {
  getSandboxConfig,
  incrementActionCheckUsage,
  PolicyStoreUnavailableError,
  sandboxOwnerKeyForWorkspace,
  trackEvent,
  unauthorizedResponse,
  validateApiKeyFromRequest,
} from "@/lib/agentwingStore";
import { actionCheckLimitExceeded, actionCheckLimitResponse } from "@/lib/rateLimit";
import { actionTypes } from "@/lib/agentwingTypes";
import { getAgentWingD1 } from "@/lib/cloudflareD1";
import {
  findReplay,
  IdempotencyConflictError,
  readIdempotencyKey,
  rememberResponse,
  requestFingerprint,
} from "@/lib/idempotency";
import { withRoute } from "@/lib/withRoute";

export const runtime = "nodejs";

async function handlePOST(request: Request) {
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

  // Idempotency. A retried execute-action would otherwise create a second run
  // AND a second receipt for one real intent, which does not merely waste quota
  // -- it makes the audit trail show two attempts where there was one.
  const idempotencyKey = readIdempotencyKey(request);
  const db = idempotencyKey ? await getAgentWingD1() : undefined;
  let fingerprint: string | undefined;

  if (idempotencyKey && db) {
    fingerprint = await requestFingerprint("POST", "/api/v1/execute-action", body);
    try {
      const replay = await findReplay(db, auth.workspaceId, idempotencyKey, fingerprint);
      if (replay) {
        return Response.json(replay.body as Record<string, unknown>, {
          status: replay.status,
          headers: { "idempotent-replay": "true" },
        });
      }
    } catch (error) {
      if (error instanceof IdempotencyConflictError) {
        return Response.json({ error: error.message, code: error.code }, { status: error.status });
      }
      throw error;
    }
  }

  const usage = await incrementActionCheckUsage(auth.apiKeyId);
  if (actionCheckLimitExceeded(usage)) {
    await trackEvent("execute_action_called", {
      workspaceId: auth.workspaceId,
      metadata: { apiKeyId: auth.apiKeyId, limitExceeded: true },
    });
    return actionCheckLimitResponse(usage);
  }

  let run;
  try {
    run = await createExecutionRun(action, auth);
  } catch (error) {
    // Fail closed. Without the workspace's policies we cannot know whether this
    // action is allowed, and deciding from defaults alone could permit
    // something the workspace explicitly blocks.
    if (error instanceof PolicyStoreUnavailableError) {
      return Response.json(
        { error: error.message, code: error.code },
        { status: error.status, headers: { "retry-after": "5" } },
      );
    }
    throw error;
  }
  const runtime = parseRuntimeApprovalRequest(body);
  const origin = new URL(request.url).origin;
  const approval =
    run.decision === "approval_required" &&
    run.status === "waiting_approval" &&
    runtime?.interactiveApproval &&
    runtime.surface
      ? await createApprovalHandoff({
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

  const responseBody: Record<string, unknown> = {
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
  };

  // Remember the response so a retry replays it rather than creating a second
  // run. Best-effort: the run already exists and returning it matters more than
  // recording the key.
  if (idempotencyKey && db && fingerprint) {
    try {
      await rememberResponse(db, auth.workspaceId, idempotencyKey, fingerprint, { status: 200, body: responseBody });
    } catch {
      // intentional: failing to record the key must not fail the request.
    }
  }

  return Response.json(responseBody);
}

export const POST = withRoute("v1/execute-action", handlePOST);
