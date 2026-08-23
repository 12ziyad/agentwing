import { getReceiptStats, listReceipts } from "@/lib/agentwingStore";
import { authRequiredResponse, getDashboardAuth } from "@/lib/auth";
import { withRoute } from "@/lib/withRoute";

export const runtime = "nodejs";

async function handleGET(request: Request) {
  const auth = await getDashboardAuth(request);
  if (!auth) return authRequiredResponse();

  return Response.json({
    receipts: await listReceipts(auth.workspaceId),
    stats: await getReceiptStats(auth.workspaceId),
  });
}

export const GET = withRoute("v1/receipts", handleGET);
