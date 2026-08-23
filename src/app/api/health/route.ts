import { getAgentWingD1 } from "@/lib/cloudflareD1";
import { getDashboardAuth } from "@/lib/auth";
import { withRoute } from "@/lib/withRoute";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Liveness and readiness in one endpoint.
 *
 * The D1 probe is a real query, not a constant: `SELECT 1` proves only that a
 * binding object exists, while reading a row proves the database is reachable
 * and answering. For an inline control plane, "is storage up" is the only
 * health question that matters — if it is down, every decision fails closed.
 *
 * Detail is gated. An unauthenticated caller gets a status and nothing else,
 * because version and schema information is reconnaissance.
 */
async function handleGET(request: Request) {
  const startedAt = Date.now();

  let d1Ok = false;
  let d1LatencyMs: number | undefined;
  let d1Error: string | undefined;

  try {
    const db = await getAgentWingD1();
    if (!db) {
      d1Error = "no_binding";
    } else {
      const probeStarted = Date.now();
      await db.prepare("SELECT 1 AS ok FROM api_keys LIMIT 1").first<{ ok: number }>();
      d1LatencyMs = Date.now() - probeStarted;
      d1Ok = true;
    }
  } catch (error) {
    d1Error = error instanceof Error ? error.name : "unknown_error";
  }

  const healthy = d1Ok;
  const status = healthy ? "ok" : "degraded";

  // Detail requires a session. Failing to resolve one is not itself an error
  // here — it just means the caller gets the terse body.
  let detailed = false;
  try {
    detailed = Boolean(await getDashboardAuth(request));
  } catch {
    detailed = false;
  }

  const body = detailed
    ? {
        status,
        checks: {
          d1: { ok: d1Ok, latencyMs: d1LatencyMs, error: d1Error },
        },
        durationMs: Date.now() - startedAt,
      }
    : { status };

  return Response.json(body, {
    status: healthy ? 200 : 503,
    headers: {
      "cache-control": "no-store",
      ...(healthy ? {} : { "retry-after": "5" }),
    },
  });
}

export const GET = withRoute("health", handleGET);
