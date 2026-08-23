import { evaluateAgentAction } from "@/lib/agentwingPolicy";
import {
  appendExecutionEvent,
  continueActionRunAfterApproval,
  createActionRun,
  createApproval,
  createReceipt,
  getActionRun,
  getE2BApiKeyForExecution,
  incrementSandboxRunUsage,
  matchCustomPolicy,
  trackEvent,
  updateActionRun,
  updateReceiptExecutionResult,
} from "@/lib/agentwingStore";
import { sandboxRunLimitExceeded } from "@/lib/rateLimit";
import { redactLog } from "@/lib/redact";
import { getAgentWingD1 } from "@/lib/cloudflareD1";
import { emitEvent } from "@/lib/webhookStore";
import { runE2BSandbox } from "@/lib/sandbox/providers/e2b";
import {
  actionTypes,
  type ActionRun,
  type ActionRunStatus,
  type AgentAction,
  type ExecutionTarget,
  type PolicyEvaluation,
} from "@/lib/agentwingTypes";

const MAX_COMMAND_LENGTH = 2000;
const MAX_TARGET_LENGTH = 1000;
const MAX_DESCRIPTION_LENGTH = 2000;
const TERMINAL_STATUSES = new Set<ActionRunStatus>([
  "blocked",
  "rejected",
  "completed",
  "failed",
  "execution_skipped",
  "external_runner_required",
]);

/**
 * The only statuses from which an external runner may report that it executed.
 *
 * Every other status means execution was never authorised -- the run was
 * blocked, rejected, is still waiting on a gate, or has already finished.
 */
const CAN_REPORT_EXECUTION = new Set<ActionRunStatus>([
  "approved",
  "checkpoint_created",
  "external_runner_required",
  "restore_point_required",
]);

/**
 * An illegal state transition, distinguished from a missing run so routes can
 * answer 409 rather than 404. The `code` is stable and documented for clients.
 */
export class RunTransitionError extends Error {
  readonly code: string;
  readonly status = 409;

  constructor(message: string, code: string) {
    super(message);
    this.name = "RunTransitionError";
    this.code = code;
  }
}

/**
 * The authenticated caller behind a run.
 *
 * `workspaceId` is required. It used to be optional and fall back to a shared
 * demo workspace, which meant an unscoped caller silently wrote into -- and
 * read from -- a tenant that was not theirs.
 */
export type RunAuthContext = {
  apiKeyId: string;
  workspaceId: string;
  projectId?: string;
};

export type RuntimeApprovalRequest = {
  surface?: "cli" | "ide" | "web" | "webhook";
  interactiveApproval?: boolean;
  runnerId?: string;
};

type ContinueBody = {
  restorePointCreated?: boolean;
  executionTarget?: ExecutionTarget;
  executionResult?: {
    stdout?: string;
    stderr?: string;
    exitCode?: number;
    durationMs?: number;
    error?: string;
  };
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function safeString(value: unknown, maxLength: number): string | undefined {
  if (typeof value !== "string") return undefined;
  return value.slice(0, maxLength);
}

export function parseAgentActionBody(body: unknown, projectId?: string): AgentAction | undefined {
  if (!isRecord(body)) return undefined;

  const actionBody = isRecord(body.action) ? body.action : body;
  const actionType = typeof actionBody.actionType === "string" ? actionBody.actionType : undefined;
  if (!actionType || !actionTypes.includes(actionType as AgentAction["actionType"])) return undefined;

  return {
    projectId: projectId ?? safeString(actionBody.projectId, 200) ?? safeString(body.projectId, 200),
    sessionId: safeString(actionBody.sessionId, 200) ?? safeString(body.sessionId, 200),
    agentId: safeString(actionBody.agentId, 200) ?? safeString(body.agentId, 200),
    actionType: actionType as AgentAction["actionType"],
    tool: safeString(actionBody.tool, 200),
    target: safeString(actionBody.target, MAX_TARGET_LENGTH),
    command: safeString(actionBody.command, MAX_COMMAND_LENGTH),
    description: safeString(actionBody.description, MAX_DESCRIPTION_LENGTH),
    metadata: isRecord(actionBody.metadata) ? actionBody.metadata : undefined,
  };
}

export function parseRuntimeApprovalRequest(body: unknown): RuntimeApprovalRequest | undefined {
  if (!isRecord(body) || !isRecord(body.runtime)) return undefined;
  const surface = body.runtime.surface;
  const runnerId = body.runtime.runnerId;
  return {
    surface: surface === "cli" || surface === "ide" || surface === "web" || surface === "webhook" ? surface : undefined,
    interactiveApproval: body.runtime.interactiveApproval === true,
    runnerId: typeof runnerId === "string" ? runnerId.slice(0, 120) : undefined,
  };
}

export function nextStepForDecision(decision: string, risk: string): string {
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
      return "Create and verify a checkpoint or restore point before any external runner continues.";
    default:
      return "Review the decision before continuing.";
  }
}

export function isMandatoryDefaultBlock(evaluation: PolicyEvaluation) {
  return (
    evaluation.decision === "block" &&
    (evaluation.risk === "critical" ||
      [
        "block-secret-file-access",
        "block-destructive-shell-command",
        "block-force-push",
        "block-destructive-database-query",
        "block-destructive-database-operation",
      ].includes(evaluation.policy))
  );
}

export async function evaluateActionPolicy(
  action: AgentAction,
  workspaceId?: string,
  projectId?: string,
): Promise<PolicyEvaluation> {
  const defaultEvaluation = evaluateAgentAction(action);

  if (isMandatoryDefaultBlock(defaultEvaluation)) {
    return defaultEvaluation;
  }

  if (workspaceId) {
    const customMatch = await matchCustomPolicy(action, workspaceId, projectId);
    if (customMatch) {
      await trackEvent("custom_policy_matched", {
        workspaceId,
        projectId,
        metadata: { policyId: customMatch.policyId, decision: customMatch.decision },
      });
      return {
        decision: customMatch.decision,
        risk: customMatch.risk,
        policy: `custom:${customMatch.policyId}:${customMatch.name}`,
        feedback: customMatch.feedback ?? `Custom policy "${customMatch.name}" matched.`,
      };
    }
  }

  return defaultEvaluation;
}

function runWorkspaceId(auth: RunAuthContext) {
  return auth.workspaceId;
}

function nowIso() {
  return new Date().toISOString();
}


function actionLabel(action: AgentAction) {
  return action.command || action.target || action.description || action.actionType;
}

function commandForSandbox(action: AgentAction) {
  const command = action.command?.trim();
  if (command) return command;

  const target = action.target?.trim();
  if (!target) return undefined;
  if (action.actionType === "package_install") {
    if (/^(npm|pnpm|yarn|bun)\s+/.test(target)) return target;
    if (/^(@?[a-z0-9._-]+\/)?[a-z0-9._-]+$/i.test(target)) return `npm install ${target}`;
  }

  if (action.actionType === "shell_command" || action.actionType === "code_execution") {
    return target;
  }

  return undefined;
}

function isReadOnlyFileAccess(action: AgentAction) {
  if (action.actionType !== "file_access") return false;
  const operation = action.metadata?.operation;
  const mode = action.metadata?.mode;
  const combined = `${action.description ?? ""} ${action.target ?? ""}`.toLowerCase();
  if (operation === "write" || mode === "write") return false;
  return !/\b(write|edit|modify|delete|remove|create)\b/.test(combined);
}

function isSafeReadOrCheck(action: AgentAction) {
  if (isReadOnlyFileAccess(action)) return true;
  const query = action.command || action.description || "";
  if ((action.actionType === "database_query" || action.actionType === "database_operation") && /^\s*select\b/i.test(query)) {
    return true;
  }
  return action.actionType === "api_call" || action.actionType === "network_request";
}

function shouldSandboxAfterApproval(action: AgentAction) {
  return action.actionType === "shell_command" || action.actionType === "package_install" || action.actionType === "code_execution";
}

async function addInitialRunEvents(run: ActionRun) {
  await appendExecutionEvent(run.runId, "agent_proposed_action", "Agent proposed an action.", {
    actionType: run.action.actionType,
  });
  await appendExecutionEvent(run.runId, "policy_checked", "AgentWing evaluated policy.", {
    policy: run.policy,
    risk: run.risk,
  });
  await appendExecutionEvent(run.runId, "decision_returned", `Decision returned: ${run.decision}.`, {
    decision: run.decision,
  });
}

function initialStatusForDecision(decision: string): { status: ActionRunStatus; executionTarget: ExecutionTarget } {
  switch (decision) {
    case "block":
      return { status: "blocked", executionTarget: "skipped" };
    case "approval_required":
      return { status: "waiting_approval", executionTarget: "none" };
    case "sandbox_required":
      return { status: "waiting_sandbox", executionTarget: "sandbox" };
    case "restore_point_required":
      return { status: "restore_point_required", executionTarget: "external_runner" };
    default:
      return { status: "checked", executionTarget: "none" };
  }
}

export async function createExecutionRun(action: AgentAction, auth: RunAuthContext): Promise<ActionRun> {
  const workspaceId = runWorkspaceId(auth);
  const evaluation = await evaluateActionPolicy(action, auth.workspaceId, auth.projectId);
  const nextStep = nextStepForDecision(evaluation.decision, evaluation.risk);
  const receipt = await createReceipt(action, evaluation, auth.apiKeyId, workspaceId);

  let approvalId: string | undefined;
  if (evaluation.decision === "approval_required" && auth.workspaceId) {
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
  }

  const initial = initialStatusForDecision(evaluation.decision);
  let run = await createActionRun({
    workspaceId,
    projectId: auth.projectId ?? action.projectId,
    apiKeyId: auth.apiKeyId,
    receiptId: receipt.receiptId,
    approvalId,
    action,
    evaluation,
    nextStep,
    status: initial.status,
    executionTarget: initial.executionTarget,
    completedAt: TERMINAL_STATUSES.has(initial.status) ? nowIso() : undefined,
  });

  await addInitialRunEvents(run);

  if (evaluation.decision === "block") {
    await appendExecutionEvent(run.runId, "execution_skipped", "Blocked actions never execute.");
    await notify(workspaceId, "action.blocked", {
      runId: run.runId,
      receiptId: receipt.receiptId,
      policy: evaluation.policy,
      risk: evaluation.risk,
      action: summarizeAction(action),
    });
    return run;
  }

  if (evaluation.decision === "approval_required") {
    await appendExecutionEvent(run.runId, "approval_requested", "Human approval is required before execution.");
    // This is why webhooks exist: an approval gate needs a way to reach a
    // human that is not "the agent tells them".
    await notify(workspaceId, "approval.requested", {
      runId: run.runId,
      approvalId,
      receiptId: receipt.receiptId,
      policy: evaluation.policy,
      risk: evaluation.risk,
      action: summarizeAction(action),
    });
    return run;
  }

  if (evaluation.decision === "restore_point_required") {
    await appendExecutionEvent(run.runId, "checkpoint_required", "A restore point is required before execution.");
    return run;
  }

  run = await continueExecutionForRun(run, auth);
  return run;
}

async function markExecutionSkipped(run: ActionRun, nextStep: string) {
  await appendExecutionEvent(run.runId, "execution_skipped", "No hosted execution was performed.");
  return updateActionRun(
    run.runId,
    {
      status: "execution_skipped",
      executionTarget: "skipped",
      nextStep,
      completedAt: nowIso(),
    },
    run.workspaceId,
  );
}

async function markExternalRunnerRequired(run: ActionRun, message: string) {
  await appendExecutionEvent(run.runId, "external_runner_required", message);
  return updateActionRun(
    run.runId,
    {
      status: "external_runner_required",
      executionTarget: "external_runner",
      nextStep: message,
      completedAt: nowIso(),
    },
    run.workspaceId,
  );
}

async function runInsideE2B(run: ActionRun, auth: RunAuthContext): Promise<ActionRun> {
  const command = commandForSandbox(run.action);
  if (!command) {
    return (await markExternalRunnerRequired(
      run,
      "This action requires sandbox execution, but no executable command was supplied. Provide a runner or command and continue the run.",
    )) ?? run;
  }

  const e2bApiKey = await getE2BApiKeyForExecution(auth.apiKeyId, auth.workspaceId ?? run.workspaceId);
  if (!e2bApiKey) {
    await appendExecutionEvent(run.runId, "waiting_sandbox", "E2B BYOK sandbox is not connected.");
    return (await updateActionRun(
      run.runId,
      {
        status: "waiting_sandbox",
        executionTarget: "sandbox",
        sandboxProvider: "e2b-byok",
        nextStep: "This action requires sandbox execution. Connect E2B or another sandbox runner before continuing.",
      },
      run.workspaceId,
    )) ?? run;
  }

  const usage = await incrementSandboxRunUsage(auth.apiKeyId);
  if (sandboxRunLimitExceeded(usage)) {
    await appendExecutionEvent(run.runId, "sandbox_limit_exceeded", "Sandbox run limit was reached.");
    return (await updateActionRun(
      run.runId,
      {
        status: "waiting_sandbox",
        executionTarget: "sandbox",
        sandboxProvider: "e2b-byok",
        nextStep: "Sandbox run limit reached. Upgrade or wait for the limit to reset before continuing.",
      },
      run.workspaceId,
    )) ?? run;
  }

  await appendExecutionEvent(run.runId, "execution_started", "E2B sandbox execution started.", {
    provider: "e2b-byok",
  });
  await updateActionRun(
    run.runId,
    {
      status: "running",
      executionTarget: "sandbox",
      sandboxProvider: "e2b-byok",
      nextStep: "Running inside E2B sandbox.",
    },
    run.workspaceId,
  );

  try {
    const result = await runE2BSandbox({
      apiKey: e2bApiKey,
      command,
      action: run.action,
      projectId: run.projectId,
      sessionId: run.action.sessionId,
    });
    const status: ActionRunStatus = result.exitCode === 0 && !result.error ? "completed" : "failed";
    const feedback = status === "completed"
      ? "Sandbox execution completed in E2B."
      : "Sandbox execution completed in E2B with a non-zero result.";

    await appendExecutionEvent(run.runId, status === "completed" ? "execution_completed" : "execution_failed", feedback, {
      exitCode: result.exitCode,
      durationMs: result.durationMs,
    });

    if (run.receiptId) {
      await updateReceiptExecutionResult(run.receiptId, run.workspaceId, {
        provider: "e2b-byok",
        mode: "real-e2b",
        stdout: redactLog(result.stdout),
        stderr: redactLog(result.stderr),
        exitCode: result.exitCode,
        durationMs: result.durationMs,
        error: redactLog(result.error),
        feedback,
      });
    }

    return (await updateActionRun(
      run.runId,
      {
        status,
        executionTarget: "sandbox",
        sandboxProvider: "e2b-byok",
        sandboxRunId: result.sandboxId,
        stdout: redactLog(result.stdout),
        stderr: redactLog(result.stderr),
        exitCode: result.exitCode,
        durationMs: result.durationMs,
        errorMessage: redactLog(result.error),
        nextStep: status === "completed" ? "Sandbox execution completed. Review logs and receipt." : "Sandbox execution failed. Review stderr and re-plan.",
        completedAt: nowIso(),
      },
      run.workspaceId,
    )) ?? run;
  } catch (error) {
    const message = redactLog(error instanceof Error ? error.message : "E2B sandbox execution failed.") ?? "E2B sandbox execution failed.";
    await appendExecutionEvent(run.runId, "execution_failed", message);

    if (run.receiptId) {
      await updateReceiptExecutionResult(run.receiptId, run.workspaceId, {
        provider: "e2b-byok",
        mode: "error",
        stdout: "",
        stderr: "",
        exitCode: 1,
        durationMs: 0,
        error: message,
        feedback: "E2B sandbox execution failed before the command completed.",
      });
    }

    return (await updateActionRun(
      run.runId,
      {
        status: "failed",
        executionTarget: "sandbox",
        sandboxProvider: "e2b-byok",
        stdout: "",
        stderr: "",
        exitCode: 1,
        durationMs: 0,
        errorMessage: message,
        nextStep: "Sandbox execution failed. Check the E2B connection and re-plan.",
        completedAt: nowIso(),
      },
      run.workspaceId,
    )) ?? run;
  }
}

export async function continueExecutionForRun(run: ActionRun, auth: RunAuthContext): Promise<ActionRun> {
  if (run.status === "blocked" || run.status === "rejected") return run;

  if (run.decision === "sandbox_required" || (run.status === "approved" && shouldSandboxAfterApproval(run.action))) {
    return runInsideE2B(run, auth);
  }

  if (run.decision === "allow") {
    if (isSafeReadOrCheck(run.action)) {
      return (await markExecutionSkipped(
        run,
        "Policy cleared this read/check action. AgentWing did not execute on the hosted server; the caller may continue in its own runner.",
      )) ?? run;
    }
    return (await markExternalRunnerRequired(
      run,
      "Policy cleared the action, but hosted AgentWing does not execute this tool. Continue through an explicit SDK or external runner.",
    )) ?? run;
  }

  if (run.status === "approved") {
    return (await markExternalRunnerRequired(
      run,
      "Approval recorded. This action requires an explicit external runner; AgentWing will not execute it on the hosted server.",
    )) ?? run;
  }

  return run;
}

export async function approveRunAndContinue(
  runId: string,
  workspaceId: string,
  approvedBy: string,
  reason?: string,
  source = "dashboard",
): Promise<ActionRun | undefined> {
  const approvedRun = await continueActionRunAfterApproval(runId, workspaceId, approvedBy, reason, source);
  if (!approvedRun) return undefined;

  return continueExecutionForRun(approvedRun, {
    apiKeyId: approvedRun.apiKeyId ?? "dashboard",
    workspaceId,
    projectId: approvedRun.projectId,
  });
}

/**
 * Notify a workspace's webhook endpoints, without letting that slow or break
 * the decision it describes.
 *
 * Events are queued to the database, not delivered here — a hostile or merely
 * slow endpoint must never add latency to the path that decides whether an
 * agent may act, and must never fail it.
 */
async function notify(
  workspaceId: string,
  type: Parameters<typeof emitEvent>[1]["type"],
  data: Record<string, unknown>,
): Promise<void> {
  try {
    const db = await getAgentWingD1();
    if (db) await emitEvent(db, { type, workspaceId, data });
  } catch {
    // intentional: a webhook queue failure must not fail the decision. The
    // receipt is already written; the notification is a convenience.
  }
}

/**
 * What an agent is told when its action needs human approval.
 *
 * Deliberately does NOT include an approval credential.
 *
 * This endpoint's caller is the agent whose action is being gated. Handing it
 * the token that approves that action made the gate self-serve: two calls --
 * propose, then approve with the token you were just given -- and the run was
 * approved with the trail recording "Human approval was recorded." The audit
 * log did not merely fail to notice, it asserted something false.
 *
 * The approval must come from a principal that is not the one being policed, so
 * it is granted through the dashboard, where a human is authenticated
 * separately. The agent gets a URL to surface and an id to poll.
 */
export async function createApprovalHandoff(opts: {
  run: ActionRun;
  origin: string;
  surface: "cli" | "ide" | "web" | "webhook";
  runnerId?: string;
}) {
  const base = opts.origin.replace(/\/$/, "");

  return {
    approvalId: opts.run.approvalId,
    approvalUrl: `${base}/dashboard/runs/${opts.run.runId}`,
    statusUrl: `${base}/api/v1/action-runs/${opts.run.runId}`,
    surface: "dashboard" as const,
    requestedSurface: opts.surface,
    runnerId: opts.runnerId,
    instructions:
      "A human must approve this action in the AgentWing dashboard. Show the approval URL to your operator, then poll the status URL until the run leaves waiting_approval.",
  };
}

export async function continueRunFromRunner(
  runId: string,
  auth: RunAuthContext,
  body: ContinueBody,
): Promise<ActionRun | undefined> {
  const workspaceId = runWorkspaceId(auth);
  const run = await getActionRun(runId, workspaceId);
  if (!run) return undefined;

  if (body.restorePointCreated && run.status === "restore_point_required") {
    await appendExecutionEvent(run.runId, "checkpoint_created", "External runner reported that a restore point was created.");
    const checkpointed = await updateActionRun(
      run.runId,
      {
        status: "checkpoint_created",
        nextStep: "Restore point recorded. Continue through an explicit runner and report the execution result.",
      },
      workspaceId,
    );
    return checkpointed;
  }

  if (body.executionResult) {
    // A run may only report an execution result from a state where executing was
    // actually permitted. Without this check, a run AgentWing blocked or a human
    // rejected can be POSTed here and rewritten to `completed` with
    // caller-supplied output -- which makes the receipt say the opposite of what
    // the control plane decided, and lets the party being audited author the
    // audit trail.
    if (!CAN_REPORT_EXECUTION.has(run.status)) {
      throw new RunTransitionError(
        run.status === "blocked" || run.status === "rejected"
          ? `This run was ${run.status} and cannot report an execution result.`
          : `A run in status "${run.status}" cannot report an execution result.`,
        run.status === "blocked" ? "blocked_action_cannot_execute" : "run_not_awaiting_execution",
      );
    }

    const result = body.executionResult;
    const exitCode = typeof result.exitCode === "number" ? result.exitCode : result.error ? 1 : 0;
    const status: ActionRunStatus = exitCode === 0 && !result.error ? "completed" : "failed";
    const target: ExecutionTarget = body.executionTarget === "local_runner" ? "local_runner" : "external_runner";
    const feedback = status === "completed" ? "External runner completed execution." : "External runner reported a failed execution.";

    await appendExecutionEvent(run.runId, status === "completed" ? "execution_completed" : "execution_failed", feedback, {
      exitCode,
      target,
    });

    if (run.receiptId) {
      await updateReceiptExecutionResult(run.receiptId, workspaceId, {
        mode: target,
        stdout: redactLog(result.stdout),
        stderr: redactLog(result.stderr),
        exitCode,
        durationMs: result.durationMs,
        error: redactLog(result.error),
        feedback,
      });
    }

    return updateActionRun(
      run.runId,
      {
        status,
        executionTarget: target,
        stdout: redactLog(result.stdout),
        stderr: redactLog(result.stderr),
        exitCode,
        durationMs: result.durationMs,
        errorMessage: redactLog(result.error),
        nextStep: status === "completed" ? "External runner completed. Review receipt." : "External runner failed. Review logs and re-plan.",
        completedAt: nowIso(),
      },
      workspaceId,
    );
  }

  await appendExecutionEvent(run.runId, "continue_not_supported", "No supported continuation payload was provided.");
  return updateActionRun(
    run.runId,
    {
      nextStep: "Continuation requires restorePointCreated or an explicit executionResult payload.",
    },
    workspaceId,
  );
}

export function summarizeAction(action: AgentAction) {
  return actionLabel(action);
}
