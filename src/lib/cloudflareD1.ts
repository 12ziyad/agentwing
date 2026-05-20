type D1Result<T = unknown> = {
  results?: T[];
  success: boolean;
};

type D1PreparedStatement = {
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
