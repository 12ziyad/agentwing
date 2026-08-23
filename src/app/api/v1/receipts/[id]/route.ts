import { getReceipt } from "@/lib/agentwingStore";
import { authRequiredResponse, getDashboardAuth } from "@/lib/auth";
import { withRoute } from "@/lib/withRoute";

export const runtime = "nodejs";

async function handleGET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const auth = await getDashboardAuth(_request);
  if (!auth) return authRequiredResponse();

  const { id } = await context.params;
  const receipt = await getReceipt(id, auth.workspaceId);

  if (!receipt) {
    return Response.json({ error: "Receipt not found." }, { status: 404 });
  }

  return Response.json({ receipt });
}

export const GET = withRoute("v1/receipts/[id]", handleGET);
