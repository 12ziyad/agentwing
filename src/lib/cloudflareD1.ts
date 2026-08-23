/**
 * The slice of Cloudflare's D1 API that AgentWing uses.
 *
 * This is deliberately a hand-written structural type rather than an import of
 * `D1Database`: it is the seam that lets the store be constructed with an
 * in-memory implementation in tests, and it keeps the surface we depend on
 * small enough to read in one screen.
 */

/**
 * Statistics D1 returns alongside a result.
 *
 * `changes` is the one that matters for correctness. Compare-and-swap updates
 * depend on knowing how many rows an `UPDATE` actually modified — `success`
 * only says the statement executed, and is `true` for a statement that matched
 * nothing at all.
 */
export type D1Meta = {
  changes?: number;
  last_row_id?: number;
  rows_read?: number;
  rows_written?: number;
  duration?: number;
};

export type D1Result<T = unknown> = {
  results?: T[];
  success: boolean;
  meta?: D1Meta;
};

export type D1PreparedStatement = {
  bind: (...values: unknown[]) => D1PreparedStatement;
  first: <T = unknown>() => Promise<T | null>;
  all: <T = unknown>() => Promise<D1Result<T>>;
  run: () => Promise<D1Result>;
};

export type AgentWingD1Database = {
  prepare: (query: string) => D1PreparedStatement;
  batch?: (statements: D1PreparedStatement[]) => Promise<D1Result[]>;
};

type CloudflareEnvWithD1 = {
  AGENTWING_DB?: AgentWingD1Database;
};

export async function getAgentWingD1(): Promise<AgentWingD1Database | undefined> {
  try {
    const { getCloudflareContext } = await import("@opennextjs/cloudflare");
    const context = await getCloudflareContext({ async: true });
    return (context.env as CloudflareEnvWithD1).AGENTWING_DB;
  } catch {
    return undefined;
  }
}
