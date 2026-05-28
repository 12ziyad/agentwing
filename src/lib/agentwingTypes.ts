export const actionTypes = [
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

export type UniversalActionType = (typeof actionTypes)[number];

export type AgentWingDecision =
  | "allow"
  | "block"
  | "approval_required"
  | "sandbox_required"
  | "restore_point_required";

export type AgentWingRisk = "low" | "medium" | "high" | "critical";

export type CustomPolicy = {
  policyId: string;
  workspaceId: string;
  projectId?: string;
  name: string;
  description?: string;
  actionType?: string;
  tool?: string;
  targetPattern?: string;
  commandPattern?: string;
  decision: AgentWingDecision;
  risk: AgentWingRisk;
  priority: number;
  enabled: boolean;
  feedback?: string;
  createdAt: string;
  updatedAt: string;
};

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

export type PolicyEvaluation = {
  decision: AgentWingDecision;
  risk: AgentWingRisk;
  policy: string;
  feedback: string;
  provider?: string;
  mode?: string;
  stdout?: string;
  stderr?: string;
  exitCode?: number;
  durationMs?: number;
  error?: string;
};

export type ActionReceipt = {
  receiptId: string;
  workspaceId?: string;
  projectId?: string;
  sessionId?: string;
  agentId?: string;
  actionType: UniversalActionType;
  tool?: string;
  target?: string;
  rawAction: AgentAction;
  decision: AgentWingDecision;
  risk: AgentWingRisk;
  policy: string;
  feedback: string;
  provider?: string;
  mode?: string;
  stdout?: string;
  stderr?: string;
  exitCode?: number;
  durationMs?: number;
  error?: string;
  createdAt: string;
};

export const actionRunStatuses = [
  "proposed",
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

export type ActionRunStatus = (typeof actionRunStatuses)[number];

export type ExecutionTarget = "none" | "sandbox" | "local_runner" | "external_runner" | "skipped";

export type ExecutionEvent = {
  eventId: string;
  runId: string;
  eventType: string;
  message?: string;
  metadata?: Record<string, unknown>;
  createdAt: string;
};

export type RuntimeApprovalSurface = "cli" | "ide" | "web" | "webhook";

export type RunnerApproval = {
  approvalId?: string;
  approvalUrl: string;
  surface: "dashboard_and_runner";
  runnerApprovalToken: string;
  expiresAt: string;
  approveEndpoint: string;
  rejectEndpoint: string;
};

export type ActionRun = {
  runId: string;
  workspaceId: string;
  projectId?: string;
  apiKeyId?: string;
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
  sandboxProvider?: string;
  sandboxRunId?: string;
  stdout?: string;
  stderr?: string;
  exitCode?: number;
  executionLogs?: ExecutionEvent[];
  errorMessage?: string;
  durationMs?: number;
  createdAt: string;
  updatedAt: string;
  completedAt?: string;
  approvalSource?: string;
};

export type ActionRunStats = {
  total: number;
  completed: number;
  blocked: number;
  waitingApproval: number;
  sandboxRuns: number;
  externalRunnerRequired: number;
};

export type ReceiptStats = {
  total: number;
  blocked: number;
  approvalRequired: number;
  sandboxRequired: number;
  receiptsCreated: number;
};

export type ApiKeyUsage = {
  apiKey: string;
  actionChecksUsed: number;
  sandboxRunsUsed: number;
  receiptsCreated: number;
  planName: string;
  actionCheckLimit: number;
  sandboxRunLimit: number;
};

export type AgentWingProject = {
  projectId: string;
  workspaceId?: string;
  name: string;
  createdAt: string;
};

export type AgentWingApiKeyRecord = {
  apiKeyId: string;
  workspaceId?: string;
  projectId?: string;
  keyPrefix: string;
  planName: string;
  actionCheckLimit: number;
  sandboxRunLimit: number;
  createdAt: string;
  lastUsedAt?: string;
  revokedAt?: string;
};

export type SandboxMode = "none" | "e2b_byok" | "custom_http" | "managed_soon";

export type SandboxTestStatus = "success" | "failed";

export type SandboxProviderConfig = {
  provider: "e2b-byok";
  connected: boolean;
  mode: SandboxMode;
  byok: boolean;
  sandboxMode: "BYOK" | "none";
  keyPrefix?: string;
  keyLast4?: string;
  createdAt?: string;
  updatedAt?: string;
  lastTestStatus?: SandboxTestStatus;
  lastTestedAt?: string;
  lastError?: string;
  runtimeExecutionEnabled: boolean;
  e2bKeySaved: boolean;
  e2bKeyLast4?: string;
  e2bKeyUpdatedAt?: string;
};

export type AgentWingUser = {
  userId: string;
  email: string;
  name?: string;
  image?: string;
  provider: "google";
  providerAccountId: string;
  status?: "active" | "deletion_requested" | "deleted";
  deleteRequestedAt?: string;
  deletedAt?: string;
  createdAt: string;
  lastLoginAt: string;
};

export type AgentWingWorkspace = {
  workspaceId: string;
  name: string;
  ownerUserId: string;
  status?: "active" | "deletion_requested" | "deleted";
  deleteRequestedAt?: string;
  deletedAt?: string;
  createdAt: string;
};

export type DashboardAuthContext =
  | {
      mode: "user";
      user: AgentWingUser;
      workspace: AgentWingWorkspace;
      workspaceId: string;
    }
  | {
      mode: "admin";
      workspaceId?: undefined;
    };
