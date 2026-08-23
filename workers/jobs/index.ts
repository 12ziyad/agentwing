/**
 * Scheduled background work.
 *
 * A separate Worker from the app on purpose:
 *
 *  - It isolates background D1 usage from request traffic. D1 executes queries
 *    sequentially per database, so a sweep that runs inside the request Worker
 *    consumes the throughput budget of every user request.
 *  - It makes that usage separately attributable in logs.
 *  - It avoids depending on whether OpenNext's generated worker exposes a
 *    `scheduled` handler, which is not something to build on.
 *
 * Every task is bounded per run. A backlog must drain over several ticks rather
 * than monopolise the database in one.
 */

type D1PreparedStatement = {
  bind: (...values: unknown[]) => D1PreparedStatement;
  first: <T = unknown>() => Promise<T | null>;
  all: <T = unknown>() => Promise<{ results?: T[]; success: boolean; meta?: { changes?: number } }>;
  run: () => Promise<{ success: boolean; meta?: { changes?: number } }>;
};

type D1Database = { prepare: (query: string) => D1PreparedStatement };

type Env = {
  AGENTWING_DB: D1Database;
};

/** A run that entered `running` and whose isolate died stays running forever. */
const STUCK_RUN_MINUTES = 15;

const BATCH = 100;

function isoNow(offsetMs = 0): string {
  return new Date(Date.now() + offsetMs).toISOString();
}

async function reapStuckRuns(db: D1Database): Promise<number> {
  const cutoff = isoNow(-STUCK_RUN_MINUTES * 60_000);

  const result = await db
    .prepare(
      `UPDATE action_runs
       SET status = 'failed',
           error_message = 'Run exceeded the maximum execution time and was reaped.',
           next_step = 'This run did not report a result in time. Re-plan or retry the action.',
           completed_at = ?,
           updated_at = ?
       WHERE run_id IN (
         SELECT run_id FROM action_runs WHERE status = 'running' AND updated_at < ? LIMIT ?
       )`,
    )
    .bind(isoNow(), isoNow(), cutoff, BATCH)
    .run();

  return result.meta?.changes ?? 0;
}

/**
 * Expire approvals past their deadline.
 *
 * `expires_at` was written on every approval and never enforced, so an approval
 * "expiring" had no effect at all. Expiry must fail closed: an approval that
 * quietly lapses into allowed is the worst possible default for a gate.
 */
async function expireApprovals(db: D1Database): Promise<number> {
  const result = await db
    .prepare(
      `UPDATE approvals
       SET status = 'expired', updated_at = ?, resolved_at = ?
       WHERE approval_id IN (
         SELECT approval_id FROM approvals
         WHERE status = 'pending' AND expires_at IS NOT NULL AND expires_at < ?
         LIMIT ?
       )`,
    )
    .bind(isoNow(), isoNow(), isoNow(), BATCH)
    .run();

  return result.meta?.changes ?? 0;
}

async function expireSessions(db: D1Database): Promise<number> {
  const result = await db
    .prepare(
      `DELETE FROM sessions WHERE rowid IN (SELECT rowid FROM sessions WHERE expires_at < ? LIMIT ?)`,
    )
    .bind(isoNow(), BATCH * 5)
    .run();
  return result.meta?.changes ?? 0;
}

async function sweepIdempotencyKeys(db: D1Database): Promise<number> {
  const result = await db
    .prepare(
      `DELETE FROM idempotency_keys WHERE rowid IN (SELECT rowid FROM idempotency_keys WHERE expires_at <= ? LIMIT ?)`,
    )
    .bind(isoNow(), BATCH * 5)
    .run();
  return result.meta?.changes ?? 0;
}

async function expireRunnerTokens(db: D1Database): Promise<number> {
  const result = await db
    .prepare(
      `DELETE FROM runner_approval_tokens
       WHERE rowid IN (SELECT rowid FROM runner_approval_tokens WHERE expires_at < ? LIMIT ?)`,
    )
    .bind(isoNow(), BATCH * 5)
    .run();
  return result.meta?.changes ?? 0;
}

/** Remove expired and consumed sign-in transactions. */
async function sweepOauthTransactions(db: D1Database): Promise<number> {
  const result = await db
    .prepare(
      `DELETE FROM oauth_transactions
       WHERE rowid IN (SELECT rowid FROM oauth_transactions WHERE expires_at <= ? LIMIT ?)`,
    )
    .bind(isoNow(), BATCH * 5)
    .run();
  return result.meta?.changes ?? 0;
}

/**
 * Disable endpoints that have dead-lettered repeatedly.
 *
 * One permanently broken endpoint should not consume the delivery budget of
 * every other endpoint forever.
 */
async function disableFailingEndpoints(db: D1Database): Promise<number> {
  const result = await db
    .prepare(
      `UPDATE webhook_endpoints
       SET disabled_at = ?, disabled_reason = 'Too many consecutive failed deliveries.', updated_at = ?
       WHERE disabled_at IS NULL AND endpoint_id IN (
         SELECT endpoint_id FROM webhook_deliveries
         WHERE status = 'dead'
         GROUP BY endpoint_id
         HAVING COUNT(*) >= 20
       )`,
    )
    .bind(isoNow(), isoNow())
    .run();
  return result.meta?.changes ?? 0;
}

export default {
  async scheduled(_event: unknown, env: Env, ctx: { waitUntil: (p: Promise<unknown>) => void }): Promise<void> {
    ctx.waitUntil(
      (async () => {
        const db = env.AGENTWING_DB;
        const started = Date.now();
        const results: Record<string, number> = {};

        // Each task is independent: one failing must not stop the rest, because
        // a failure to sweep sessions should not also mean runs stay stuck.
        for (const [name, task] of [
          ["stuckRunsReaped", reapStuckRuns],
          ["approvalsExpired", expireApprovals],
          ["sessionsExpired", expireSessions],
          ["idempotencyKeysSwept", sweepIdempotencyKeys],
          ["runnerTokensExpired", expireRunnerTokens],
          ["oauthTransactionsSwept", sweepOauthTransactions],
          ["endpointsDisabled", disableFailingEndpoints],
        ] as const) {
          try {
            results[name] = await task(db);
          } catch (error) {
            results[`${name}Error`] = 1;
            console.log(
              JSON.stringify({
                level: "error",
                msg: "scheduled_task_failed",
                task: name,
                error: error instanceof Error ? error.name : "unknown",
              }),
            );
          }
        }

        console.log(
          JSON.stringify({ level: "info", msg: "scheduled_run", durationMs: Date.now() - started, ...results }),
        );
      })(),
    );
  },
};
