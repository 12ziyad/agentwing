import { getReceipt } from "@/lib/agentwingStore";

export const runtime = "nodejs";

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const receipt = await getReceipt(id);

  if (!receipt) {
    return Response.json({ error: "Receipt not found." }, { status: 404 });
  }

  return Response.json({ receipt });
}
