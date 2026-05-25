import { getReceipt } from "@/lib/agentwingStore";
import { authRequiredResponse, getDashboardAuth } from "@/lib/auth";

export const runtime = "nodejs";

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const auth = await getDashboardAuth(_request);
  if (!auth) return authRequiredResponse();

  const { id } = await context.params;
  const receipt = await getReceipt(id, auth.workspaceId);

  if (!receipt) {
    return Response.json({ error: "Receipt not found." }, { status: 404 });
  }

  return Response.json({ receipt });
}
