import type { AgentWingD1Database } from "./cloudflareD1";

/**
 * Idempotency for mutating requests.
 *
 * Without this, a retried `execute-action` — from a network blip, an SDK retry,
 * or an impatient agent — creates a second run AND a second receipt for one real
 * intent. That does not merely waste quota: it corrupts the audit trail the
 * product exists to produce, because the log now shows two attempts where there
 * was one.
 *
 * A key is scoped to a workspace, bound to the request it was first used with,
 * and expires. Replaying returns the original response rather than re-running
 * the work.
 */

/** Long enough to cover any sane retry window, short enough to sweep. */
export const IDEMPOTENCY_TTL_MS = 24 * 60 * 60 * 1000;

export const IDEMPOTENCY_HEADER = "idempotency-key";

export class IdempotencyConflictError extends Error {
  readonly code = "idempotency_key_reused";
  readonly status = 409;

  constructor() {
    super(
      "This Idempotency-Key was already used for a different request. Use a new key, or resend the original request exactly.",
    );
    this.name = "IdempotencyConflictError";
  }
}

async function sha256Hex(value: string): Promise<string> {
  const digest = await globalThis.crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("");
}

/** A stable fingerprint of what was asked, so a reused key with new content is caught. */
export function requestFingerprint(method: string, path: string, body: unknown): Promise<string> {
  return sha256Hex(`${method} ${path}\n${JSON.stringify(body ?? null)}`);
}

export function readIdempotencyKey(request: Request): string | undefined {
  const raw = request.headers.get(IDEMPOTENCY_HEADER);
  if (!raw) return undefined;
  const key = raw.trim();
  // Bounded and charset-limited: this becomes a primary key component.
  if (!/^[A-Za-z0-9_.:-]{8,255}$/.test(key)) return undefined;
  return key;
}

export type StoredResponse = { status: number; body: unknown };

/**
 * Look for a previous response under this key.
 *
 * Returns the stored response for a genuine replay, and throws when the key was
 * reused for different content — silently returning the old response there
 * would be worse, because the caller would believe their new request ran.
 */
export async function findReplay(
  db: AgentWingD1Database,
  workspaceId: string,
  key: string,
  fingerprint: string,
  now = Date.now(),
): Promise<StoredResponse | undefined> {
  const row = await db
    .prepare(
      `SELECT request_hash, response_status, response_json, expires_at
       FROM idempotency_keys
       WHERE workspace_id = ? AND idempotency_key = ?`,
    )
    .bind(workspaceId, key)
    .first<{ request_hash: string; response_status: number; response_json: string; expires_at: string }>();

  if (!row) return undefined;
  if (Date.parse(row.expires_at) <= now) return undefined; // Expired: treat as new.
  if (row.request_hash !== fingerprint) throw new IdempotencyConflictError();

  return { status: Number(row.response_status), body: JSON.parse(row.response_json) };
}

/**
 * Remember a response so a retry replays it.
 *
 * Uses INSERT OR IGNORE: if two identical requests raced, the first to finish
 * wins and the second simply does not overwrite it. Both callers then see a
 * consistent answer.
 */
export async function rememberResponse(
  db: AgentWingD1Database,
  workspaceId: string,
  key: string,
  fingerprint: string,
  response: StoredResponse,
  now = Date.now(),
): Promise<void> {
  await db
    .prepare(
      `INSERT OR IGNORE INTO idempotency_keys
       (workspace_id, idempotency_key, request_hash, response_status, response_json, created_at, expires_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
    )
    .bind(
      workspaceId,
      key,
      fingerprint,
      response.status,
      JSON.stringify(response.body),
      new Date(now).toISOString(),
      new Date(now + IDEMPOTENCY_TTL_MS).toISOString(),
    )
    .run();
}

/** Remove expired keys. Called by the scheduled job. */
export async function sweepExpiredKeys(db: AgentWingD1Database, now = Date.now(), limit = 500): Promise<number> {
  const result = await db
    .prepare(
      `DELETE FROM idempotency_keys
       WHERE rowid IN (SELECT rowid FROM idempotency_keys WHERE expires_at <= ? LIMIT ?)`,
    )
    .bind(new Date(now).toISOString(), limit)
    .run();
  return result.meta?.changes ?? 0;
}
