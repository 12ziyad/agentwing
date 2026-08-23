import { getAgentWingD1 } from "@/lib/cloudflareD1";
import { authRequiredResponse, getDashboardAuth } from "@/lib/auth";
import { exportChain, issueCheckpointIfNeeded } from "@/lib/receiptChainStore";
import { checkpointPublicKey } from "@/lib/checkpointKey";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Export this workspace's receipt chain.
 *
 * The output is exactly what `@agentwing/receipt-verifier` consumes:
 *
 *   npx @agentwing/receipt-verifier export.json
 *
 * The verifier contacts nothing and shares no code with this server, which is
 * the point — a log you can only check by asking the party that wrote it is an
 * assertion, not evidence.
 *
 * The public key is embedded for convenience. Fetching it from somewhere else
 * is a stronger check, because then the log's author did not choose the key you
 * verified it against.
 */
export async function GET(request: Request) {
  const auth = await getDashboardAuth(request);
  if (!auth) return authRequiredResponse();

  const db = await getAgentWingD1();
  if (!db) {
    return Response.json(
      { error: "Receipt storage is unavailable.", code: "database_unavailable" },
      { status: 503, headers: { "retry-after": "5" } },
    );
  }

  const { searchParams } = new URL(request.url);
  const limit = Math.min(20_000, Math.max(1, Number(searchParams.get("limit") ?? "5000") || 5000));

  // Cover the current head before exporting, so the log leaves with a
  // signature over it rather than only its own internal consistency.
  await issueCheckpointIfNeeded(db, auth.workspaceId);

  const chain = await exportChain(db, auth.workspaceId, limit);
  const publicKey = await checkpointPublicKey();

  const filename = `agentwing-receipts-${auth.workspaceId}-${new Date().toISOString().slice(0, 10)}.json`;

  return new Response(JSON.stringify({ ...chain, publicKey }, null, 2), {
    headers: {
      "content-type": "application/json; charset=utf-8",
      "content-disposition": `attachment; filename="${filename}"`,
      "cache-control": "no-store",
    },
  });
}
