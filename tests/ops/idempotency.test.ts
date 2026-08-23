import { describe, expect, it } from "vitest";
import {
  IDEMPOTENCY_TTL_MS,
  IdempotencyConflictError,
  findReplay,
  readIdempotencyKey,
  rememberResponse,
  requestFingerprint,
  sweepExpiredKeys,
} from "@/lib/idempotency";
import type { AgentWingD1Database } from "@/lib/cloudflareD1";

/**
 * A retried write must not do the work twice.
 *
 * Without this, a network blip or an SDK retry turns one real intent into two
 * runs and two receipts — which does not merely waste quota, it makes the audit
 * trail show two attempts where there was one.
 */

/** A tiny in-memory stand-in for the one table this module touches. */
function fakeDb() {
  const rows = new Map<string, Record<string, unknown>>();

  const db = {
    prepare(query: string) {
      let bound: unknown[] = [];
      const statement = {
        bind(...values: unknown[]) {
          bound = values;
          return statement;
        },
        async first<T>() {
          if (query.includes("SELECT request_hash")) {
            const [workspaceId, key] = bound as [string, string];
            return (rows.get(`${workspaceId}:${key}`) as T) ?? null;
          }
          return null;
        },
        async all<T>() {
          return { results: [] as T[], success: true };
        },
        async run() {
          if (query.startsWith("INSERT OR IGNORE INTO idempotency_keys")) {
            const [workspaceId, key, requestHash, status, json, createdAt, expiresAt] = bound as string[];
            const id = `${workspaceId}:${key}`;
            if (rows.has(id)) return { success: true, meta: { changes: 0 } };
            rows.set(id, {
              request_hash: requestHash,
              response_status: Number(status),
              response_json: json,
              created_at: createdAt,
              expires_at: expiresAt,
            });
            return { success: true, meta: { changes: 1 } };
          }

          if (query.startsWith("DELETE FROM idempotency_keys")) {
            const [cutoff] = bound as [string];
            let removed = 0;
            for (const [id, row] of rows) {
              if (Date.parse(row.expires_at as string) <= Date.parse(cutoff)) {
                rows.delete(id);
                removed += 1;
              }
            }
            return { success: true, meta: { changes: removed } };
          }

          return { success: true, meta: { changes: 0 } };
        },
      };
      return statement;
    },
  } as unknown as AgentWingD1Database;

  return { db, rows };
}

const req = (headers: Record<string, string>) => new Request("https://x.test/api/v1/execute-action", { headers });

describe("reading the key", () => {
  it("accepts a reasonable key", () => {
    expect(readIdempotencyKey(req({ "idempotency-key": "run-2026-08-23-abc123" }))).toBe("run-2026-08-23-abc123");
  });

  it("ignores an absent header", () => {
    expect(readIdempotencyKey(req({}))).toBeUndefined();
  });

  it("ignores keys that are too short or malformed", () => {
    // This becomes part of a primary key, so it is bounded and charset-limited.
    expect(readIdempotencyKey(req({ "idempotency-key": "short" }))).toBeUndefined();
    expect(readIdempotencyKey(req({ "idempotency-key": "has spaces here" }))).toBeUndefined();
    expect(readIdempotencyKey(req({ "idempotency-key": "x".repeat(300) }))).toBeUndefined();
  });
});

describe("fingerprints", () => {
  it("are stable for the same request", async () => {
    const a = await requestFingerprint("POST", "/x", { actionType: "shell_command" });
    const b = await requestFingerprint("POST", "/x", { actionType: "shell_command" });
    expect(a).toBe(b);
  });

  it("differ when the body differs", async () => {
    const a = await requestFingerprint("POST", "/x", { command: "ls" });
    const b = await requestFingerprint("POST", "/x", { command: "rm -rf /" });
    expect(a).not.toBe(b);
  });
});

describe("replay", () => {
  it("returns the original response for a genuine retry", async () => {
    const { db } = fakeDb();
    const fingerprint = await requestFingerprint("POST", "/x", { command: "ls" });

    await rememberResponse(db, "ws_1", "key-abcdefgh", fingerprint, { status: 200, body: { runId: "run_1" } });
    const replay = await findReplay(db, "ws_1", "key-abcdefgh", fingerprint);

    expect(replay).toEqual({ status: 200, body: { runId: "run_1" } });
  });

  it("refuses a key reused for different content", async () => {
    // Silently returning the old response would be worse: the caller would
    // believe their new request ran.
    const { db } = fakeDb();
    const first = await requestFingerprint("POST", "/x", { command: "ls" });
    const second = await requestFingerprint("POST", "/x", { command: "rm -rf /" });

    await rememberResponse(db, "ws_1", "key-abcdefgh", first, { status: 200, body: { runId: "run_1" } });

    await expect(findReplay(db, "ws_1", "key-abcdefgh", second)).rejects.toThrow(IdempotencyConflictError);
  });

  it("does not leak across workspaces", async () => {
    const { db } = fakeDb();
    const fingerprint = await requestFingerprint("POST", "/x", { command: "ls" });
    await rememberResponse(db, "ws_1", "key-abcdefgh", fingerprint, { status: 200, body: { runId: "run_1" } });

    expect(await findReplay(db, "ws_2", "key-abcdefgh", fingerprint)).toBeUndefined();
  });

  it("treats an expired key as new", async () => {
    const { db } = fakeDb();
    const fingerprint = await requestFingerprint("POST", "/x", { command: "ls" });
    const then = Date.now() - IDEMPOTENCY_TTL_MS - 1000;

    await rememberResponse(db, "ws_1", "key-abcdefgh", fingerprint, { status: 200, body: {} }, then);

    expect(await findReplay(db, "ws_1", "key-abcdefgh", fingerprint)).toBeUndefined();
  });

  it("lets the first of two racing identical requests win", async () => {
    const { db } = fakeDb();
    const fingerprint = await requestFingerprint("POST", "/x", { command: "ls" });

    await rememberResponse(db, "ws_1", "k-aaaaaaaa", fingerprint, { status: 200, body: { runId: "first" } });
    await rememberResponse(db, "ws_1", "k-aaaaaaaa", fingerprint, { status: 200, body: { runId: "second" } });

    const replay = await findReplay(db, "ws_1", "k-aaaaaaaa", fingerprint);
    expect((replay?.body as { runId: string }).runId).toBe("first");
  });
});

describe("sweeping", () => {
  it("removes expired keys and leaves live ones", async () => {
    const { db, rows } = fakeDb();
    const fingerprint = await requestFingerprint("POST", "/x", {});

    await rememberResponse(db, "ws_1", "old-aaaaaaa", fingerprint, { status: 200, body: {} }, Date.now() - IDEMPOTENCY_TTL_MS - 1000);
    await rememberResponse(db, "ws_1", "new-aaaaaaa", fingerprint, { status: 200, body: {} });

    expect(await sweepExpiredKeys(db)).toBe(1);
    expect(rows.size).toBe(1);
  });
});
