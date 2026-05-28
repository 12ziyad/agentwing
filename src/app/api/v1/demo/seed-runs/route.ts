import {
  evaluateActionPolicy,
  nextStepForDecision,
} from "@/lib/actionRunLifecycle";
import {
  appendExecutionEvent,
  createActionRun,
  createApproval,
  createReceipt,
  trackEvent,
} from "@/lib/agentwingStore";
import { authRequiredResponse, getDashboardAuth } from "@/lib/auth";
import type { ActionRunStatus, AgentAction, ExecutionTarget } from "@/lib/agentwingTypes";

export const runtime = "nodejs";

const demoActions: AgentAction[] = [
  { actionType: "file_access", tool: "filesystem", target: "package.json", description: "Read package manifest.", metadata: { operation: "read" } },
  { actionType: "file_access", tool: "filesystem", target: ".env", description: "Read environment secrets.", metadata: { operation: "read" } },
  { actionType: "shell_command", tool: "terminal", command: "rm -rf /", description: "Destructive cleanup." },
  { actionType: "package_install", tool: "npm", target: "lodash", command: "npm install lodash", description: "Install a package." },
  { actionType: "deploy_action", tool: "deploy", target: "production", description: "Deploy current build to production." },
  { actionType: "message_send", tool: "email", target: "external-customer", description: "Send an external email.", metadata: { external: true, channel: "email" } },
  { actionType: "file_access", tool: "filesystem", target: "src/auth.ts", description: "Edit auth middleware.", metadata: { operation: "write" } },
  { actionType: "config_change", tool: "filesystem", target: "wrangler.toml", description: "Change deployment configuration." },
  { actionType: "database_query", tool: "database", command: "SELECT * FROM audit_log LIMIT 10", description: "Read audit rows." },
  { actionType: "database_operation", tool: "database", command: "UPDATE users SET plan = 'pro' WHERE id = 'sample'", description: "Mutate database row." },
];

function runState(decision: string): { status: ActionRunStatus; executionTarget: ExecutionTarget; completedAt?: string } {
  const now = new Date().toISOString();
  switch (decision) {
    case "block":
      return { status: "blocked", executionTarget: "skipped", completedAt: now };
    case "approval_required":
      return { status: "waiting_approval", executionTarget: "none" };
    case "sandbox_required":
      return { status: "waiting_sandbox", executionTarget: "sandbox" };
    case "restore_point_required":
      return { status: "restore_point_required", executionTarget: "external_runner" };
    default:
      return { status: "execution_skipped", executionTarget: "skipped", completedAt: now };
  }
}

export async function POST(request: Request) {
  const auth = await getDashboardAuth(request);
  if (!auth) return authRequiredResponse();
  if (process.env.NODE_ENV === "production" && auth.mode !== "admin") {
    return Response.json({ error: "Demo seeding is admin-only in production." }, { status: 403 });
  }
  if (!auth.workspaceId) {
    return Response.json({ error: "Seed a signed-in workspace, not global admin mode." }, { status: 400 });
  }

  const sessionId = `demo-seed-${Date.now()}`;
  const runs = [];

  for (const action of demoActions) {
    const seededAction = {
      ...action,
      sessionId,
      agentId: "product-hunt-demo-agent",
    };
    const evaluation = await evaluateActionPolicy(seededAction, auth.workspaceId, seededAction.projectId);
    const receipt = await createReceipt(seededAction, evaluation, undefined, auth.workspaceId);

    let approvalId: string | undefined;
    if (evaluation.decision === "approval_required") {
      const approval = await createApproval({
        workspaceId: auth.workspaceId,
        receiptId: receipt.receiptId,
        action: seededAction,
        decision: evaluation.decision,
        risk: evaluation.risk,
        policy: evaluation.policy,
        reason: evaluation.feedback,
        requestedByAgent: seededAction.agentId,
      });
      approvalId = approval.approvalId;
    }

    const state = runState(evaluation.decision);
    const run = await createActionRun({
      workspaceId: auth.workspaceId,
      receiptId: receipt.receiptId,
      approvalId,
      action: seededAction,
      evaluation,
      nextStep: nextStepForDecision(evaluation.decision, evaluation.risk),
      status: state.status,
      executionTarget: state.executionTarget,
      completedAt: state.completedAt,
    });

    await appendExecutionEvent(run.runId, "agent_proposed_action", "Demo agent proposed an action.", { seed: true });
    await appendExecutionEvent(run.runId, "policy_checked", "AgentWing evaluated policy.", { seed: true, policy: run.policy });
    await appendExecutionEvent(run.runId, "decision_returned", `Decision returned: ${run.decision}.`, { seed: true, decision: run.decision });
    if (run.status === "blocked") {
      await appendExecutionEvent(run.runId, "execution_skipped", "Blocked demo action was not executed.", { seed: true });
    } else if (run.status === "waiting_sandbox") {
      await appendExecutionEvent(run.runId, "waiting_sandbox", "Demo action is waiting for E2B sandbox connection.", { seed: true });
    } else if (run.status === "waiting_approval") {
      await appendExecutionEvent(run.runId, "approval_requested", "Demo action is waiting for human approval.", { seed: true });
    } else if (run.status === "restore_point_required") {
      await appendExecutionEvent(run.runId, "checkpoint_required", "Demo action requires a restore point.", { seed: true });
    } else {
      await appendExecutionEvent(run.runId, "execution_skipped", "Safe demo action was policy-cleared without hosted execution.", { seed: true });
    }

    runs.push(run);
  }

  await trackEvent("demo_runs_seeded", {
    workspaceId: auth.workspaceId,
    userId: auth.mode === "user" ? auth.user.userId : undefined,
    metadata: { count: runs.length },
  });

  return Response.json({ ok: true, runs });
}
