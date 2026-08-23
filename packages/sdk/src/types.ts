/**
 * The AgentWing wire vocabulary.
 *
 * This is the single source of truth. It used to be triplicated across the
 * server's `agentwingTypes.ts`, this package, and a legacy `types.ts` that used
 * an incompatible decision vocabulary — so the three could and did drift.
 */

export const ACTION_TYPES = [
  "file_access",
  "shell_command",
  "api_call",
  "network_request",
  "browser_action",
  "database_query",
  "database_operation",
  "message_send",
  "payment_action",
  "deploy_action",
  "git_operation",
  "package_install",
  "code_execution",
  "config_change",
  "agent_spawn",
  "custom_action",
] as const;

export type UniversalActionType = (typeof ACTION_TYPES)[number];

export const DECISIONS = [
  "allow",
  "block",
  "approval_required",
  "sandbox_required",
  "restore_point_required",
] as const;

export type AgentWingDecision = (typeof DECISIONS)[number];

export const RISKS = ["low", "medium", "high", "critical"] as const;
export type AgentWingRisk = (typeof RISKS)[number];

export const ACTION_RUN_STATUSES = [
  "checked",
  "blocked",
  "waiting_approval",
  "approved",
  "rejected",
  "waiting_sandbox",
  "running",
  "completed",
  "failed",
  "restore_point_required",
  "checkpoint_created",
  "execution_skipped",
  "external_runner_required",
] as const;

export type ActionRunStatus = (typeof ACTION_RUN_STATUSES)[number];

export type ExecutionTarget = "none" | "sandbox" | "local_runner" | "external_runner" | "skipped";

export type AgentAction = {
  projectId?: string;
  sessionId?: string;
  agentId?: string;
  actionType: UniversalActionType;
  tool?: string;
  target?: string;
  command?: string;
  description?: string;
  metadata?: Record<string, unknown>;
};

export type CheckActionResult = {
  decision: AgentWingDecision;
  risk: AgentWingRisk;
  policy: string;
  feedback: string;
  receiptId: string;
  nextStep?: string;
  approvalId?: string;
};

export type ActionRun = {
  runId: string;
  receiptId?: string;
  approvalId?: string;
  action: AgentAction;
  decision: AgentWingDecision;
  risk: AgentWingRisk;
  policy: string;
  feedback?: string;
  nextStep?: string;
  status: ActionRunStatus;
  executionTarget: ExecutionTarget;
  stdout?: string;
  stderr?: string;
  exitCode?: number;
  errorMessage?: string;
  durationMs?: number;
};

export type RuntimeSurface = "cli" | "ide" | "web" | "webhook";

/**
 * Where a human can approve a held action.
 *
 * Deliberately carries no credential. An earlier version of this type included
 * a `runnerApprovalToken` plus approve and reject endpoints, which meant the
 * agent whose action was being gated received the means to approve it. The
 * server no longer issues that token, and this type no longer describes one.
 */
export type ApprovalHandoff = {
  approvalId?: string;
  /** Dashboard URL where an authenticated human resolves this. */
  approvalUrl: string;
  /** Poll this until the run leaves `waiting_approval`. */
  statusUrl: string;
  surface: "dashboard";
  requestedSurface?: RuntimeSurface;
  runnerId?: string;
  instructions?: string;
};

export type ExecutionResultPayload = {
  stdout?: string;
  stderr?: string;
  exitCode?: number;
  durationMs?: number;
  error?: string;
};
