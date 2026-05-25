import { getAgentWingD1, type AgentWingD1Database } from "./cloudflareD1";
import type {
  ActionReceipt,
  AgentAction,
  AgentWingApiKeyRecord,
  AgentWingProject,
  AgentWingUser,
  AgentWingWorkspace,
  DashboardAuthContext,
  ApiKeyUsage,
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
};

type UserRow = {
  user_id: string;
  email: string;
  name?: string | null;
  image?: string | null;
  provider: "google";
  provider_account_id: string;
  created_at: string;
  last_login_at: string;
};

type WorkspaceRow = {
  workspace_id: string;
  name: string;
  owner_user_id: string;
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
    createdAt: row.created_at,
    lastLoginAt: row.last_login_at,
  };
}

function mapWorkspaceRow(row: WorkspaceRow): AgentWingWorkspace {
  return {
    workspaceId: row.workspace_id,
    name: row.name,
    ownerUserId: row.owner_user_id,
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
                  sandbox_run_limit, created_at, last_used_at
           FROM api_keys
           WHERE key_hash = ? AND disabled_at IS NULL`,
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
                  sandbox_run_limit, created_at, last_used_at
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

export async function getSandboxConfig(apiKeyId = DEMO_API_KEY) {
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
      await ensureD1DemoKey(db);
      await db
        .prepare(
          `INSERT INTO sandbox_configs
           (api_key, workspace_id, mode, e2b_key_saved, e2b_key_prefix, e2b_key_last4, e2b_key_encrypted, connected_at, updated_at)
           VALUES (?, ?, 'e2b_byok', 1, ?, ?, ?, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'), strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
           ON CONFLICT(api_key) DO UPDATE SET
             workspace_id = excluded.workspace_id,
             mode = 'e2b_byok',
             e2b_key_saved = 1,
             e2b_key_prefix = excluded.e2b_key_prefix,
             e2b_key_last4 = excluded.e2b_key_last4,
             e2b_key_encrypted = excluded.e2b_key_encrypted,
             connected_at = COALESCE(sandbox_configs.connected_at, excluded.connected_at),
             updated_at = excluded.updated_at`,
        )
        .bind(ownerApiKeyId, workspaceId ?? null, safeE2BKeyPrefix(trimmed) ?? null, trimmed.slice(-4), await encryptSandboxSecret(trimmed))
        .run();

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

export async function recordE2BTestResult(status: SandboxTestStatus, ownerApiKeyId = DEMO_API_KEY) {
  const db = await getDb();
  const workspaceId = workspaceIdFromSandboxOwner(ownerApiKeyId);
  if (db) {
    try {
      await ensureD1DemoKey(db);
      await db
        .prepare(
          `INSERT INTO sandbox_configs
           (api_key, workspace_id, mode, e2b_key_saved, last_test_status, last_tested_at)
           VALUES (?, ?, 'none', 0, ?, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
           ON CONFLICT(api_key) DO UPDATE SET
             workspace_id = COALESCE(sandbox_configs.workspace_id, excluded.workspace_id),
             last_test_status = excluded.last_test_status,
             last_tested_at = excluded.last_tested_at`,
        )
        .bind(ownerApiKeyId, workspaceId ?? null, status)
        .run();

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
      await ensureD1DemoKey(db);
      await db
        .prepare(
          `INSERT INTO sandbox_configs
           (api_key, workspace_id, mode, e2b_key_saved, e2b_key_prefix, e2b_key_last4, e2b_key_encrypted, connected_at, updated_at)
           VALUES (?, ?, 'none', 0, NULL, NULL, NULL, NULL, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
           ON CONFLICT(api_key) DO UPDATE SET
             workspace_id = excluded.workspace_id,
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
        .bind(ownerApiKeyId, workspaceId ?? null)
        .run();

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

export async function getE2BApiKeyForExecution(apiKeyId = DEMO_API_KEY, workspaceId?: string) {
  const db = await getDb();
  let useMemoryFallback = !db;

  if (db) {
    try {
      await ensureD1DemoKey(db);
      const projectKey = await getD1E2BApiKey(db, apiKeyId);
      if (projectKey) return projectKey;

      if (workspaceId) {
        const workspaceKey = await getD1E2BApiKey(db, sandboxOwnerKeyForWorkspace(workspaceId));
        if (workspaceKey) return workspaceKey;
      }

      if (apiKeyId !== DEMO_API_KEY) {
        const demoKey = await getD1E2BApiKey(db, DEMO_API_KEY);
        if (demoKey) return demoKey;
      }
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
