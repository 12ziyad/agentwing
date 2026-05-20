import { getReceiptStats, listReceipts } from "@/lib/agentwingStore";

export const runtime = "nodejs";

export async function GET() {
  return Response.json({
    receipts: await listReceipts(),
    stats: await getReceiptStats(),
  });
}
