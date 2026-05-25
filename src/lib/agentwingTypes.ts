export const actionTypes = [
  "file_access",
  "shell_command",
  "api_call",
  "browser_action",
  "database_query",
  "message_send",
  "payment_action",
  "deploy_action",
  "custom_action",
] as const;

export type UniversalActionType = (typeof actionTypes)[number];

export type AgentWingDecision =
  | "allow"
  | "block"
  | "approval_required"
  | "sandbox_required"
  | "restore_point_required";

export type AgentWingRisk = "low" | "medium" | "high";

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
  createdAt: string;
  lastLoginAt: string;
};

export type AgentWingWorkspace = {
  workspaceId: string;
  name: string;
  ownerUserId: string;
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
