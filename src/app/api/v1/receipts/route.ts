import { getReceiptStats, listReceipts } from "@/lib/agentwingStore";
import { authRequiredResponse, getDashboardAuth } from "@/lib/auth";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const auth = await getDashboardAuth(request);
  if (!auth) return authRequiredResponse();

  return Response.json({
    receipts: await listReceipts(auth.workspaceId),
    stats: await getReceiptStats(auth.workspaceId),
  });
}
