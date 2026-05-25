import { getAgentWingD1, type AgentWingD1Database } from "./cloudflareD1";
import type {
  ActionReceipt,
  AgentAction,
  AgentWingApiKeyRecord,
  AgentWingProject,
  ApiKeyUsage,
  PolicyEvaluation,
  ReceiptStats,
} from "./agentwingTypes";

type SandboxMode = "none" | "e2b_byok" | "custom_http" | "managed_soon";

type SandboxConfig = {
  mode: SandboxMode;
  e2bKeySaved: boolean;
  e2bKeyLast4?: string;
  e2bKeyUpdatedAt?: string;
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
};

type AuthenticatedApiKey = {
  apiKeyId: string;
  projectId?: string;
  keyPrefix: string;
  isDemo: boolean;
};

type ReceiptRow = {
  receipt_id: string;
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
  name: string;
  created_at: string;
};

type ApiKeyRow = {
  api_key: string;
  api_key_id?: string | null;
  project_id?: string | null;
  key_prefix?: string | null;
  plan_name: string;
  action_check_limit: number;
  sandbox_run_limit: number;
  created_at: string;
  last_used_at?: string | null;
};

type SandboxRow = {
  mode: SandboxMode;
  e2b_key_saved: number;
  e2b_key_last4?: string | null;
  e2b_key_encrypted?: string | null;
  updated_at?: string | null;
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
        mode: "none",
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
    name: row.name,
    createdAt: row.created_at,
  };
}

function mapApiKeyRow(row: ApiKeyRow): AgentWingApiKeyRecord {
  return {
    apiKeyId: row.api_key_id ?? row.api_key,
    projectId: row.project_id ?? undefined,
    keyPrefix: row.key_prefix ?? row.api_key,
    planName: row.plan_name,
    actionCheckLimit: row.action_check_limit,
    sandboxRunLimit: row.sandbox_run_limit,
    createdAt: row.created_at,
    lastUsedAt: row.last_used_at ?? undefined,
  };
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
          `SELECT api_key, api_key_id, project_id, key_prefix, plan_name, action_check_limit,
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

export async function listProjects(): Promise<AgentWingProject[]> {
  const db = await getDb();
  if (db) {
    try {
      await ensureD1DemoKey(db);
      const result = await db
        .prepare("SELECT project_id, name, created_at FROM projects ORDER BY created_at DESC")
        .all<ProjectRow>();
      return (result.results ?? []).map(mapProjectRow);
    } catch (error) {
      warnD1Fallback("createProject", error);
      // Fall back to memory if D1 has not been migrated yet.
    }
  }

  return getState().projects;
}

export async function createProject(name: string): Promise<AgentWingProject> {
  const project: AgentWingProject = {
    projectId: randomId("proj"),
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
        .prepare("INSERT INTO projects (project_id, name, created_at) VALUES (?, ?, ?)")
        .bind(project.projectId, project.name, project.createdAt)
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

export async function listApiKeys(projectId?: string): Promise<AgentWingApiKeyRecord[]> {
  const db = await getDb();
  if (db) {
    try {
      await ensureD1DemoKey(db);
      const statement = projectId
        ? db
            .prepare(
              `SELECT api_key, api_key_id, project_id, key_prefix, plan_name, action_check_limit,
                      sandbox_run_limit, created_at, last_used_at
               FROM api_keys
               WHERE project_id = ?
               ORDER BY created_at DESC`,
            )
            .bind(projectId)
        : db.prepare(
            `SELECT api_key, api_key_id, project_id, key_prefix, plan_name, action_check_limit,
                    sandbox_run_limit, created_at, last_used_at
             FROM api_keys
             WHERE project_id IS NOT NULL
             ORDER BY created_at DESC`,
          );
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
    .map((record) => ({
      apiKeyId: record.apiKeyId,
      projectId: record.projectId,
      keyPrefix: record.keyPrefix,
      planName: record.planName,
      actionCheckLimit: record.actionCheckLimit,
      sandboxRunLimit: record.sandboxRunLimit,
      createdAt: record.createdAt,
      lastUsedAt: record.lastUsedAt,
    }));
}

export async function generateApiKey(projectId: string) {
  const project = (await listProjects()).find((item) => item.projectId === projectId);
  if (!project) {
    throw new Error("Project not found.");
  }

  const apiKey = `aw_live_${randomToken(24)}`;
  const apiKeyId = randomId("key");
  const record: AgentWingApiKeyRecord = {
    apiKeyId,
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
           (api_key, api_key_id, project_id, key_prefix, key_hash, plan_name, action_check_limit, sandbox_run_limit, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        )
        .bind(
          apiKeyId,
          apiKeyId,
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
): Promise<ActionReceipt> {
  const receipt: ActionReceipt = {
    receiptId: randomId("aw_receipt"),
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
           (receipt_id, api_key, project_id, session_id, agent_id, action_type, tool, target, raw_action, decision, risk, policy, feedback, provider, mode, stdout, stderr, exit_code, duration_ms, error, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        )
        .bind(
          receipt.receiptId,
          apiKeyId ?? null,
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

export async function listReceipts() {
  const db = await getDb();
  if (db) {
    try {
      const result = await db
        .prepare(
          `SELECT receipt_id, project_id, session_id, agent_id, action_type, tool, target, raw_action,
                  decision, risk, policy, feedback, provider, mode, stdout, stderr, exit_code, duration_ms, error, created_at
           FROM receipts
           ORDER BY created_at DESC
          LIMIT 500`,
        )
        .all<ReceiptRow>();
      const d1Receipts = (result.results ?? []).map(mapReceiptRow);
      const memoryReceipts = getState().receipts.filter(
        (receipt) => !d1Receipts.some((d1Receipt) => d1Receipt.receiptId === receipt.receiptId),
      );
      return [...memoryReceipts, ...d1Receipts]
        .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt))
        .slice(0, 500);
    } catch (error) {
      warnD1Fallback("listReceipts", error);
      // Fall back to memory if D1 has not been migrated yet.
    }
  }

  return getState().receipts;
}

export async function getReceipt(receiptId: string) {
  const db = await getDb();
  const memoryReceipt = getState().receipts.find((receipt) => receipt.receiptId === receiptId);
  if (db) {
    try {
      const row = await db
        .prepare(
          `SELECT receipt_id, project_id, session_id, agent_id, action_type, tool, target, raw_action,
                  decision, risk, policy, feedback, provider, mode, stdout, stderr, exit_code, duration_ms, error, created_at
           FROM receipts
           WHERE receipt_id = ?`,
        )
        .bind(receiptId)
        .first<ReceiptRow>();
      return row ? mapReceiptRow(row) : memoryReceipt;
    } catch (error) {
      warnD1Fallback("getReceipt", error);
      // Fall back to memory if D1 has not been migrated yet.
    }
  }

  return memoryReceipt;
}

export async function getReceiptStats(): Promise<ReceiptStats> {
  const db = await getDb();
  if (db) {
    try {
      const receipts = await listReceipts();
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

  const receipts = getState().receipts;
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
        .prepare("SELECT mode, e2b_key_saved, e2b_key_last4, updated_at FROM sandbox_configs WHERE api_key = ?")
        .bind(apiKeyId)
        .first<SandboxRow>();
      return {
        mode: row?.mode ?? "none",
        e2bKeySaved: Boolean(row?.e2b_key_saved),
        e2bKeyLast4: row?.e2b_key_last4 ?? undefined,
        e2bKeyUpdatedAt: row?.updated_at ?? undefined,
      };
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
  const trimmed = apiKey.trim();
  if (!trimmed) {
    throw new Error("E2B API key is required.");
  }

  const db = await getDb();
  if (db) {
    try {
      await ensureD1DemoKey(db);
      await db
        .prepare(
          `INSERT INTO sandbox_configs
           (api_key, mode, e2b_key_saved, e2b_key_last4, e2b_key_encrypted, updated_at)
           VALUES (?, 'e2b_byok', 1, ?, ?, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
           ON CONFLICT(api_key) DO UPDATE SET
             mode = 'e2b_byok',
             e2b_key_saved = 1,
             e2b_key_last4 = excluded.e2b_key_last4,
             e2b_key_encrypted = excluded.e2b_key_encrypted,
             updated_at = excluded.updated_at`,
        )
        .bind(ownerApiKeyId, trimmed.slice(-4), await encryptSandboxSecret(trimmed))
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
    mode: "e2b_byok",
    e2bApiKey: trimmed,
    e2bKeySaved: true,
    e2bKeyLast4: trimmed.slice(-4),
    e2bKeyUpdatedAt: nowIso(),
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

export async function getE2BApiKeyForExecution(apiKeyId = DEMO_API_KEY) {
  const db = await getDb();
  if (db) {
    try {
      await ensureD1DemoKey(db);
      const projectKey = await getD1E2BApiKey(db, apiKeyId);
      if (projectKey) return projectKey;

      if (apiKeyId !== DEMO_API_KEY) {
        const demoKey = await getD1E2BApiKey(db, DEMO_API_KEY);
        if (demoKey) return demoKey;
      }
    } catch (error) {
      warnD1Fallback("getE2BApiKeyForExecution", error);
      // Fall back to memory/env in local development if D1 is not ready.
    }
  }

  const devStoredKey = getState().sandbox.e2bApiKey?.trim();
  if (devStoredKey) return devStoredKey;

  const envKey = process.env.E2B_API_KEY?.trim();
  return envKey || undefined;
}
