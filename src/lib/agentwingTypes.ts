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
};

export type ActionReceipt = {
  receiptId: string;
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
  name: string;
  createdAt: string;
};

export type AgentWingApiKeyRecord = {
  apiKeyId: string;
  projectId?: string;
  keyPrefix: string;
  planName: string;
  actionCheckLimit: number;
  sandboxRunLimit: number;
  createdAt: string;
  lastUsedAt?: string;
};
