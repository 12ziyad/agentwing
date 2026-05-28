import { getAgentWingD1, type AgentWingD1Database } from "./cloudflareD1";
import type {
  ActionReceipt,
  AgentAction,
  AgentWingApiKeyRecord,
  AgentWingProject,
  AgentWingUser,
  AgentWingWorkspace,
  DashboardAuthContext,
  ActionRun,
  ActionRunStats,
  ActionRunStatus,
  ApiKeyUsage,
  ExecutionEvent,
  ExecutionTarget,
  PolicyEvaluation,
  ReceiptStats,
  SandboxProviderConfig,
  SandboxTestStatus,
} from "./agentwingTypes";

type SandboxConfig = SandboxProviderConfig & {
  e2bApiKey?: string;
};

type ApiKeyInternal = AgentWingApiKeyRecord & {
  keyHash?: string;
  rawKey?: string;
};

type StoreState = {
  receipts: ActionReceipt[];
  actionRuns: ActionRun[];
  executionEvents: ExecutionEvent[];
  runnerApprovalTokens: RunnerApprovalTokenRecord[];
  sandbox: SandboxConfig;
  usageByApiKey: Record<string, ApiKeyUsage>;
  projects: AgentWingProject[];
  apiKeysById: Record<string, ApiKeyInternal>;
  rawApiKeyToId: Record<string, string>;
  usersById: Record<string, AgentWingUser>;
  workspacesById: Record<string, AgentWingWorkspace>;
  userWorkspaceIds: Record<string, string>;
  sessionsByTokenHash: Record<string, { sessionId: string; userId: string; tokenHash: string; expiresAt: string; createdAt: string }>;
};

type RunnerApprovalTokenRecord = {
  tokenId: string;
  runId: string;
  workspaceId: string;
  tokenHash: string;
  surface: string;
  runnerId?: string;
  expiresAt: string;
  usedAt?: string;
  createdAt: string;
};

type AuthenticatedApiKey = {
  apiKeyId: string;
  workspaceId?: string;
  projectId?: string;
  keyPrefix: string;
  isDemo: boolean;
};

type ReceiptRow = {
  receipt_id: string;
  workspace_id?: string | null;
  project_id?: string | null;
  session_id?: string | null;
  agent_id?: string | null;
  action_type: ActionReceipt["actionType"];
  tool?: string | null;
  target?: string | null;
  raw_action: string;
  decision: ActionReceipt["decision"];
  risk: ActionReceipt["risk"];
  policy: string;
  feedback: string;
  provider?: string | null;
  mode?: string | null;
  stdout?: string | null;
  stderr?: string | null;
  exit_code?: number | null;
  duration_ms?: number | null;
  error?: string | null;
  created_at: string;
};

type ActionRunRow = {
  run_id: string;
  workspace_id: string;
  project_id?: string | null;
  api_key_id?: string | null;
  receipt_id?: string | null;
  approval_id?: string | null;
  action_json: string;
  decision: ActionRun["decision"];
  risk: ActionRun["risk"];
  policy: string;
  feedback?: string | null;
  next_step?: string | null;
  status: ActionRunStatus;
  execution_target?: ExecutionTarget | null;
  sandbox_provider?: string | null;
  sandbox_run_id?: string | null;
  stdout?: string | null;
  stderr?: string | null;
  exit_code?: number | null;
  execution_logs_json?: string | null;
  error_message?: string | null;
  duration_ms?: number | null;
  created_at: string;
  updated_at: string;
  completed_at?: string | null;
  approval_source?: string | null;
};

type RunnerApprovalTokenRow = {
  token_id: string;
  run_id: string;
  workspace_id: string;
  token_hash: string;
  surface: string;
  runner_id?: string | null;
  expires_at: string;
  used_at?: string | null;
  created_at: string;
};

type ExecutionEventRow = {
  event_id: string;
  run_id: string;
  event_type: string;
  message?: string | null;
  metadata_json?: string | null;
  created_at: string;
};

type UsageRow = {
  api_key: string;
  plan_name: string;
  action_checks_used: number;
  action_check_limit: number;
  sandbox_runs_used: number;
  sandbox_run_limit: number;
  receipts_created: number;
};

type ProjectRow = {
  project_id: string;
  workspace_id?: string | null;
  name: string;
  created_at: string;
};

type ApiKeyRow = {
  api_key: string;
  api_key_id?: string | null;
  workspace_id?: string | null;
  project_id?: string | null;
  key_prefix?: string | null;
  plan_name: string;
  action_check_limit: number;
  sandbox_run_limit: number;
  created_at: string;
  last_used_at?: string | null;
  revoked_at?: string | null;
  disabled_at?: string | null;
};

type CustomPolicyRow = {
  policy_id: string;
  workspace_id: string;
  project_id?: string | null;
  name: string;
  description?: string | null;
  action_type?: string | null;
  tool?: string | null;
  target_pattern?: string | null;
  command_pattern?: string | null;
  decision: string;
  risk: string;
  priority: number;
  enabled: number;
  feedback?: string | null;
  created_at: string;
  updated_at: string;
};

type SandboxRow = {
  workspace_id?: string | null;
  mode: SandboxProviderConfig["mode"];
  e2b_key_saved: number;
  e2b_key_prefix?: string | null;
  e2b_key_last4?: string | null;
  e2b_key_encrypted?: string | null;
  connected_at?: string | null;
  updated_at?: string | null;
  last_test_status?: string | null;
  last_tested_at?: string | null;
  last_error?: string | null;
};

type UserRow = {
  user_id: string;
  email: string;
  name?: string | null;
  image?: string | null;
  provider: "google";
  provider_account_id: string;
  status?: "active" | "deletion_requested" | "deleted" | null;
  delete_requested_at?: string | null;
  deleted_at?: string | null;
  created_at: string;
  last_login_at: string;
};

type WorkspaceRow = {
  workspace_id: string;
  name: string;
  owner_user_id: string;
  status?: "active" | "deletion_requested" | "deleted" | null;
  delete_requested_at?: string | null;
  deleted_at?: string | null;
  created_at: string;
};

type SessionRow = {
  session_id: string;
  user_id: string;
  token_hash: string;
  expires_at: string;
  created_at: string;
};

const STORE_SYMBOL = Symbol.for("agentwing.dev.store");
export const DEMO_API_KEY = "aw_live_demo_key";
const BETA_ACTION_CHECK_LIMIT = 1000;
const BETA_SANDBOX_RUN_LIMIT = 20;
const DEMO_PROJECT_ID = "proj_demo_runtime_lab";

type GlobalWithStore = typeof globalThis & {
  [STORE_SYMBOL]?: StoreState;
};

function createDefaultUsage(apiKeyId: string): ApiKeyUsage {
  return {
    apiKey: apiKeyId,
    actionChecksUsed: 0,
    sandboxRunsUsed: 0,
    receiptsCreated: 0,
    planName: "Beta",
    actionCheckLimit: BETA_ACTION_CHECK_LIMIT,
    sandboxRunLimit: BETA_SANDBOX_RUN_LIMIT,
  };
}

function nowIso() {
  return new Date().toISOString();
}

function getState(): StoreState {
  const globalStore = globalThis as GlobalWithStore;
  if (!globalStore[STORE_SYMBOL]) {
    globalStore[STORE_SYMBOL] = {
      receipts: [],
      actionRuns: [],
      executionEvents: [],
      runnerApprovalTokens: [],
      sandbox: {
        provider: "e2b-byok",
        connected: false,
        mode: "none",
        byok: true,
        sandboxMode: "none",
        runtimeExecutionEnabled: false,
        e2bKeySaved: false,
      },
      usageByApiKey: {
        [DEMO_API_KEY]: createDefaultUsage(DEMO_API_KEY),
      },
      projects: [
        {
          projectId: DEMO_PROJECT_ID,
          name: "Runtime Lab Demo",
          createdAt: nowIso(),
        },
      ],
      apiKeysById: {
        [DEMO_API_KEY]: {
          apiKeyId: DEMO_API_KEY,
          keyPrefix: DEMO_API_KEY,
          planName: "Beta",
          actionCheckLimit: BETA_ACTION_CHECK_LIMIT,
          sandboxRunLimit: BETA_SANDBOX_RUN_LIMIT,
          createdAt: nowIso(),
          rawKey: DEMO_API_KEY,
        },
      },
      rawApiKeyToId: {
        [DEMO_API_KEY]: DEMO_API_KEY,
      },
      usersById: {},
      workspacesById: {},
      userWorkspaceIds: {},
      sessionsByTokenHash: {},
    };
  }
  return globalStore[STORE_SYMBOL];
}

function publicUsage(usage: ApiKeyUsage): ApiKeyUsage {
  return {
    ...usage,
    apiKey: usage.apiKey === DEMO_API_KEY ? DEMO_API_KEY : usage.apiKey,
  };
}

function randomId(prefix: string) {
  const cryptoObject = globalThis.crypto;
  if (cryptoObject?.randomUUID) {
    return `${prefix}_${cryptoObject.randomUUID().replace(/-/g, "").slice(0, 16)}`;
  }
  return `${prefix}_${Math.random().toString(36).slice(2, 18)}`;
}

export function createAgentWingId(prefix: string) {
  return randomId(prefix);
}

function randomToken(bytesLength = 24) {
  const bytes = new Uint8Array(bytesLength);
  globalThis.crypto.getRandomValues(bytes);
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function sha256(value: string) {
  const data = new TextEncoder().encode(value);
  const digest = await globalThis.crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function importSandboxCryptoKey() {
  const configuredSecret = process.env.AGENTWING_SANDBOX_SECRET ?? process.env.AGENTWING_SECRET_KEY;
  const secret =
    configuredSecret ||
    (process.env.NODE_ENV === "production" ? undefined : "agentwing-dev-only-sandbox-secret");

  if (!secret) {
    throw new Error("Set AGENTWING_SANDBOX_SECRET to store usable BYOK sandbox credentials in D1.");
  }

  if (!configuredSecret && process.env.NODE_ENV !== "production") {
    warnD1Fallback("sandbox-secret-dev-key", new Error("Using dev-only sandbox encryption key."));
  }

  const digest = await globalThis.crypto.subtle.digest("SHA-256", new TextEncoder().encode(secret));
  return globalThis.crypto.subtle.importKey("raw", digest, "AES-GCM", false, ["encrypt", "decrypt"]);
}

function bytesToBase64(bytes: Uint8Array) {
  return Buffer.from(bytes).toString("base64");
}

function base64ToBytes(value: string) {
  return new Uint8Array(Buffer.from(value, "base64"));
}

async function encryptSandboxSecret(secret: string) {
  // TODO: Rotate this to a Cloudflare Worker secret-derived key with versioned key IDs.
  const key = await importSandboxCryptoKey();
  const iv = new Uint8Array(12);
  globalThis.crypto.getRandomValues(iv);
  const encrypted = await globalThis.crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    new TextEncoder().encode(secret),
  );

  return `awenc:v1:${bytesToBase64(iv)}:${bytesToBase64(new Uint8Array(encrypted))}`;
}

async function decryptSandboxSecret(encryptedSecret?: string | null) {
  if (!encryptedSecret) return undefined;
  if (!encryptedSecret.startsWith("awenc:v1:")) return undefined;

  const [, , ivBase64, payloadBase64] = encryptedSecret.split(":");
  if (!ivBase64 || !payloadBase64) return undefined;

  const key = await importSandboxCryptoKey();
  const decrypted = await globalThis.crypto.subtle.decrypt(
    { name: "AES-GCM", iv: base64ToBytes(ivBase64) },
    key,
    base64ToBytes(payloadBase64),
  );

  return new TextDecoder().decode(decrypted);
}

function keyPrefix(apiKey: string) {
  return apiKey.length <= 20 ? apiKey : `${apiKey.slice(0, 16)}...`;
}

function redact(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(redact);
  if (!value || typeof value !== "object") return value;

  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>).map(([key, entry]) => {
      if (/secret|token|password|authorization|api[_-]?key|private[_-]?key/i.test(key)) {
        return [key, "[redacted]"];
      }
      return [key, redact(entry)];
    }),
  );
}

export function sanitizeAction(action: AgentAction): AgentAction {
  return redact(action) as AgentAction;
}

function mapReceiptRow(row: ReceiptRow): ActionReceipt {
  return {
    receiptId: row.receipt_id,
    workspaceId: row.workspace_id ?? undefined,
    projectId: row.project_id ?? undefined,
    sessionId: row.session_id ?? undefined,
    agentId: row.agent_id ?? undefined,
    actionType: row.action_type,
    tool: row.tool ?? undefined,
    target: row.target ?? undefined,
    rawAction: JSON.parse(row.raw_action) as AgentAction,
    decision: row.decision,
    risk: row.risk,
    policy: row.policy,
    feedback: row.feedback,
    provider: row.provider ?? undefined,
    mode: row.mode ?? undefined,
    stdout: row.stdout ?? undefined,
    stderr: row.stderr ?? undefined,
    exitCode: row.exit_code ?? undefined,
    durationMs: row.duration_ms ?? undefined,
    error: row.error ?? undefined,
    createdAt: row.created_at,
  };
}

function parseJsonObject(value?: string | null): Record<string, unknown> {
  if (!value) return {};
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed as Record<string, unknown> : {};
  } catch {
    return {};
  }
}

function parseExecutionEvents(value?: string | null): ExecutionEvent[] | undefined {
  if (!value) return undefined;
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed as ExecutionEvent[] : undefined;
  } catch {
    return undefined;
  }
}

function mapExecutionEventRow(row: ExecutionEventRow): ExecutionEvent {
  return {
    eventId: row.event_id,
    runId: row.run_id,
    eventType: row.event_type,
    message: row.message ?? undefined,
    metadata: parseJsonObject(row.metadata_json),
    createdAt: row.created_at,
  };
}

function mapActionRunRow(row: ActionRunRow): ActionRun {
  let action: AgentAction;
  try {
    action = JSON.parse(row.action_json) as AgentAction;
  } catch {
    action = { actionType: "custom_action", description: "Unable to parse stored action JSON." };
  }

  return {
    runId: row.run_id,
    workspaceId: row.workspace_id,
    projectId: row.project_id ?? undefined,
    apiKeyId: row.api_key_id ?? undefined,
    receiptId: row.receipt_id ?? undefined,
    approvalId: row.approval_id ?? undefined,
    action,
    decision: row.decision,
    risk: row.risk,
    policy: row.policy,
    feedback: row.feedback ?? undefined,
    nextStep: row.next_step ?? undefined,
    status: row.status,
    executionTarget: row.execution_target ?? "none",
    sandboxProvider: row.sandbox_provider ?? undefined,
    sandboxRunId: row.sandbox_run_id ?? undefined,
    stdout: row.stdout ?? undefined,
    stderr: row.stderr ?? undefined,
    exitCode: row.exit_code ?? undefined,
    executionLogs: parseExecutionEvents(row.execution_logs_json),
    errorMessage: row.error_message ?? undefined,
    durationMs: row.duration_ms ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    completedAt: row.completed_at ?? undefined,
    approvalSource: row.approval_source ?? undefined,
  };
}

function mapRunnerApprovalTokenRow(row: RunnerApprovalTokenRow): RunnerApprovalTokenRecord {
  return {
    tokenId: row.token_id,
    runId: row.run_id,
    workspaceId: row.workspace_id,
    tokenHash: row.token_hash,
    surface: row.surface,
    runnerId: row.runner_id ?? undefined,
    expiresAt: row.expires_at,
    usedAt: row.used_at ?? undefined,
    createdAt: row.created_at,
  };
}

function mapUsageRow(row: UsageRow): ApiKeyUsage {
  return {
    apiKey: row.api_key,
    planName: row.plan_name,
    actionChecksUsed: row.action_checks_used,
    actionCheckLimit: row.action_check_limit,
    sandboxRunsUsed: row.sandbox_runs_used,
    sandboxRunLimit: row.sandbox_run_limit,
    receiptsCreated: row.receipts_created,
  };
}

function mapProjectRow(row: ProjectRow): AgentWingProject {
  return {
    projectId: row.project_id,
    workspaceId: row.workspace_id ?? undefined,
    name: row.name,
    createdAt: row.created_at,
  };
}

function mapApiKeyRow(row: ApiKeyRow): AgentWingApiKeyRecord {
  return {
    apiKeyId: row.api_key_id ?? row.api_key,
    workspaceId: row.workspace_id ?? undefined,
    projectId: row.project_id ?? undefined,
    keyPrefix: row.key_prefix ?? row.api_key,
    planName: row.plan_name,
    actionCheckLimit: row.action_check_limit,
    sandboxRunLimit: row.sandbox_run_limit,
    createdAt: row.created_at,
    lastUsedAt: row.last_used_at ?? undefined,
    revokedAt: row.revoked_at ?? row.disabled_at ?? undefined,
  };
}

function mapCustomPolicyRow(row: CustomPolicyRow): import("./agentwingTypes").CustomPolicy {
  return {
    policyId: row.policy_id,
    workspaceId: row.workspace_id,
    projectId: row.project_id ?? undefined,
    name: row.name,
    description: row.description ?? undefined,
    actionType: row.action_type ?? undefined,
    tool: row.tool ?? undefined,
    targetPattern: row.target_pattern ?? undefined,
    commandPattern: row.command_pattern ?? undefined,
    decision: row.decision as import("./agentwingTypes").AgentWingDecision,
    risk: row.risk as import("./agentwingTypes").AgentWingRisk,
    priority: row.priority,
    enabled: Boolean(row.enabled),
    feedback: row.feedback ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapUserRow(row: UserRow): AgentWingUser {
  return {
    userId: row.user_id,
    email: row.email,
    name: row.name ?? undefined,
    image: row.image ?? undefined,
    provider: row.provider,
    providerAccountId: row.provider_account_id,
    status: row.status ?? undefined,
    deleteRequestedAt: row.delete_requested_at ?? undefined,
    deletedAt: row.deleted_at ?? undefined,
    createdAt: row.created_at,
    lastLoginAt: row.last_login_at,
  };
}

function mapWorkspaceRow(row: WorkspaceRow): AgentWingWorkspace {
  return {
    workspaceId: row.workspace_id,
    name: row.name,
    ownerUserId: row.owner_user_id,
    status: row.status ?? undefined,
    deleteRequestedAt: row.delete_requested_at ?? undefined,
    deletedAt: row.deleted_at ?? undefined,
    createdAt: row.created_at,
  };
}

function normalizeStoredE2BKey(apiKey: string) {
  let normalized = apiKey.trim().replace(/^['"]|['"]$/g, "");

  for (const pattern of [
    /^authorization\s*:\s*bearer\s+/i,
    /^authorization\s*=\s*bearer\s+/i,
    /^bearer\s+/i,
    /^x-api-key\s*:\s*/i,
    /^x-api-key\s*=\s*/i,
    /^e2b_api_key\s*=\s*/i,
  ]) {
    normalized = normalized.replace(pattern, "").trim().replace(/^['"]|['"]$/g, "");
  }

  return normalized;
}

function safeE2BKeyPrefix(apiKey: string) {
  return apiKey.toLowerCase().startsWith("e2b_") ? "e2b_" : undefined;
}

function isPlaceholderE2BKey(apiKey: string) {
  return /^(paste_your_|e2b_your_key_here|your_e2b_api_key)/i.test(apiKey);
}

function publicSandboxConfig(row?: Partial<SandboxRow> | null): SandboxProviderConfig {
  const connected = Boolean(row?.e2b_key_saved && row.mode === "e2b_byok");
  const lastTestStatus =
    row?.last_test_status === "success" || row?.last_test_status === "failed"
      ? row.last_test_status
      : undefined;

  return {
    provider: "e2b-byok",
    connected,
    mode: row?.mode ?? "none",
    byok: true,
    sandboxMode: connected ? "BYOK" : "none",
    keyPrefix: row?.e2b_key_prefix ?? undefined,
    keyLast4: row?.e2b_key_last4 ?? undefined,
    createdAt: row?.connected_at ?? undefined,
    updatedAt: row?.updated_at ?? undefined,
    lastTestStatus,
    lastTestedAt: row?.last_tested_at ?? undefined,
    lastError: row?.last_error ?? undefined,
    runtimeExecutionEnabled: connected,
    e2bKeySaved: connected,
    e2bKeyLast4: row?.e2b_key_last4 ?? undefined,
    e2bKeyUpdatedAt: row?.updated_at ?? undefined,
  };
}

export function sandboxOwnerKeyForWorkspace(workspaceId?: string) {
  return workspaceId ? `workspace:${workspaceId}` : DEMO_API_KEY;
}

function workspaceIdFromSandboxOwner(ownerApiKeyId: string) {
  return ownerApiKeyId.startsWith("workspace:") ? ownerApiKeyId.slice("workspace:".length) : undefined;
}

function workspaceNameFromEmail(email: string) {
  const localPart = email.split("@")[0]?.replace(/[._-]+/g, " ").trim();
  if (!localPart) return "My Workspace";
  return `${localPart.replace(/\b\w/g, (char) => char.toUpperCase())} Workspace`;
}

async function getDb() {
  const db = await getAgentWingD1();
  if (!db) {
    if (process.env.NODE_ENV === "production") {
      throw new Error("AGENTWING_DB binding is required in production.");
    }
    warnD1Fallback("missing-binding", new Error("AGENTWING_DB binding unavailable"));
  }
  return db;
}

async function getD1TableColumns(db: AgentWingD1Database, tableName: "users" | "workspaces" | "receipts") {
  try {
    const result = await db
      .prepare(`PRAGMA table_info(${tableName})`)
      .all<{ name: string }>();
    return new Set((result.results ?? []).map((row) => row.name));
  } catch {
    return new Set<string>();
  }
}

const fallbackWarnings = new Set<string>();

function warnD1Fallback(area: string, error: unknown) {
  if (process.env.NODE_ENV === "production") {
    throw error instanceof Error ? error : new Error("D1 unavailable in production.");
  }
  if (fallbackWarnings.has(area)) return;
  fallbackWarnings.add(area);
  const message = error instanceof Error ? error.message : "Unknown D1 error";
  console.warn(`[AgentWing] D1 unavailable for ${area}; using local dev fallback. ${message}`);
}

async function ensureD1DemoKey(db: AgentWingD1Database) {
  const hash = await sha256(DEMO_API_KEY);

  await db
    .prepare("INSERT OR IGNORE INTO projects (project_id, name, created_at) VALUES (?, ?, ?)")
    .bind(DEMO_PROJECT_ID, "Runtime Lab Demo", nowIso())
    .run();

  await db
    .prepare(
      `INSERT OR IGNORE INTO api_keys
       (api_key, api_key_id, project_id, key_prefix, key_hash, plan_name, action_check_limit, sandbox_run_limit, created_at)
       VALUES (?, ?, NULL, ?, ?, 'Beta', ?, ?, ?)`,
    )
    .bind(
      DEMO_API_KEY,
      DEMO_API_KEY,
      DEMO_API_KEY,
      hash,
      BETA_ACTION_CHECK_LIMIT,
      BETA_SANDBOX_RUN_LIMIT,
      nowIso(),
    )
    .run();

  await db
    .prepare(
      `INSERT OR IGNORE INTO usage
       (api_key, plan_name, action_check_limit, sandbox_run_limit)
       VALUES (?, 'Beta', ?, ?)`,
    )
    .bind(DEMO_API_KEY, BETA_ACTION_CHECK_LIMIT, BETA_SANDBOX_RUN_LIMIT)
    .run();

  await db
    .prepare("INSERT OR IGNORE INTO sandbox_configs (api_key, mode, e2b_key_saved) VALUES (?, 'none', 0)")
    .bind(DEMO_API_KEY)
    .run();
}

export async function upsertGoogleUserAndWorkspace(profile: {
  providerAccountId: string;
  email: string;
  name?: string;
  image?: string;
}): Promise<{ user: AgentWingUser; workspace: AgentWingWorkspace }> {
  const email = profile.email.trim().toLowerCase();
  if (!email) throw new Error("Google profile did not include an email address.");

  const now = nowIso();
  const db = await getDb();
  if (db) {
    try {
      let userRow = await db
        .prepare("SELECT user_id, email, name, image, provider, provider_account_id, created_at, last_login_at FROM users WHERE provider = 'google' AND provider_account_id = ?")
        .bind(profile.providerAccountId)
        .first<UserRow>();

      if (!userRow) {
        userRow = await db
          .prepare("SELECT user_id, email, name, image, provider, provider_account_id, created_at, last_login_at FROM users WHERE email = ?")
          .bind(email)
          .first<UserRow>();
      }

      const userId = userRow?.user_id ?? randomId("user");
      if (userRow) {
        await db
          .prepare(
            `UPDATE users
             SET email = ?, name = ?, image = ?, provider = 'google', provider_account_id = ?, last_login_at = ?
             WHERE user_id = ?`,
          )
          .bind(email, profile.name ?? null, profile.image ?? null, profile.providerAccountId, now, userId)
          .run();
      } else {
        await db
          .prepare(
            `INSERT INTO users
             (user_id, email, name, image, provider, provider_account_id, created_at, last_login_at)
             VALUES (?, ?, ?, ?, 'google', ?, ?, ?)`,
          )
          .bind(userId, email, profile.name ?? null, profile.image ?? null, profile.providerAccountId, now, now)
          .run();
      }

      const user = mapUserRow(
        (await db
          .prepare("SELECT user_id, email, name, image, provider, provider_account_id, created_at, last_login_at FROM users WHERE user_id = ?")
          .bind(userId)
          .first<UserRow>())!,
      );

      let workspaceRow = await db
        .prepare("SELECT workspace_id, name, owner_user_id, created_at FROM workspaces WHERE owner_user_id = ? ORDER BY created_at ASC LIMIT 1")
        .bind(user.userId)
        .first<WorkspaceRow>();

      if (!workspaceRow) {
        const workspaceId = randomId("ws");
        await db
          .prepare("INSERT INTO workspaces (workspace_id, name, owner_user_id, created_at) VALUES (?, ?, ?, ?)")
          .bind(workspaceId, workspaceNameFromEmail(email), user.userId, now)
          .run();
        await db
          .prepare("INSERT OR IGNORE INTO workspace_members (workspace_id, user_id, role, created_at) VALUES (?, ?, 'owner', ?)")
          .bind(workspaceId, user.userId, now)
          .run();
        workspaceRow = (await db
          .prepare("SELECT workspace_id, name, owner_user_id, created_at FROM workspaces WHERE workspace_id = ?")
          .bind(workspaceId)
          .first<WorkspaceRow>())!;
      } else {
        await db
          .prepare("INSERT OR IGNORE INTO workspace_members (workspace_id, user_id, role, created_at) VALUES (?, ?, 'owner', ?)")
          .bind(workspaceRow.workspace_id, user.userId, now)
          .run();
      }

      return { user, workspace: mapWorkspaceRow(workspaceRow) };
    } catch (error) {
      warnD1Fallback("upsertGoogleUserAndWorkspace", error);
    }
  }

  const state = getState();
  const existingUser = Object.values(state.usersById).find(
    (user) => user.provider === "google" && user.providerAccountId === profile.providerAccountId,
  );
  const user: AgentWingUser = {
    userId: existingUser?.userId ?? randomId("user"),
    email,
    name: profile.name,
    image: profile.image,
    provider: "google",
    providerAccountId: profile.providerAccountId,
    createdAt: existingUser?.createdAt ?? now,
    lastLoginAt: now,
  };
  state.usersById[user.userId] = user;

  const existingWorkspaceId = state.userWorkspaceIds[user.userId];
  const workspace: AgentWingWorkspace = existingWorkspaceId
    ? state.workspacesById[existingWorkspaceId]
    : {
        workspaceId: randomId("ws"),
        name: workspaceNameFromEmail(email),
        ownerUserId: user.userId,
        createdAt: now,
      };
  state.workspacesById[workspace.workspaceId] = workspace;
  state.userWorkspaceIds[user.userId] = workspace.workspaceId;

  return { user, workspace };
}

export async function createUserSession(userId: string, tokenHash: string, expiresAt: string) {
  const session = {
    sessionId: randomId("sess"),
    userId,
    tokenHash,
    expiresAt,
    createdAt: nowIso(),
  };

  const db = await getDb();
  if (db) {
    try {
      await db
        .prepare("INSERT INTO sessions (session_id, user_id, token_hash, expires_at, created_at) VALUES (?, ?, ?, ?, ?)")
        .bind(session.sessionId, session.userId, session.tokenHash, session.expiresAt, session.createdAt)
        .run();
      return session;
    } catch (error) {
      warnD1Fallback("createUserSession", error);
    }
  }

  getState().sessionsByTokenHash[tokenHash] = session;
  return session;
}

export async function getUserSession(tokenHash: string): Promise<DashboardAuthContext | undefined> {
  const db = await getDb();
  if (db) {
    try {
      const row = await db
        .prepare("SELECT session_id, user_id, token_hash, expires_at, created_at FROM sessions WHERE token_hash = ?")
        .bind(tokenHash)
        .first<SessionRow>();
      if (!row || Date.parse(row.expires_at) <= Date.now()) return undefined;

      const userRow = await db
        .prepare("SELECT user_id, email, name, image, provider, provider_account_id, created_at, last_login_at FROM users WHERE user_id = ?")
        .bind(row.user_id)
        .first<UserRow>();
      if (!userRow) return undefined;

      const workspaceRow = await db
        .prepare(
          `SELECT workspaces.workspace_id, workspaces.name, workspaces.owner_user_id, workspaces.created_at
           FROM workspaces
           INNER JOIN workspace_members ON workspace_members.workspace_id = workspaces.workspace_id
           WHERE workspace_members.user_id = ?
           ORDER BY workspaces.created_at ASC
           LIMIT 1`,
        )
        .bind(userRow.user_id)
        .first<WorkspaceRow>();
      if (!workspaceRow) return undefined;

      const user = mapUserRow(userRow);
      const workspace = mapWorkspaceRow(workspaceRow);
      return { mode: "user", user, workspace, workspaceId: workspace.workspaceId };
    } catch (error) {
      warnD1Fallback("getUserSession", error);
    }
  }

  const state = getState();
  const session = state.sessionsByTokenHash[tokenHash];
  if (!session || Date.parse(session.expiresAt) <= Date.now()) return undefined;
  const user = state.usersById[session.userId];
  const workspaceId = state.userWorkspaceIds[session.userId];
  const workspace = workspaceId ? state.workspacesById[workspaceId] : undefined;
  if (!user || !workspace) return undefined;
  return { mode: "user", user, workspace, workspaceId };
}

export async function deleteUserSession(tokenHash: string) {
  const db = await getDb();
  if (db) {
    try {
      await db.prepare("DELETE FROM sessions WHERE token_hash = ?").bind(tokenHash).run();
      return;
    } catch (error) {
      warnD1Fallback("deleteUserSession", error);
    }
  }

  delete getState().sessionsByTokenHash[tokenHash];
}

export function getApiKeyFromRequest(request: Request) {
  const authorization = request.headers.get("authorization") ?? "";
  const [scheme, token] = authorization.split(/\s+/, 2);
  if (scheme?.toLowerCase() !== "bearer" || !token) return undefined;
  return token.trim();
}

export async function validateApiKeyFromRequest(request: Request): Promise<AuthenticatedApiKey | undefined> {
  const rawApiKey = getApiKeyFromRequest(request);
  if (!rawApiKey) return undefined;

  const db = await getDb();
  if (db) {
    try {
      await ensureD1DemoKey(db);

      if (rawApiKey === DEMO_API_KEY) {
        return {
          apiKeyId: DEMO_API_KEY,
          keyPrefix: DEMO_API_KEY,
          isDemo: true,
        };
      }

      const hash = await sha256(rawApiKey);
      const row = await db
        .prepare(
          `SELECT api_key, api_key_id, workspace_id, project_id, key_prefix, plan_name, action_check_limit,
                  sandbox_run_limit, created_at, last_used_at, revoked_at, disabled_at
           FROM api_keys
           WHERE key_hash = ? AND disabled_at IS NULL AND revoked_at IS NULL`,
        )
        .bind(hash)
        .first<ApiKeyRow>();

      if (!row) return undefined;

      const apiKeyId = row.api_key_id ?? row.api_key;
      await db
        .prepare("UPDATE api_keys SET last_used_at = ? WHERE api_key = ?")
        .bind(nowIso(), row.api_key)
        .run();

      return {
        apiKeyId,
        workspaceId: row.workspace_id ?? undefined,
        projectId: row.project_id ?? undefined,
        keyPrefix: row.key_prefix ?? keyPrefix(rawApiKey),
        isDemo: false,
      };
    } catch (error) {
      warnD1Fallback("listProjects", error);
      // Fall back to memory if D1 has not been migrated yet.
    }
  }

  const state = getState();
  const apiKeyId = state.rawApiKeyToId[rawApiKey];
  if (!apiKeyId) return undefined;
  const record = state.apiKeysById[apiKeyId];
  record.lastUsedAt = nowIso();

  return {
    apiKeyId,
    workspaceId: record.workspaceId,
    projectId: record.projectId,
    keyPrefix: record.keyPrefix,
    isDemo: rawApiKey === DEMO_API_KEY,
  };
}

export function unauthorizedResponse() {
  return Response.json(
    {
      error: "Unauthorized",
      feedback: "Provide Authorization: Bearer aw_live_demo_key in local/dev mode.",
    },
    { status: 401 },
  );
}

function ensureUsageForKeyFallback(apiKeyId: string) {
  const state = getState();
  state.usageByApiKey[apiKeyId] ??= createDefaultUsage(apiKeyId);
  return state.usageByApiKey[apiKeyId];
}

async function ensureD1UsageForKey(db: AgentWingD1Database, apiKeyId: string, record?: AgentWingApiKeyRecord) {
  await db
    .prepare(
      `INSERT OR IGNORE INTO usage
       (api_key, plan_name, action_check_limit, sandbox_run_limit)
       VALUES (?, ?, ?, ?)`,
    )
    .bind(
      apiKeyId,
      record?.planName ?? "Beta",
      record?.actionCheckLimit ?? BETA_ACTION_CHECK_LIMIT,
      record?.sandboxRunLimit ?? BETA_SANDBOX_RUN_LIMIT,
    )
    .run();
}

export async function listProjects(workspaceId?: string): Promise<AgentWingProject[]> {
  const db = await getDb();
  if (db) {
    try {
      await ensureD1DemoKey(db);
      const statement = workspaceId
        ? db
            .prepare("SELECT project_id, workspace_id, name, created_at FROM projects WHERE workspace_id = ? ORDER BY created_at DESC")
            .bind(workspaceId)
        : db.prepare("SELECT project_id, workspace_id, name, created_at FROM projects ORDER BY created_at DESC");
      const result = await statement.all<ProjectRow>();
      return (result.results ?? []).map(mapProjectRow);
    } catch (error) {
      warnD1Fallback("createProject", error);
      // Fall back to memory if D1 has not been migrated yet.
    }
  }

  return getState().projects.filter((project) => !workspaceId || project.workspaceId === workspaceId);
}

export async function createProject(name: string, workspaceId?: string): Promise<AgentWingProject> {
  const project: AgentWingProject = {
    projectId: randomId("proj"),
    workspaceId,
    name: name.trim(),
    createdAt: nowIso(),
  };

  if (!project.name) {
    throw new Error("Project name is required.");
  }

  const db = await getDb();
  if (db) {
    try {
      await ensureD1DemoKey(db);
      await db
        .prepare("INSERT INTO projects (project_id, workspace_id, name, created_at) VALUES (?, ?, ?, ?)")
        .bind(project.projectId, workspaceId ?? null, project.name, project.createdAt)
        .run();
      return project;
    } catch (error) {
      warnD1Fallback("listApiKeys", error);
      // Fall back to memory if D1 has not been migrated yet.
    }
  }

  getState().projects.unshift(project);
  return project;
}

export async function listApiKeys(projectId?: string, workspaceId?: string): Promise<AgentWingApiKeyRecord[]> {
  const db = await getDb();
  if (db) {
    try {
      await ensureD1DemoKey(db);
      const conditions = ["project_id IS NOT NULL"];
      const values: string[] = [];
      if (projectId) {
        conditions.push("project_id = ?");
        values.push(projectId);
      }
      if (workspaceId) {
        conditions.push("workspace_id = ?");
        values.push(workspaceId);
      }
      const statement = db
        .prepare(
          `SELECT api_key, api_key_id, workspace_id, project_id, key_prefix, plan_name, action_check_limit,
                  sandbox_run_limit, created_at, last_used_at, revoked_at, disabled_at
           FROM api_keys
           WHERE ${conditions.join(" AND ")}
           ORDER BY created_at DESC`,
        )
        .bind(...values);
      const result = await statement.all<ApiKeyRow>();
      return (result.results ?? []).map(mapApiKeyRow);
    } catch (error) {
      warnD1Fallback("generateApiKey", error);
      // Fall back to memory if D1 has not been migrated yet.
    }
  }

  return Object.values(getState().apiKeysById)
    .filter((record) => record.apiKeyId !== DEMO_API_KEY)
    .filter((record) => !projectId || record.projectId === projectId)
    .filter((record) => !workspaceId || record.workspaceId === workspaceId)
    .map((record) => ({
      apiKeyId: record.apiKeyId,
      workspaceId: record.workspaceId,
      projectId: record.projectId,
      keyPrefix: record.keyPrefix,
      planName: record.planName,
      actionCheckLimit: record.actionCheckLimit,
      sandboxRunLimit: record.sandboxRunLimit,
      createdAt: record.createdAt,
      lastUsedAt: record.lastUsedAt,
    }));
}

export async function generateApiKey(projectId: string, workspaceId?: string) {
  const project = (await listProjects(workspaceId)).find((item) => item.projectId === projectId);
  if (!project) {
    throw new Error("Project not found.");
  }

  const apiKey = `aw_live_${randomToken(24)}`;
  const apiKeyId = randomId("key");
  const record: AgentWingApiKeyRecord = {
    apiKeyId,
    workspaceId: project.workspaceId ?? workspaceId,
    projectId,
    keyPrefix: keyPrefix(apiKey),
    planName: "Beta",
    actionCheckLimit: BETA_ACTION_CHECK_LIMIT,
    sandboxRunLimit: BETA_SANDBOX_RUN_LIMIT,
    createdAt: nowIso(),
  };
  const hash = await sha256(apiKey);

  const db = await getDb();
  if (db) {
    try {
      await ensureD1DemoKey(db);
      await db
        .prepare(
          `INSERT INTO api_keys
           (api_key, api_key_id, workspace_id, project_id, key_prefix, key_hash, plan_name, action_check_limit, sandbox_run_limit, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        )
        .bind(
          apiKeyId,
          apiKeyId,
          record.workspaceId ?? null,
          projectId,
          record.keyPrefix,
          hash,
          record.planName,
          record.actionCheckLimit,
          record.sandboxRunLimit,
          record.createdAt,
        )
        .run();
      await ensureD1UsageForKey(db, apiKeyId, record);
      return { apiKey, record };
    } catch (error) {
      warnD1Fallback("getUsageForApiKey", error);
      // Fall back to memory if D1 has not been migrated yet.
    }
  }

  const state = getState();
  state.apiKeysById[apiKeyId] = {
    ...record,
    keyHash: hash,
    rawKey: apiKey,
  };
  state.rawApiKeyToId[apiKey] = apiKeyId;
  state.usageByApiKey[apiKeyId] = createDefaultUsage(apiKeyId);

  return { apiKey, record };
}

export async function getUsageForApiKey(apiKeyId: string) {
  const db = await getDb();
  if (db) {
    try {
      await ensureD1DemoKey(db);
      await ensureD1UsageForKey(db, apiKeyId);
      const row = await db
        .prepare(
          `SELECT api_key, plan_name, action_checks_used, action_check_limit,
                  sandbox_runs_used, sandbox_run_limit, receipts_created
           FROM usage
           WHERE api_key = ?`,
        )
        .bind(apiKeyId)
        .first<UsageRow>();
      return publicUsage(row ? mapUsageRow(row) : createDefaultUsage(apiKeyId));
    } catch (error) {
      warnD1Fallback("incrementActionCheckUsage", error);
      // Fall back to memory if D1 has not been migrated yet.
    }
  }

  return publicUsage(ensureUsageForKeyFallback(apiKeyId));
}

export async function getUsageForWorkspace(workspaceId?: string) {
  const db = await getDb();
  if (db) {
    try {
      await ensureD1DemoKey(db);
      const statement = workspaceId
        ? db
            .prepare(
              `SELECT
                 COALESCE(SUM(usage.action_checks_used), 0) AS action_checks_used,
                 COALESCE(SUM(usage.action_check_limit), 0) AS action_check_limit,
                 COALESCE(SUM(usage.sandbox_runs_used), 0) AS sandbox_runs_used,
                 COALESCE(SUM(usage.sandbox_run_limit), 0) AS sandbox_run_limit,
                 COALESCE(SUM(usage.receipts_created), 0) AS receipts_created
               FROM usage
               INNER JOIN api_keys ON api_keys.api_key = usage.api_key
               WHERE api_keys.workspace_id = ?`,
            )
            .bind(workspaceId)
        : db.prepare(
            `SELECT
               COALESCE(SUM(usage.action_checks_used), 0) AS action_checks_used,
               COALESCE(SUM(usage.action_check_limit), 0) AS action_check_limit,
               COALESCE(SUM(usage.sandbox_runs_used), 0) AS sandbox_runs_used,
               COALESCE(SUM(usage.sandbox_run_limit), 0) AS sandbox_run_limit,
               COALESCE(SUM(usage.receipts_created), 0) AS receipts_created
             FROM usage
             INNER JOIN api_keys ON api_keys.api_key = usage.api_key
             WHERE api_keys.project_id IS NOT NULL`,
          );
      const row = await statement.first<UsageRow>();
      return publicUsage({
        apiKey: workspaceId ? "workspace" : "all-workspaces",
        planName: "Beta",
        actionChecksUsed: row?.action_checks_used ?? 0,
        actionCheckLimit: row?.action_check_limit || BETA_ACTION_CHECK_LIMIT,
        sandboxRunsUsed: row?.sandbox_runs_used ?? 0,
        sandboxRunLimit: row?.sandbox_run_limit || BETA_SANDBOX_RUN_LIMIT,
        receiptsCreated: row?.receipts_created ?? 0,
      });
    } catch (error) {
      warnD1Fallback("getUsageForWorkspace", error);
    }
  }

  const apiKeys = Object.values(getState().apiKeysById).filter(
    (record) => record.apiKeyId !== DEMO_API_KEY && (!workspaceId || record.workspaceId === workspaceId),
  );
  const usageRows = apiKeys.map((record) => ensureUsageForKeyFallback(record.apiKeyId));
  return publicUsage({
    apiKey: workspaceId ? "workspace" : "all-workspaces",
    planName: "Beta",
    actionChecksUsed: usageRows.reduce((total, usage) => total + usage.actionChecksUsed, 0),
    actionCheckLimit: usageRows.reduce((total, usage) => total + usage.actionCheckLimit, 0) || BETA_ACTION_CHECK_LIMIT,
    sandboxRunsUsed: usageRows.reduce((total, usage) => total + usage.sandboxRunsUsed, 0),
    sandboxRunLimit: usageRows.reduce((total, usage) => total + usage.sandboxRunLimit, 0) || BETA_SANDBOX_RUN_LIMIT,
    receiptsCreated: usageRows.reduce((total, usage) => total + usage.receiptsCreated, 0),
  });
}

export async function incrementActionCheckUsage(apiKeyId: string) {
  const db = await getDb();
  if (db) {
    try {
      await ensureD1DemoKey(db);
      await ensureD1UsageForKey(db, apiKeyId);
      await db
        .prepare(
          `UPDATE usage
           SET action_checks_used = action_checks_used + 1,
               updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
           WHERE api_key = ?`,
        )
        .bind(apiKeyId)
        .run();
      return getUsageForApiKey(apiKeyId);
    } catch (error) {
      warnD1Fallback("incrementSandboxRunUsage", error);
      // Fall back to memory if D1 has not been migrated yet.
    }
  }

  const usage = ensureUsageForKeyFallback(apiKeyId);
  usage.actionChecksUsed += 1;
  return publicUsage(usage);
}

export async function incrementSandboxRunUsage(apiKeyId: string) {
  const db = await getDb();
  if (db) {
    try {
      await ensureD1DemoKey(db);
      await ensureD1UsageForKey(db, apiKeyId);
      await db
        .prepare(
          `UPDATE usage
           SET sandbox_runs_used = sandbox_runs_used + 1,
               updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
           WHERE api_key = ?`,
        )
        .bind(apiKeyId)
        .run();
      return getUsageForApiKey(apiKeyId);
    } catch (error) {
      warnD1Fallback("incrementSandboxRunUsage", error);
      // Fall back to memory if D1 has not been migrated yet.
    }
  }

  const usage = ensureUsageForKeyFallback(apiKeyId);
  usage.sandboxRunsUsed += 1;
  return publicUsage(usage);
}

export async function createReceipt(
  action: AgentAction,
  evaluation: PolicyEvaluation,
  apiKeyId?: string,
  workspaceId?: string,
): Promise<ActionReceipt> {
  const receipt: ActionReceipt = {
    receiptId: randomId("aw_receipt"),
    workspaceId,
    projectId: action.projectId,
    sessionId: action.sessionId,
    agentId: action.agentId,
    actionType: action.actionType,
    tool: action.tool,
    target: action.target,
    rawAction: sanitizeAction(action),
    decision: evaluation.decision,
    risk: evaluation.risk,
    policy: evaluation.policy,
    feedback: evaluation.feedback,
    provider: evaluation.provider,
    mode: evaluation.mode,
    stdout: evaluation.stdout,
    stderr: evaluation.stderr,
    exitCode: evaluation.exitCode,
    durationMs: evaluation.durationMs,
    error: evaluation.error,
    createdAt: nowIso(),
  };

  const db = await getDb();
  if (db) {
    try {
      await ensureD1DemoKey(db);
      await db
        .prepare(
          `INSERT INTO receipts
           (receipt_id, api_key, workspace_id, project_id, session_id, agent_id, action_type, tool, target, raw_action, decision, risk, policy, feedback, provider, mode, stdout, stderr, exit_code, duration_ms, error, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        )
        .bind(
          receipt.receiptId,
          apiKeyId ?? null,
          workspaceId ?? null,
          receipt.projectId ?? null,
          receipt.sessionId ?? null,
          receipt.agentId ?? null,
          receipt.actionType,
          receipt.tool ?? null,
          receipt.target ?? null,
          JSON.stringify(receipt.rawAction),
          receipt.decision,
          receipt.risk,
          receipt.policy,
          receipt.feedback,
          receipt.provider ?? null,
          receipt.mode ?? null,
          receipt.stdout ?? null,
          receipt.stderr ?? null,
          receipt.exitCode ?? null,
          receipt.durationMs ?? null,
          receipt.error ?? null,
          receipt.createdAt,
        )
        .run();

      if (apiKeyId) {
        await db
          .prepare(
            `UPDATE usage
             SET receipts_created = receipts_created + 1,
                 updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
             WHERE api_key = ?`,
          )
          .bind(apiKeyId)
          .run();
      }

      return receipt;
    } catch (error) {
      warnD1Fallback("createReceipt", error);
      // D1 binding may be absent from local Next dev or present before migrations are applied.
    }
  }

  const state = getState();
  state.receipts.unshift(receipt);
  state.receipts = state.receipts.slice(0, 500);
  if (apiKeyId) {
    const usage = ensureUsageForKeyFallback(apiKeyId);
    usage.receiptsCreated += 1;
  }

  return receipt;
}

export async function listReceipts(workspaceId?: string) {
  const db = await getDb();
  if (db) {
    try {
      const statement = workspaceId
        ? db
            .prepare(
              `SELECT receipt_id, workspace_id, project_id, session_id, agent_id, action_type, tool, target, raw_action,
                  decision, risk, policy, feedback, provider, mode, stdout, stderr, exit_code, duration_ms, error, created_at
               FROM receipts
               WHERE workspace_id = ?
               ORDER BY created_at DESC
               LIMIT 500`,
            )
            .bind(workspaceId)
        : db.prepare(
            `SELECT receipt_id, workspace_id, project_id, session_id, agent_id, action_type, tool, target, raw_action,
                  decision, risk, policy, feedback, provider, mode, stdout, stderr, exit_code, duration_ms, error, created_at
             FROM receipts
             ORDER BY created_at DESC
             LIMIT 500`,
          );
      const result = await statement.all<ReceiptRow>();
      const d1Receipts = (result.results ?? []).map(mapReceiptRow);
      const memoryReceipts = getState().receipts.filter(
        (receipt) => !d1Receipts.some((d1Receipt) => d1Receipt.receiptId === receipt.receiptId),
      ).filter((receipt) => !workspaceId || receipt.workspaceId === workspaceId);
      return [...memoryReceipts, ...d1Receipts]
        .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt))
        .slice(0, 500);
    } catch (error) {
      warnD1Fallback("listReceipts", error);
      // Fall back to memory if D1 has not been migrated yet.
    }
  }

  return getState().receipts.filter((receipt) => !workspaceId || receipt.workspaceId === workspaceId);
}

export async function getReceipt(receiptId: string, workspaceId?: string) {
  const db = await getDb();
  const memoryReceipt = getState().receipts.find(
    (receipt) => receipt.receiptId === receiptId && (!workspaceId || receipt.workspaceId === workspaceId),
  );
  if (db) {
    try {
      const statement = workspaceId
        ? db
            .prepare(
              `SELECT receipt_id, workspace_id, project_id, session_id, agent_id, action_type, tool, target, raw_action,
                  decision, risk, policy, feedback, provider, mode, stdout, stderr, exit_code, duration_ms, error, created_at
               FROM receipts
               WHERE receipt_id = ? AND workspace_id = ?`,
            )
            .bind(receiptId, workspaceId)
        : db
            .prepare(
              `SELECT receipt_id, workspace_id, project_id, session_id, agent_id, action_type, tool, target, raw_action,
                  decision, risk, policy, feedback, provider, mode, stdout, stderr, exit_code, duration_ms, error, created_at
               FROM receipts
               WHERE receipt_id = ?`,
            )
            .bind(receiptId);
      const row = await statement.first<ReceiptRow>();
      return row ? mapReceiptRow(row) : memoryReceipt;
    } catch (error) {
      warnD1Fallback("getReceipt", error);
      // Fall back to memory if D1 has not been migrated yet.
    }
  }

  return memoryReceipt;
}

export async function updateReceiptExecutionResult(
  receiptId: string,
  workspaceId: string | undefined,
  result: Partial<Pick<ActionReceipt, "provider" | "mode" | "stdout" | "stderr" | "exitCode" | "durationMs" | "error" | "feedback">>,
) {
  const db = await getDb();
  if (db) {
    try {
      const sets: string[] = [];
      const values: unknown[] = [];
      if (result.provider !== undefined) { sets.push("provider = ?"); values.push(result.provider); }
      if (result.mode !== undefined) { sets.push("mode = ?"); values.push(result.mode); }
      if (result.stdout !== undefined) { sets.push("stdout = ?"); values.push(result.stdout); }
      if (result.stderr !== undefined) { sets.push("stderr = ?"); values.push(result.stderr); }
      if (result.exitCode !== undefined) { sets.push("exit_code = ?"); values.push(result.exitCode); }
      if (result.durationMs !== undefined) { sets.push("duration_ms = ?"); values.push(result.durationMs); }
      if (result.error !== undefined) { sets.push("error = ?"); values.push(result.error); }
      if (result.feedback !== undefined) { sets.push("feedback = ?"); values.push(result.feedback); }

      if (sets.length > 0) {
        const where = workspaceId ? "receipt_id = ? AND workspace_id = ?" : "receipt_id = ?";
        values.push(receiptId, ...(workspaceId ? [workspaceId] : []));
        await db.prepare(`UPDATE receipts SET ${sets.join(", ")} WHERE ${where}`).bind(...values).run();
      }
    } catch (error) {
      warnD1Fallback("updateReceiptExecutionResult", error);
    }
  }

  const memoryReceipt = getState().receipts.find(
    (receipt) => receipt.receiptId === receiptId && (!workspaceId || receipt.workspaceId === workspaceId),
  );
  if (memoryReceipt) {
    Object.assign(memoryReceipt, result);
  }
}

type CreateActionRunInput = {
  workspaceId: string;
  projectId?: string;
  apiKeyId?: string;
  receiptId?: string;
  approvalId?: string;
  action: AgentAction;
  evaluation: PolicyEvaluation;
  nextStep?: string;
  status: ActionRunStatus;
  executionTarget?: ExecutionTarget;
  sandboxProvider?: string;
  sandboxRunId?: string;
  stdout?: string;
  stderr?: string;
  exitCode?: number;
  executionLogs?: ExecutionEvent[];
  errorMessage?: string;
  durationMs?: number;
  completedAt?: string;
  approvalSource?: string;
};

export async function createActionRun(input: CreateActionRunInput): Promise<ActionRun> {
  const now = nowIso();
  const run: ActionRun = {
    runId: randomId("run"),
    workspaceId: input.workspaceId,
    projectId: input.projectId,
    apiKeyId: input.apiKeyId,
    receiptId: input.receiptId,
    approvalId: input.approvalId,
    action: sanitizeAction(input.action),
    decision: input.evaluation.decision,
    risk: input.evaluation.risk,
    policy: input.evaluation.policy,
    feedback: input.evaluation.feedback,
    nextStep: input.nextStep,
    status: input.status,
    executionTarget: input.executionTarget ?? "none",
    sandboxProvider: input.sandboxProvider ?? input.evaluation.provider,
    sandboxRunId: input.sandboxRunId,
    stdout: input.stdout,
    stderr: input.stderr,
    exitCode: input.exitCode,
    executionLogs: input.executionLogs,
    errorMessage: input.errorMessage,
    durationMs: input.durationMs,
    createdAt: now,
    updatedAt: now,
    completedAt: input.completedAt,
    approvalSource: input.approvalSource,
  };

  const db = await getDb();
  if (db) {
    try {
      await db
        .prepare(
          `INSERT INTO action_runs
           (run_id, workspace_id, project_id, api_key_id, receipt_id, approval_id,
            action_json, decision, risk, policy, feedback, next_step, status, execution_target,
            sandbox_provider, sandbox_run_id, stdout, stderr, exit_code, execution_logs_json,
            error_message, duration_ms, created_at, updated_at, completed_at, approval_source)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        )
        .bind(
          run.runId,
          run.workspaceId,
          run.projectId ?? null,
          run.apiKeyId ?? null,
          run.receiptId ?? null,
          run.approvalId ?? null,
          JSON.stringify(run.action),
          run.decision,
          run.risk,
          run.policy,
          run.feedback ?? null,
          run.nextStep ?? null,
          run.status,
          run.executionTarget,
          run.sandboxProvider ?? null,
          run.sandboxRunId ?? null,
          run.stdout ?? null,
          run.stderr ?? null,
          run.exitCode ?? null,
          run.executionLogs ? JSON.stringify(run.executionLogs) : null,
          run.errorMessage ?? null,
          run.durationMs ?? null,
          run.createdAt,
          run.updatedAt,
          run.completedAt ?? null,
          run.approvalSource ?? null,
        )
        .run();
    } catch (error) {
      warnD1Fallback("createActionRun", error);
    }
  }

  const state = getState();
  state.actionRuns.unshift(run);
  state.actionRuns = state.actionRuns.slice(0, 500);
  return run;
}

type ActionRunUpdate = Partial<{
  receiptId: string;
  approvalId: string;
  feedback: string;
  nextStep: string;
  status: ActionRunStatus;
  executionTarget: ExecutionTarget;
  sandboxProvider: string;
  sandboxRunId: string;
  stdout: string;
  stderr: string;
  exitCode: number;
  executionLogs: ExecutionEvent[];
  errorMessage: string;
  durationMs: number;
  completedAt: string;
  approvalSource: string;
}>;

export async function updateActionRun(
  runId: string,
  updates: ActionRunUpdate,
  workspaceId?: string,
): Promise<ActionRun | undefined> {
  const now = nowIso();
  const normalizedUpdates = { ...updates, updatedAt: now };

  const db = await getDb();
  if (db) {
    try {
      const columnMap: Record<string, string> = {
        receiptId: "receipt_id",
        approvalId: "approval_id",
        feedback: "feedback",
        nextStep: "next_step",
        status: "status",
        executionTarget: "execution_target",
        sandboxProvider: "sandbox_provider",
        sandboxRunId: "sandbox_run_id",
        stdout: "stdout",
        stderr: "stderr",
        exitCode: "exit_code",
        executionLogs: "execution_logs_json",
        errorMessage: "error_message",
        durationMs: "duration_ms",
        completedAt: "completed_at",
        approvalSource: "approval_source",
        updatedAt: "updated_at",
      };
      const sets: string[] = [];
      const values: unknown[] = [];

      for (const [key, value] of Object.entries(normalizedUpdates)) {
        const column = columnMap[key];
        if (!column || value === undefined) continue;
        sets.push(`${column} = ?`);
        values.push(key === "executionLogs" ? JSON.stringify(value) : value);
      }

      if (sets.length > 0) {
        const where = workspaceId ? "run_id = ? AND workspace_id = ?" : "run_id = ?";
        values.push(runId, ...(workspaceId ? [workspaceId] : []));
        await db.prepare(`UPDATE action_runs SET ${sets.join(", ")} WHERE ${where}`).bind(...values).run();
      }
    } catch (error) {
      warnD1Fallback("updateActionRun", error);
    }
  }

  const state = getState();
  const memoryRun = state.actionRuns.find((run) => run.runId === runId && (!workspaceId || run.workspaceId === workspaceId));
  if (memoryRun) {
    Object.assign(memoryRun, normalizedUpdates);
  }

  return getActionRun(runId, workspaceId);
}

export async function listActionRuns(
  workspaceId?: string,
  projectId?: string,
  limit = 100,
): Promise<ActionRun[]> {
  const db = await getDb();
  const memoryRuns = getState().actionRuns.filter(
    (run) => (!workspaceId || run.workspaceId === workspaceId) && (!projectId || run.projectId === projectId),
  );

  if (db) {
    try {
      const conditions: string[] = [];
      const values: unknown[] = [];
      if (workspaceId) { conditions.push("workspace_id = ?"); values.push(workspaceId); }
      if (projectId) { conditions.push("project_id = ?"); values.push(projectId); }
      values.push(limit);
      const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
      const result = await db
        .prepare(
          `SELECT run_id, workspace_id, project_id, api_key_id, receipt_id, approval_id,
                  action_json, decision, risk, policy, feedback, next_step, status, execution_target,
                  sandbox_provider, sandbox_run_id, stdout, stderr, exit_code, execution_logs_json,
                  error_message, duration_ms, created_at, updated_at, completed_at, approval_source
           FROM action_runs
           ${where}
           ORDER BY created_at DESC
           LIMIT ?`,
        )
        .bind(...values)
        .all<ActionRunRow>();
      const d1Runs = (result.results ?? []).map(mapActionRunRow);
      return [...memoryRuns.filter((run) => !d1Runs.some((d1Run) => d1Run.runId === run.runId)), ...d1Runs]
        .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt))
        .slice(0, limit);
    } catch (error) {
      warnD1Fallback("listActionRuns", error);
    }
  }

  return memoryRuns
    .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt))
    .slice(0, limit);
}

export async function getActionRun(runId: string, workspaceId?: string): Promise<ActionRun | undefined> {
  const db = await getDb();
  const memoryRun = getState().actionRuns.find(
    (run) => run.runId === runId && (!workspaceId || run.workspaceId === workspaceId),
  );

  if (db) {
    try {
      const statement = workspaceId
        ? db
            .prepare(
              `SELECT run_id, workspace_id, project_id, api_key_id, receipt_id, approval_id,
                      action_json, decision, risk, policy, feedback, next_step, status, execution_target,
                      sandbox_provider, sandbox_run_id, stdout, stderr, exit_code, execution_logs_json,
                      error_message, duration_ms, created_at, updated_at, completed_at, approval_source
               FROM action_runs
               WHERE run_id = ? AND workspace_id = ?`,
            )
            .bind(runId, workspaceId)
        : db
            .prepare(
              `SELECT run_id, workspace_id, project_id, api_key_id, receipt_id, approval_id,
                      action_json, decision, risk, policy, feedback, next_step, status, execution_target,
                      sandbox_provider, sandbox_run_id, stdout, stderr, exit_code, execution_logs_json,
                      error_message, duration_ms, created_at, updated_at, completed_at, approval_source
               FROM action_runs
               WHERE run_id = ?`,
            )
            .bind(runId);
      const row = await statement.first<ActionRunRow>();
      return row ? mapActionRunRow(row) : memoryRun;
    } catch (error) {
      warnD1Fallback("getActionRun", error);
    }
  }

  return memoryRun;
}

export async function appendExecutionEvent(
  runId: string,
  eventType: string,
  message?: string,
  metadata?: Record<string, unknown>,
): Promise<ExecutionEvent> {
  const event: ExecutionEvent = {
    eventId: randomId("evt"),
    runId,
    eventType,
    message,
    metadata,
    createdAt: nowIso(),
  };

  const db = await getDb();
  if (db) {
    try {
      await db
        .prepare(
          `INSERT INTO execution_events
           (event_id, run_id, event_type, message, metadata_json, created_at)
           VALUES (?, ?, ?, ?, ?, ?)`,
        )
        .bind(
          event.eventId,
          event.runId,
          event.eventType,
          event.message ?? null,
          event.metadata ? JSON.stringify(event.metadata).slice(0, 4096) : null,
          event.createdAt,
        )
        .run();
    } catch (error) {
      warnD1Fallback("appendExecutionEvent", error);
    }
  }

  const state = getState();
  state.executionEvents.push(event);
  const run = state.actionRuns.find((candidate) => candidate.runId === runId);
  if (run) run.executionLogs = [...(run.executionLogs ?? []), event];
  return event;
}

export async function listExecutionEvents(runId: string): Promise<ExecutionEvent[]> {
  const db = await getDb();
  const memoryEvents = getState().executionEvents.filter((event) => event.runId === runId);

  if (db) {
    try {
      const result = await db
        .prepare(
          `SELECT event_id, run_id, event_type, message, metadata_json, created_at
           FROM execution_events
           WHERE run_id = ?
           ORDER BY created_at ASC`,
        )
        .bind(runId)
        .all<ExecutionEventRow>();
      const d1Events = (result.results ?? []).map(mapExecutionEventRow);
      return [...d1Events, ...memoryEvents.filter((event) => !d1Events.some((d1Event) => d1Event.eventId === event.eventId))]
        .sort((a, b) => Date.parse(a.createdAt) - Date.parse(b.createdAt));
    } catch (error) {
      warnD1Fallback("listExecutionEvents", error);
    }
  }

  return memoryEvents.sort((a, b) => Date.parse(a.createdAt) - Date.parse(b.createdAt));
}

export async function createRunnerApprovalToken(opts: {
  runId: string;
  workspaceId: string;
  surface: string;
  runnerId?: string;
  expiresInMs?: number;
}): Promise<{ token: string; expiresAt: string }> {
  const token = `aw_rat_${randomToken(24)}`;
  const tokenHash = await sha256(token);
  const now = nowIso();
  const expiresAt = new Date(Date.now() + (opts.expiresInMs ?? 15 * 60 * 1000)).toISOString();
  const record: RunnerApprovalTokenRecord = {
    tokenId: randomId("rat"),
    runId: opts.runId,
    workspaceId: opts.workspaceId,
    tokenHash,
    surface: opts.surface,
    runnerId: opts.runnerId,
    expiresAt,
    createdAt: now,
  };

  const db = await getDb();
  if (db) {
    try {
      await db
        .prepare(
          `INSERT INTO runner_approval_tokens
           (token_id, run_id, workspace_id, token_hash, surface, runner_id, expires_at, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        )
        .bind(
          record.tokenId,
          record.runId,
          record.workspaceId,
          record.tokenHash,
          record.surface,
          record.runnerId ?? null,
          record.expiresAt,
          record.createdAt,
        )
        .run();
    } catch (error) {
      warnD1Fallback("createRunnerApprovalToken", error);
    }
  }

  getState().runnerApprovalTokens.unshift(record);
  getState().runnerApprovalTokens = getState().runnerApprovalTokens.slice(0, 500);
  return { token, expiresAt };
}

type ConsumeTokenFailure = { ok: false; error: string; status: number; code: string };
type ConsumeTokenSuccess = { ok: true; run: ActionRun; source: string; runnerId?: string };

export async function consumeRunnerApprovalToken(
  runId: string,
  token: string,
): Promise<ConsumeTokenSuccess | ConsumeTokenFailure> {
  const tokenHash = await sha256(token);
  const now = nowIso();
  const db = await getDb();

  if (db) {
    try {
      const row = await db
        .prepare(
          `SELECT token_id, run_id, workspace_id, token_hash, surface, runner_id, expires_at, used_at, created_at
           FROM runner_approval_tokens
           WHERE run_id = ? AND token_hash = ?`,
        )
        .bind(runId, tokenHash)
        .first<RunnerApprovalTokenRow>();

      if (!row) return { ok: false, error: "Runner approval token is invalid.", status: 401, code: "invalid_runner_token" };
      const record = mapRunnerApprovalTokenRow(row);
      if (record.usedAt) return { ok: false, error: "Runner approval token has already been used.", status: 409, code: "runner_token_already_used" };
      if (Date.parse(record.expiresAt) <= Date.now()) return { ok: false, error: "Runner approval token has expired.", status: 401, code: "expired_runner_token" };

      const run = await getActionRun(runId, record.workspaceId);
      if (!run) return { ok: false, error: "Run not found.", status: 404, code: "run_not_found" };
      if (run.status === "blocked" || run.decision === "block") {
        return { ok: false, error: "Blocked actions cannot be approved.", status: 409, code: "blocked_action_cannot_be_approved" };
      }
      if (run.status !== "waiting_approval") {
        return { ok: false, error: "Run is not waiting for approval.", status: 409, code: "run_not_waiting_approval" };
      }

      const updateResult = await db
        .prepare("UPDATE runner_approval_tokens SET used_at = ? WHERE token_id = ? AND used_at IS NULL")
        .bind(now, record.tokenId)
        .run();
      const changes = (updateResult as { meta?: { changes?: number } }).meta?.changes;
      if (typeof changes === "number" && changes < 1) {
        return { ok: false, error: "Runner approval token has already been used.", status: 409, code: "runner_token_already_used" };
      }

      return { ok: true, run, source: `runner_${record.surface}`, runnerId: record.runnerId };
    } catch (error) {
      warnD1Fallback("consumeRunnerApprovalToken", error);
    }
  }

  const record = getState().runnerApprovalTokens.find((candidate) => candidate.runId === runId && candidate.tokenHash === tokenHash);
  if (!record) return { ok: false, error: "Runner approval token is invalid.", status: 401, code: "invalid_runner_token" };
  if (record.usedAt) return { ok: false, error: "Runner approval token has already been used.", status: 409, code: "runner_token_already_used" };
  if (Date.parse(record.expiresAt) <= Date.now()) return { ok: false, error: "Runner approval token has expired.", status: 401, code: "expired_runner_token" };

  const run = await getActionRun(runId, record.workspaceId);
  if (!run) return { ok: false, error: "Run not found.", status: 404, code: "run_not_found" };
  if (run.status === "blocked" || run.decision === "block") {
    return { ok: false, error: "Blocked actions cannot be approved.", status: 409, code: "blocked_action_cannot_be_approved" };
  }
  if (run.status !== "waiting_approval") {
    return { ok: false, error: "Run is not waiting for approval.", status: 409, code: "run_not_waiting_approval" };
  }

  record.usedAt = now;
  return { ok: true, run, source: `runner_${record.surface}`, runnerId: record.runnerId };
}

export async function continueActionRunAfterApproval(
  runId: string,
  workspaceId: string,
  resolvedReason?: string,
  approvalSource = "dashboard",
): Promise<ActionRun | undefined> {
  const run = await getActionRun(runId, workspaceId);
  if (!run || run.status !== "waiting_approval") return run;

  if (run.approvalId) {
    await resolveApproval(run.approvalId, workspaceId, "approved", resolvedReason);
  }

  await appendExecutionEvent(runId, "approval_approved", "Human approval was recorded.", { source: approvalSource });
  return updateActionRun(
    runId,
    {
      status: "approved",
      approvalSource,
      nextStep: "Approval recorded. AgentWing is continuing the guarded execution path.",
    },
    workspaceId,
  );
}

export async function rejectActionRun(
  runId: string,
  workspaceId: string,
  resolvedReason?: string,
  approvalSource = "dashboard",
): Promise<ActionRun | undefined> {
  const run = await getActionRun(runId, workspaceId);
  if (!run) return undefined;

  if (run.approvalId && run.status === "waiting_approval") {
    await resolveApproval(run.approvalId, workspaceId, "rejected", resolvedReason);
  }

  await appendExecutionEvent(runId, "approval_rejected", "Human rejected this action.", { source: approvalSource });
  return updateActionRun(
    runId,
    {
      status: "rejected",
      approvalSource,
      executionTarget: "skipped",
      nextStep: "Action rejected. Do not execute this operation.",
      completedAt: nowIso(),
    },
    workspaceId,
  );
}

export async function getActionRunStats(workspaceId?: string): Promise<ActionRunStats> {
  const runs = await listActionRuns(workspaceId, undefined, 500);
  return {
    total: runs.length,
    completed: runs.filter((run) => run.status === "completed").length,
    blocked: runs.filter((run) => run.status === "blocked").length,
    waitingApproval: runs.filter((run) => run.status === "waiting_approval").length,
    sandboxRuns: runs.filter((run) => run.executionTarget === "sandbox").length,
    externalRunnerRequired: runs.filter((run) => run.status === "external_runner_required").length,
  };
}

export async function getReceiptStats(workspaceId?: string): Promise<ReceiptStats> {
  const db = await getDb();
  if (db) {
    try {
      const receipts = await listReceipts(workspaceId);
      return {
        total: receipts.length,
        blocked: receipts.filter((receipt) => receipt.decision === "block").length,
        approvalRequired: receipts.filter((receipt) => receipt.decision === "approval_required").length,
        sandboxRequired: receipts.filter((receipt) => receipt.decision === "sandbox_required").length,
        receiptsCreated: receipts.length,
      };
    } catch (error) {
      warnD1Fallback("getReceiptStats", error);
      // Fall back to memory if D1 has not been migrated yet.
    }
  }

  const receipts = getState().receipts.filter((receipt) => !workspaceId || receipt.workspaceId === workspaceId);
  return {
    total: receipts.length,
    blocked: receipts.filter((receipt) => receipt.decision === "block").length,
    approvalRequired: receipts.filter((receipt) => receipt.decision === "approval_required").length,
    sandboxRequired: receipts.filter((receipt) => receipt.decision === "sandbox_required").length,
    receiptsCreated: receipts.length,
  };
}

async function getWorkspaceSandboxRow(db: AgentWingD1Database, workspaceId: string) {
  return db
    .prepare(
      `SELECT mode, e2b_key_saved, e2b_key_prefix, e2b_key_last4,
              connected_at, updated_at, last_test_status, last_tested_at, last_error
       FROM workspace_sandbox_configs
       WHERE workspace_id = ?`,
    )
    .bind(workspaceId)
    .first<SandboxRow & { last_error?: string | null }>();
}

export async function getSandboxConfigForWorkspace(workspaceId: string): Promise<SandboxProviderConfig> {
  const db = await getDb();
  if (db) {
    try {
      const row = await getWorkspaceSandboxRow(db, workspaceId);
      return publicSandboxConfig(row);
    } catch (error) {
      warnD1Fallback("getSandboxConfigForWorkspace", error);
    }
  }
  const { e2bApiKey, ...publicConfig } = getState().sandbox;
  void e2bApiKey;
  return publicConfig;
}

export async function getSandboxConfig(apiKeyId = DEMO_API_KEY) {
  const workspaceId = workspaceIdFromSandboxOwner(apiKeyId);
  if (workspaceId) return getSandboxConfigForWorkspace(workspaceId);

  const db = await getDb();
  if (db) {
    try {
      await ensureD1DemoKey(db);
      const row = await db
        .prepare(
          `SELECT mode, e2b_key_saved, e2b_key_prefix, e2b_key_last4,
                  connected_at, updated_at, last_test_status, last_tested_at
           FROM sandbox_configs
           WHERE api_key = ?`,
        )
        .bind(apiKeyId)
        .first<SandboxRow>();
      return publicSandboxConfig(row);
    } catch (error) {
      warnD1Fallback("getSandboxConfig", error);
      // Fall back to memory if D1 has not been migrated yet.
    }
  }

  const { e2bApiKey, ...publicConfig } = getState().sandbox;
  void e2bApiKey;
  return publicConfig;
}

export async function saveE2BKey(apiKey: string, ownerApiKeyId = DEMO_API_KEY) {
  const trimmed = normalizeStoredE2BKey(apiKey);
  if (!trimmed) {
    throw new Error("E2B API key is required.");
  }
  if (isPlaceholderE2BKey(trimmed)) {
    throw new Error("Replace the placeholder with a real E2B API key before saving.");
  }
  if (/\s/.test(trimmed)) {
    throw new Error("Save the raw E2B API key without Authorization, Bearer, or header prefixes.");
  }

  const db = await getDb();
  const workspaceId = workspaceIdFromSandboxOwner(ownerApiKeyId);
  if (db) {
    try {
      const encrypted = await encryptSandboxSecret(trimmed);
      const prefix = safeE2BKeyPrefix(trimmed) ?? null;
      const last4 = trimmed.slice(-4);

      if (workspaceId) {
        // Use workspace_sandbox_configs — no FK constraint on api_keys
        await db
          .prepare(
            `INSERT INTO workspace_sandbox_configs
             (workspace_id, mode, e2b_key_saved, e2b_key_prefix, e2b_key_last4, e2b_key_encrypted, connected_at, updated_at)
             VALUES (?, 'e2b_byok', 1, ?, ?, ?, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'), strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
             ON CONFLICT(workspace_id) DO UPDATE SET
               mode = 'e2b_byok',
               e2b_key_saved = 1,
               e2b_key_prefix = excluded.e2b_key_prefix,
               e2b_key_last4 = excluded.e2b_key_last4,
               e2b_key_encrypted = excluded.e2b_key_encrypted,
               connected_at = COALESCE(workspace_sandbox_configs.connected_at, excluded.connected_at),
               updated_at = excluded.updated_at,
               last_error = NULL`,
          )
          .bind(workspaceId, prefix, last4, encrypted)
          .run();
      } else {
        await ensureD1DemoKey(db);
        await db
          .prepare(
            `INSERT INTO sandbox_configs
             (api_key, workspace_id, mode, e2b_key_saved, e2b_key_prefix, e2b_key_last4, e2b_key_encrypted, connected_at, updated_at)
             VALUES (?, NULL, 'e2b_byok', 1, ?, ?, ?, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'), strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
             ON CONFLICT(api_key) DO UPDATE SET
               mode = 'e2b_byok',
               e2b_key_saved = 1,
               e2b_key_prefix = excluded.e2b_key_prefix,
               e2b_key_last4 = excluded.e2b_key_last4,
               e2b_key_encrypted = excluded.e2b_key_encrypted,
               connected_at = COALESCE(sandbox_configs.connected_at, excluded.connected_at),
               updated_at = excluded.updated_at`,
          )
          .bind(ownerApiKeyId, prefix, last4, encrypted)
          .run();
      }

      return getSandboxConfig(ownerApiKeyId);
    } catch (error) {
      warnD1Fallback("saveE2BKey", error);
      // Fall back to memory if D1 has not been migrated yet.
    }
  }

  const state = getState();
  state.sandbox = {
    ...state.sandbox,
    provider: "e2b-byok",
    connected: true,
    mode: "e2b_byok",
    byok: true,
    sandboxMode: "BYOK",
    e2bApiKey: trimmed,
    keyPrefix: safeE2BKeyPrefix(trimmed),
    keyLast4: trimmed.slice(-4),
    createdAt: state.sandbox.createdAt ?? nowIso(),
    updatedAt: nowIso(),
    runtimeExecutionEnabled: true,
    e2bKeySaved: true,
    e2bKeyLast4: trimmed.slice(-4),
    e2bKeyUpdatedAt: nowIso(),
  };

  return getSandboxConfig(ownerApiKeyId);
}

export async function recordE2BTestResult(status: SandboxTestStatus, ownerApiKeyId = DEMO_API_KEY, lastError?: string) {
  const db = await getDb();
  const workspaceId = workspaceIdFromSandboxOwner(ownerApiKeyId);
  if (db) {
    try {
      if (workspaceId) {
        await db
          .prepare(
            `INSERT INTO workspace_sandbox_configs
             (workspace_id, mode, e2b_key_saved, last_test_status, last_tested_at, last_error)
             VALUES (?, 'none', 0, ?, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'), ?)
             ON CONFLICT(workspace_id) DO UPDATE SET
               last_test_status = excluded.last_test_status,
               last_tested_at = excluded.last_tested_at,
               last_error = CASE WHEN excluded.last_error IS NOT NULL THEN excluded.last_error ELSE workspace_sandbox_configs.last_error END`,
          )
          .bind(workspaceId, status, lastError ?? null)
          .run();
      } else {
        await ensureD1DemoKey(db);
        await db
          .prepare(
            `INSERT INTO sandbox_configs
             (api_key, workspace_id, mode, e2b_key_saved, last_test_status, last_tested_at)
             VALUES (?, NULL, 'none', 0, ?, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
             ON CONFLICT(api_key) DO UPDATE SET
               last_test_status = excluded.last_test_status,
               last_tested_at = excluded.last_tested_at`,
          )
          .bind(ownerApiKeyId, status)
          .run();
      }

      return getSandboxConfig(ownerApiKeyId);
    } catch (error) {
      warnD1Fallback("recordE2BTestResult", error);
      // Fall back to memory if D1 has not been migrated yet.
    }
  }

  const state = getState();
  const testedAt = nowIso();
  state.sandbox = {
    ...state.sandbox,
    lastTestStatus: status,
    lastTestedAt: testedAt,
  };

  return getSandboxConfig(ownerApiKeyId);
}

export async function removeE2BKey(ownerApiKeyId = DEMO_API_KEY) {
  const db = await getDb();
  const workspaceId = workspaceIdFromSandboxOwner(ownerApiKeyId);
  if (db) {
    try {
      if (workspaceId) {
        await db
          .prepare(
            `INSERT INTO workspace_sandbox_configs
             (workspace_id, mode, e2b_key_saved, e2b_key_prefix, e2b_key_last4, e2b_key_encrypted, connected_at, updated_at, last_test_status, last_tested_at, last_error)
             VALUES (?, 'none', 0, NULL, NULL, NULL, NULL, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'), NULL, NULL, NULL)
             ON CONFLICT(workspace_id) DO UPDATE SET
               mode = 'none',
               e2b_key_saved = 0,
               e2b_key_prefix = NULL,
               e2b_key_last4 = NULL,
               e2b_key_encrypted = NULL,
               connected_at = NULL,
               last_test_status = NULL,
               last_tested_at = NULL,
               last_error = NULL,
               updated_at = excluded.updated_at`,
          )
          .bind(workspaceId)
          .run();
      } else {
        await ensureD1DemoKey(db);
        await db
          .prepare(
            `INSERT INTO sandbox_configs
             (api_key, workspace_id, mode, e2b_key_saved, e2b_key_prefix, e2b_key_last4, e2b_key_encrypted, connected_at, updated_at)
             VALUES (?, NULL, 'none', 0, NULL, NULL, NULL, NULL, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
             ON CONFLICT(api_key) DO UPDATE SET
               mode = 'none',
               e2b_key_saved = 0,
               e2b_key_prefix = NULL,
               e2b_key_last4 = NULL,
               e2b_key_encrypted = NULL,
               connected_at = NULL,
               last_test_status = NULL,
               last_tested_at = NULL,
               updated_at = excluded.updated_at`,
          )
          .bind(ownerApiKeyId)
          .run();
      }

      return getSandboxConfig(ownerApiKeyId);
    } catch (error) {
      warnD1Fallback("removeE2BKey", error);
      // Fall back to memory if D1 has not been migrated yet.
    }
  }

  const state = getState();
  const updatedAt = nowIso();
  state.sandbox = {
    provider: "e2b-byok",
    connected: false,
    mode: "none",
    byok: true,
    sandboxMode: "none",
    runtimeExecutionEnabled: false,
    e2bKeySaved: false,
    updatedAt,
    e2bKeyUpdatedAt: updatedAt,
  };

  return getSandboxConfig(ownerApiKeyId);
}

export async function hasSavedE2BKey(apiKeyId = DEMO_API_KEY) {
  const config = await getSandboxConfig(apiKeyId);
  return Boolean(config.e2bKeySaved);
}

async function getD1E2BApiKey(db: AgentWingD1Database, apiKeyId: string) {
  const row = await db
    .prepare(
      "SELECT mode, e2b_key_saved, e2b_key_last4, e2b_key_encrypted, updated_at FROM sandbox_configs WHERE api_key = ?",
    )
    .bind(apiKeyId)
    .first<SandboxRow>();

  if (!row?.e2b_key_saved || row.mode !== "e2b_byok") return undefined;
  return decryptSandboxSecret(row.e2b_key_encrypted);
}

async function getD1WorkspaceE2BApiKey(db: AgentWingD1Database, workspaceId: string) {
  const row = await db
    .prepare(
      "SELECT mode, e2b_key_saved, e2b_key_encrypted FROM workspace_sandbox_configs WHERE workspace_id = ?",
    )
    .bind(workspaceId)
    .first<SandboxRow>();

  if (!row?.e2b_key_saved || row.mode !== "e2b_byok") return undefined;
  return decryptSandboxSecret(row.e2b_key_encrypted);
}

export async function getE2BApiKeyForExecution(apiKeyId = DEMO_API_KEY, workspaceId?: string) {
  const db = await getDb();
  let useMemoryFallback = !db;

  if (db) {
    try {
      // Prefer workspace_sandbox_configs for real users
      if (workspaceId) {
        const workspaceKey = await getD1WorkspaceE2BApiKey(db, workspaceId);
        if (workspaceKey) return workspaceKey;
      }

      // Also check via synthetic owner key path
      const derivedWorkspaceId = workspaceIdFromSandboxOwner(apiKeyId);
      if (derivedWorkspaceId && derivedWorkspaceId !== workspaceId) {
        const key = await getD1WorkspaceE2BApiKey(db, derivedWorkspaceId);
        if (key) return key;
      }

      if (apiKeyId !== DEMO_API_KEY) {
        await ensureD1DemoKey(db);
        const projectKey = await getD1E2BApiKey(db, apiKeyId);
        if (projectKey) return projectKey;
      }

      const demoKey = await getD1E2BApiKey(db, DEMO_API_KEY);
      if (demoKey) return demoKey;
    } catch (error) {
      warnD1Fallback("getE2BApiKeyForExecution", error);
      useMemoryFallback = true;
      // Fall back to memory/env in local development if D1 is not ready.
    }
  }

  if (useMemoryFallback) {
    const devStoredKey = getState().sandbox.e2bApiKey?.trim();
    if (devStoredKey && !isPlaceholderE2BKey(devStoredKey)) return devStoredKey;
  }

  const envKey = process.env.E2B_API_KEY?.trim();
  return envKey && !isPlaceholderE2BKey(envKey) ? envKey : undefined;
}

export async function revokeApiKey(apiKeyId: string, workspaceId?: string): Promise<boolean> {
  const db = await getDb();
  if (db) {
    try {
      const result = await db
        .prepare(
          workspaceId
            ? "UPDATE api_keys SET revoked_at = ? WHERE api_key_id = ? AND workspace_id = ? AND revoked_at IS NULL"
            : "UPDATE api_keys SET revoked_at = ? WHERE api_key_id = ? AND revoked_at IS NULL",
        )
        .bind(nowIso(), apiKeyId, ...(workspaceId ? [workspaceId] : []))
        .run();
      return Boolean(result.success);
    } catch (error) {
      warnD1Fallback("revokeApiKey", error);
    }
  }

  const state = getState();
  const record = state.apiKeysById[apiKeyId];
  if (record && (!workspaceId || record.workspaceId === workspaceId)) {
    record.revokedAt = nowIso();
    return true;
  }
  return false;
}

export async function listCustomPolicies(workspaceId: string, projectId?: string): Promise<import("./agentwingTypes").CustomPolicy[]> {
  const db = await getDb();
  if (db) {
    try {
      const conditions = ["workspace_id = ?"];
      const values: string[] = [workspaceId];
      if (projectId) {
        conditions.push("(project_id = ? OR project_id IS NULL)");
        values.push(projectId);
      }
      const result = await db
        .prepare(
          `SELECT policy_id, workspace_id, project_id, name, description, action_type, tool,
                  target_pattern, command_pattern, decision, risk, priority, enabled, feedback,
                  created_at, updated_at
           FROM custom_policies
           WHERE ${conditions.join(" AND ")}
           ORDER BY priority ASC, created_at DESC`,
        )
        .bind(...values)
        .all<CustomPolicyRow>();
      return (result.results ?? []).map(mapCustomPolicyRow);
    } catch {
      return [];
    }
  }
  return [];
}

export async function createCustomPolicy(
  workspaceId: string,
  data: {
    projectId?: string;
    name: string;
    description?: string;
    actionType?: string;
    tool?: string;
    targetPattern?: string;
    commandPattern?: string;
    decision: string;
    risk: string;
    priority?: number;
    feedback?: string;
  },
): Promise<import("./agentwingTypes").CustomPolicy> {
  const policyId = randomId("policy");
  const now = nowIso();
  const db = await getDb();
  if (db) {
    await db
      .prepare(
        `INSERT INTO custom_policies
         (policy_id, workspace_id, project_id, name, description, action_type, tool,
          target_pattern, command_pattern, decision, risk, priority, enabled, feedback, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?, ?)`,
      )
      .bind(
        policyId, workspaceId, data.projectId ?? null, data.name,
        data.description ?? null, data.actionType ?? null, data.tool ?? null,
        data.targetPattern ?? null, data.commandPattern ?? null,
        data.decision, data.risk, data.priority ?? 100,
        data.feedback ?? null, now, now,
      )
      .run();
  }
  return {
    policyId,
    workspaceId,
    projectId: data.projectId,
    name: data.name,
    description: data.description,
    actionType: data.actionType,
    tool: data.tool,
    targetPattern: data.targetPattern,
    commandPattern: data.commandPattern,
    decision: data.decision as import("./agentwingTypes").AgentWingDecision,
    risk: data.risk as import("./agentwingTypes").AgentWingRisk,
    priority: data.priority ?? 100,
    enabled: true,
    feedback: data.feedback,
    createdAt: now,
    updatedAt: now,
  };
}

export async function updateCustomPolicy(
  policyId: string,
  workspaceId: string,
  data: Partial<{
    name: string;
    description: string;
    actionType: string;
    tool: string;
    targetPattern: string;
    commandPattern: string;
    decision: string;
    risk: string;
    priority: number;
    enabled: boolean;
    feedback: string;
  }>,
): Promise<boolean> {
  const db = await getDb();
  if (!db) return false;
  const now = nowIso();
  const sets: string[] = ["updated_at = ?"];
  const values: unknown[] = [now];
  if (data.name !== undefined) { sets.push("name = ?"); values.push(data.name); }
  if (data.description !== undefined) { sets.push("description = ?"); values.push(data.description); }
  if (data.actionType !== undefined) { sets.push("action_type = ?"); values.push(data.actionType || null); }
  if (data.tool !== undefined) { sets.push("tool = ?"); values.push(data.tool || null); }
  if (data.targetPattern !== undefined) { sets.push("target_pattern = ?"); values.push(data.targetPattern || null); }
  if (data.commandPattern !== undefined) { sets.push("command_pattern = ?"); values.push(data.commandPattern || null); }
  if (data.decision !== undefined) { sets.push("decision = ?"); values.push(data.decision); }
  if (data.risk !== undefined) { sets.push("risk = ?"); values.push(data.risk); }
  if (data.priority !== undefined) { sets.push("priority = ?"); values.push(data.priority); }
  if (data.enabled !== undefined) { sets.push("enabled = ?"); values.push(data.enabled ? 1 : 0); }
  if (data.feedback !== undefined) { sets.push("feedback = ?"); values.push(data.feedback || null); }
  values.push(policyId, workspaceId);
  try {
    const result = await db
      .prepare(`UPDATE custom_policies SET ${sets.join(", ")} WHERE policy_id = ? AND workspace_id = ?`)
      .bind(...values)
      .run();
    return Boolean(result.success);
  } catch {
    return false;
  }
}

export async function deleteCustomPolicy(policyId: string, workspaceId: string): Promise<boolean> {
  const db = await getDb();
  if (!db) return false;
  try {
    const result = await db
      .prepare("DELETE FROM custom_policies WHERE policy_id = ? AND workspace_id = ?")
      .bind(policyId, workspaceId)
      .run();
    return Boolean(result.success);
  } catch {
    return false;
  }
}

function wildcardToRegex(pattern: string): RegExp {
  const escaped = pattern.replace(/[.+^${}()|[\]\\]/g, "\\$&").replace(/\*/g, ".*").replace(/\?/g, ".");
  return new RegExp(escaped, "i");
}

function policyMatches(policy: import("./agentwingTypes").CustomPolicy, action: import("./agentwingTypes").AgentAction): boolean {
  if (policy.actionType && policy.actionType !== action.actionType) return false;
  if (policy.tool) {
    const actionTool = (action.tool ?? "").toLowerCase();
    if (!actionTool.includes(policy.tool.toLowerCase())) return false;
  }
  if (policy.targetPattern && action.target) {
    if (!wildcardToRegex(policy.targetPattern).test(action.target)) return false;
  }
  if (policy.commandPattern && (action.command ?? action.target)) {
    if (!wildcardToRegex(policy.commandPattern).test(action.command ?? action.target ?? "")) return false;
  }
  return true;
}

export async function matchCustomPolicy(
  action: import("./agentwingTypes").AgentAction,
  workspaceId: string,
  projectId?: string,
): Promise<import("./agentwingTypes").CustomPolicy | undefined> {
  const policies = await listCustomPolicies(workspaceId, projectId);
  const enabled = policies.filter((p) => p.enabled).sort((a, b) => a.priority - b.priority);
  return enabled.find((p) => policyMatches(p, action));
}

export async function revokeAllApiKeys(workspaceId: string): Promise<number> {
  const db = await getDb();
  if (!db) return 0;
  try {
    await db
      .prepare("UPDATE api_keys SET revoked_at = ? WHERE workspace_id = ? AND revoked_at IS NULL AND disabled_at IS NULL AND api_key != ?")
      .bind(nowIso(), workspaceId, DEMO_API_KEY)
      .run();
    return 1;
  } catch {
    return 0;
  }
}

export async function requestAccountDeletion(userId: string, workspaceId?: string) {
  const now = nowIso();
  const db = await getDb();

  if (db) {
    try {
      const userColumns = await getD1TableColumns(db, "users");
      const userSets: string[] = [];
      const userValues: unknown[] = [];

      if (userColumns.has("status")) {
        userSets.push("status = ?");
        userValues.push("deletion_requested");
      }
      if (userColumns.has("delete_requested_at")) {
        userSets.push("delete_requested_at = COALESCE(delete_requested_at, ?)");
        userValues.push(now);
      }

      if (userSets.length > 0) {
        userValues.push(userId);
        await db
          .prepare(
            `UPDATE users
             SET ${userSets.join(", ")}
             WHERE user_id = ?${userColumns.has("deleted_at") ? " AND deleted_at IS NULL" : ""}`,
          )
          .bind(...userValues)
          .run();
      }

      if (workspaceId) {
        const workspaceColumns = await getD1TableColumns(db, "workspaces");
        const workspaceSets: string[] = [];
        const workspaceValues: unknown[] = [];

        if (workspaceColumns.has("status")) {
          workspaceSets.push("status = ?");
          workspaceValues.push("deletion_requested");
        }
        if (workspaceColumns.has("delete_requested_at")) {
          workspaceSets.push("delete_requested_at = COALESCE(delete_requested_at, ?)");
          workspaceValues.push(now);
        }

        if (workspaceSets.length > 0) {
          workspaceValues.push(workspaceId, userId);
          await db
            .prepare(
              `UPDATE workspaces
               SET ${workspaceSets.join(", ")}
               WHERE workspace_id = ? AND owner_user_id = ?${workspaceColumns.has("deleted_at") ? " AND deleted_at IS NULL" : ""}`,
            )
            .bind(...workspaceValues)
            .run();
        }
      }

      return { userId, workspaceId, deleteRequestedAt: now };
    } catch (error) {
      warnD1Fallback("requestAccountDeletion", error);
    }
  }

  const state = getState();
  const user = state.usersById[userId];
  if (user) {
    user.status = "deletion_requested";
    user.deleteRequestedAt ??= now;
  }

  if (workspaceId) {
    const workspace = state.workspacesById[workspaceId];
    if (workspace?.ownerUserId === userId) {
      workspace.status = "deletion_requested";
      workspace.deleteRequestedAt ??= now;
    }
  }

  return { userId, workspaceId, deleteRequestedAt: now };
}

export type ApprovalRecord = {
  approvalId: string;
  workspaceId: string;
  projectId?: string;
  receiptId?: string;
  actionJson: Record<string, unknown>;
  status: "pending" | "approved" | "rejected" | "expired";
  decision: string;
  risk: string;
  policy?: string;
  reason?: string;
  requestedByAgent?: string;
  resolvedBy?: string;
  resolvedReason?: string;
  createdAt: string;
  updatedAt: string;
  resolvedAt?: string;
  expiresAt?: string;
};

type ApprovalRow = {
  approval_id: string;
  workspace_id: string;
  project_id?: string | null;
  receipt_id?: string | null;
  action_json: string;
  status: string;
  decision: string;
  risk: string;
  policy?: string | null;
  reason?: string | null;
  requested_by_agent?: string | null;
  resolved_by?: string | null;
  resolved_reason?: string | null;
  created_at: string;
  updated_at: string;
  resolved_at?: string | null;
  expires_at?: string | null;
};

function mapApprovalRow(row: ApprovalRow): ApprovalRecord {
  return {
    approvalId: row.approval_id,
    workspaceId: row.workspace_id,
    projectId: row.project_id ?? undefined,
    receiptId: row.receipt_id ?? undefined,
    actionJson: (() => { try { return JSON.parse(row.action_json); } catch { return {}; } })(),
    status: row.status as ApprovalRecord["status"],
    decision: row.decision,
    risk: row.risk,
    policy: row.policy ?? undefined,
    reason: row.reason ?? undefined,
    requestedByAgent: row.requested_by_agent ?? undefined,
    resolvedBy: row.resolved_by ?? undefined,
    resolvedReason: row.resolved_reason ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    resolvedAt: row.resolved_at ?? undefined,
    expiresAt: row.expires_at ?? undefined,
  };
}

export async function createApproval(opts: {
  workspaceId: string;
  projectId?: string;
  receiptId?: string;
  action: import("./agentwingTypes").AgentAction;
  decision: string;
  risk: string;
  policy?: string;
  reason?: string;
  requestedByAgent?: string;
}): Promise<ApprovalRecord> {
  const approvalId = randomId("appr");
  const now = nowIso();
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
  const record: ApprovalRecord = {
    approvalId,
    workspaceId: opts.workspaceId,
    projectId: opts.projectId,
    receiptId: opts.receiptId,
    actionJson: sanitizeAction(opts.action) as Record<string, unknown>,
    status: "pending",
    decision: opts.decision,
    risk: opts.risk,
    policy: opts.policy,
    reason: opts.reason,
    requestedByAgent: opts.requestedByAgent,
    createdAt: now,
    updatedAt: now,
    expiresAt,
  };

  const db = await getDb();
  if (db) {
    try {
      await db
        .prepare(
          `INSERT INTO approvals
           (approval_id, workspace_id, project_id, receipt_id, action_json, status, decision, risk, policy, reason, requested_by_agent, created_at, updated_at, expires_at)
           VALUES (?, ?, ?, ?, ?, 'pending', ?, ?, ?, ?, ?, ?, ?, ?)`,
        )
        .bind(
          approvalId, opts.workspaceId, opts.projectId ?? null, opts.receiptId ?? null,
          JSON.stringify(record.actionJson), opts.decision, opts.risk,
          opts.policy ?? null, opts.reason ?? null, opts.requestedByAgent ?? null,
          now, now, expiresAt,
        )
        .run();
    } catch {
      // non-fatal
    }
  }
  return record;
}

export async function listApprovals(workspaceId: string, status?: string): Promise<ApprovalRecord[]> {
  const db = await getDb();
  if (!db) return [];
  try {
    const conditions = ["workspace_id = ?"];
    const values: string[] = [workspaceId];
    if (status) { conditions.push("status = ?"); values.push(status); }
    const result = await db
      .prepare(`SELECT * FROM approvals WHERE ${conditions.join(" AND ")} ORDER BY created_at DESC LIMIT 100`)
      .bind(...values)
      .all<ApprovalRow>();
    return (result.results ?? []).map(mapApprovalRow);
  } catch {
    return [];
  }
}

export async function resolveApproval(approvalId: string, workspaceId: string, status: "approved" | "rejected", resolvedReason?: string): Promise<boolean> {
  const db = await getDb();
  if (!db) return false;
  const now = nowIso();
  try {
    const result = await db
      .prepare("UPDATE approvals SET status = ?, resolved_at = ?, updated_at = ?, resolved_reason = ? WHERE approval_id = ? AND workspace_id = ? AND status = 'pending'")
      .bind(status, now, now, resolvedReason ?? null, approvalId, workspaceId)
      .run();
    return Boolean(result.success);
  } catch {
    return false;
  }
}

export async function getAdminStats() {
  const db = await getDb();
  if (!db) return null;
  try {
    const todayStart = new Date();
    todayStart.setUTCHours(0, 0, 0, 0);
    const todayIso = todayStart.toISOString();

    const count = async (sql: string, ...values: unknown[]) => {
      const statement = db.prepare(sql);
      const row = values.length
        ? await statement.bind(...values).first<{ count: number }>()
        : await statement.first<{ count: number }>();
      return row?.count ?? 0;
    };

    const userColumns = await getD1TableColumns(db, "users");
    const workspaceColumns = await getD1TableColumns(db, "workspaces");
    const hasUserStatus = userColumns.has("status");
    const hasUserDeleteRequestedAt = userColumns.has("delete_requested_at");
    const hasUserDeletedAt = userColumns.has("deleted_at");
    const hasWorkspaceStatus = workspaceColumns.has("status");
    const hasWorkspaceDeleteRequestedAt = workspaceColumns.has("delete_requested_at");
    const hasWorkspaceDeletedAt = workspaceColumns.has("deleted_at");

    const userActiveWhere = [
      hasUserStatus ? "COALESCE(status, 'active') = 'active'" : undefined,
      hasUserDeleteRequestedAt ? "delete_requested_at IS NULL" : undefined,
      hasUserDeletedAt ? "deleted_at IS NULL" : undefined,
    ].filter(Boolean).join(" AND ") || "1 = 1";
    const userDeletionRequestedWhere = [
      [
        hasUserStatus ? "status = 'deletion_requested'" : undefined,
        hasUserDeleteRequestedAt ? "delete_requested_at IS NOT NULL" : undefined,
      ].filter(Boolean).join(" OR "),
      hasUserDeletedAt ? "deleted_at IS NULL" : undefined,
    ].filter(Boolean).map((part) => `(${part})`).join(" AND ");
    const userDeletedWhere = [
      hasUserStatus ? "status = 'deleted'" : undefined,
      hasUserDeletedAt ? "deleted_at IS NOT NULL" : undefined,
    ].filter(Boolean).join(" OR ");

    const workspaceActiveWhere = [
      hasWorkspaceStatus ? "COALESCE(status, 'active') = 'active'" : undefined,
      hasWorkspaceDeleteRequestedAt ? "delete_requested_at IS NULL" : undefined,
      hasWorkspaceDeletedAt ? "deleted_at IS NULL" : undefined,
    ].filter(Boolean).join(" AND ") || "1 = 1";
    const workspaceDeletionRequestedWhere = [
      [
        hasWorkspaceStatus ? "status = 'deletion_requested'" : undefined,
        hasWorkspaceDeleteRequestedAt ? "delete_requested_at IS NOT NULL" : undefined,
      ].filter(Boolean).join(" OR "),
      hasWorkspaceDeletedAt ? "deleted_at IS NULL" : undefined,
    ].filter(Boolean).map((part) => `(${part})`).join(" AND ");
    const workspaceDeletedWhere = [
      hasWorkspaceStatus ? "status = 'deleted'" : undefined,
      hasWorkspaceDeletedAt ? "deleted_at IS NOT NULL" : undefined,
    ].filter(Boolean).join(" OR ");

    const latestDeletionRequestsQuery = userDeletionRequestedWhere
      ? db.prepare(
          `SELECT user_id, email, name, image, provider, provider_account_id,
                  ${hasUserStatus ? "status" : "'deletion_requested' AS status"},
                  ${hasUserDeleteRequestedAt ? "delete_requested_at" : "NULL AS delete_requested_at"},
                  ${hasUserDeletedAt ? "deleted_at" : "NULL AS deleted_at"},
                  created_at, last_login_at
           FROM users
           WHERE ${userDeletionRequestedWhere}
           ORDER BY ${hasUserDeleteRequestedAt ? "delete_requested_at" : "created_at"} DESC
           LIMIT 10`,
        ).all<UserRow>()
      : Promise.resolve({ success: true, results: [] as UserRow[] });

    const [
      users, activeUsers, deletionRequestedUsers, deletedUsers,
      workspaces, activeWorkspaces, deletionRequestedWorkspaces, deletedWorkspaces,
      projects, activeApiKeys, revokedApiKeys, events,
      loginsToday, apiCallsToday, blockedToday, approvalToday, sandboxToday, sandboxRunsToday, sandboxFailsToday,
      errorsToday, recentEvents, latestUsers, latestDeletionRequests, deletionRequestEvents, latestReceipts
    ] = await Promise.all([
      count("SELECT COUNT(*) AS count FROM users"),
      count(`SELECT COUNT(*) AS count FROM users WHERE ${userActiveWhere}`),
      userDeletionRequestedWhere ? count(`SELECT COUNT(*) AS count FROM users WHERE ${userDeletionRequestedWhere}`) : Promise.resolve(0),
      userDeletedWhere ? count(`SELECT COUNT(*) AS count FROM users WHERE ${userDeletedWhere}`) : Promise.resolve(0),
      count("SELECT COUNT(*) AS count FROM workspaces"),
      count(`SELECT COUNT(*) AS count FROM workspaces WHERE ${workspaceActiveWhere}`),
      workspaceDeletionRequestedWhere ? count(`SELECT COUNT(*) AS count FROM workspaces WHERE ${workspaceDeletionRequestedWhere}`) : Promise.resolve(0),
      workspaceDeletedWhere ? count(`SELECT COUNT(*) AS count FROM workspaces WHERE ${workspaceDeletedWhere}`) : Promise.resolve(0),
      count("SELECT COUNT(*) AS count FROM projects WHERE project_id != ?", "proj_demo_runtime_lab"),
      count("SELECT COUNT(*) AS count FROM api_keys WHERE project_id IS NOT NULL AND revoked_at IS NULL AND disabled_at IS NULL AND api_key != ?", "aw_live_demo_key"),
      count("SELECT COUNT(*) AS count FROM api_keys WHERE revoked_at IS NOT NULL"),
      count("SELECT COUNT(*) AS count FROM events WHERE created_at >= ?", todayIso),
      count("SELECT COUNT(*) AS count FROM events WHERE event_type = 'user_signed_in' AND created_at >= ?", todayIso),
      count("SELECT COUNT(*) AS count FROM events WHERE event_type = 'check_action_called' AND created_at >= ?", todayIso),
      count("SELECT COUNT(*) AS count FROM receipts WHERE decision = 'block' AND created_at >= ?", todayIso),
      count("SELECT COUNT(*) AS count FROM receipts WHERE decision = 'approval_required' AND created_at >= ?", todayIso),
      count("SELECT COUNT(*) AS count FROM receipts WHERE decision = 'sandbox_required' AND created_at >= ?", todayIso),
      count("SELECT COUNT(*) AS count FROM events WHERE event_type = 'sandbox_run_success' AND created_at >= ?", todayIso),
      count("SELECT COUNT(*) AS count FROM events WHERE event_type = 'sandbox_run_failed' AND created_at >= ?", todayIso),
      count("SELECT COUNT(*) AS count FROM events WHERE event_type IN ('api_401','api_403','api_500') AND created_at >= ?", todayIso),
      db.prepare(
        `SELECT event_id, workspace_id, user_id, event_type, status, metadata_json, created_at
         FROM events ORDER BY created_at DESC LIMIT 50`,
      ).all<{
        event_id: string; workspace_id?: string | null; user_id?: string | null;
        event_type: string; status: string; metadata_json?: string | null; created_at: string;
      }>(),
      db.prepare(
        "SELECT user_id, email, name, image, created_at, last_login_at FROM users ORDER BY created_at DESC LIMIT 10",
      ).all<{ user_id: string; email: string; name?: string | null; image?: string | null; created_at: string; last_login_at: string }>(),
      latestDeletionRequestsQuery,
      db.prepare(
        `SELECT event_id, workspace_id, user_id, event_type, status, metadata_json, created_at
         FROM events
         WHERE event_type = 'account_deletion_requested'
         ORDER BY created_at DESC
         LIMIT 20`,
      ).all<{
        event_id: string; workspace_id?: string | null; user_id?: string | null;
        event_type: string; status: string; metadata_json?: string | null; created_at: string;
      }>(),
      db.prepare(
        `SELECT receipt_id, workspace_id, project_id, decision, risk, policy, created_at
         FROM receipts
         ORDER BY created_at DESC
         LIMIT 20`,
      ).all<{
        receipt_id: string; workspace_id?: string | null; project_id?: string | null;
        decision: string; risk: string; policy: string; created_at: string;
      }>(),
    ]);

    return {
      totalUsers: users,
      activeUsers,
      deletionRequestedUsers,
      deletedUsers,
      totalWorkspaces: workspaces,
      activeWorkspaces,
      deletionRequestedWorkspaces,
      deletedWorkspaces,
      totalProjects: projects,
      activeApiKeys,
      revokedApiKeys,
      eventsToday: events,
      loginsToday,
      apiCallsToday,
      blockedToday,
      approvalRequiredToday: approvalToday,
      sandboxRequiredToday: sandboxToday,
      sandboxRunsToday,
      sandboxFailsToday,
      errorsToday,
      recentEvents: (recentEvents.results ?? []).map((row) => ({
        eventId: row.event_id,
        workspaceId: row.workspace_id ?? undefined,
        userId: row.user_id ?? undefined,
        eventType: row.event_type,
        status: row.status,
        metadata: row.metadata_json ? (() => { try { return JSON.parse(row.metadata_json!); } catch { return {}; } })() : {},
        createdAt: row.created_at,
      })),
      latestUsers: (latestUsers.results ?? []).map((row) => ({
        userId: row.user_id,
        email: row.email,
        name: row.name ?? undefined,
        image: row.image ?? undefined,
        createdAt: row.created_at,
        lastLoginAt: row.last_login_at,
      })),
      latestDeletionRequests: (latestDeletionRequests.results ?? []).map(mapUserRow),
      deletionRequestEvents: (deletionRequestEvents.results ?? []).map((row) => ({
        eventId: row.event_id,
        workspaceId: row.workspace_id ?? undefined,
        userId: row.user_id ?? undefined,
        eventType: row.event_type,
        status: row.status,
        metadata: row.metadata_json ? (() => { try { return JSON.parse(row.metadata_json!); } catch { return {}; } })() : {},
        createdAt: row.created_at,
      })),
      latestReceipts: (latestReceipts.results ?? []).map((row) => ({
        receiptId: row.receipt_id,
        workspaceId: row.workspace_id ?? undefined,
        projectId: row.project_id ?? undefined,
        decision: row.decision,
        risk: row.risk,
        policy: row.policy,
        createdAt: row.created_at,
      })),
    };
  } catch {
    return null;
  }
}

export async function trackEvent(
  eventType: string,
  options: {
    workspaceId?: string;
    userId?: string;
    projectId?: string;
    status?: string;
    metadata?: Record<string, unknown>;
  } = {},
): Promise<void> {
  const db = await getDb();
  if (!db) return;
  try {
    const safeMetadata = options.metadata
      ? JSON.stringify(options.metadata).slice(0, 4096)
      : null;
    await db
      .prepare(
        `INSERT INTO events (event_id, workspace_id, user_id, project_id, event_type, status, metadata_json, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .bind(
        randomId("evt"),
        options.workspaceId ?? null,
        options.userId ?? null,
        options.projectId ?? null,
        eventType,
        options.status ?? "ok",
        safeMetadata,
        nowIso(),
      )
      .run();
  } catch {
    // Event tracking must never break main user action
  }
}
