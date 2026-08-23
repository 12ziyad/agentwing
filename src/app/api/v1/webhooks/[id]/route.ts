import { getAgentWingD1 } from "@/lib/cloudflareD1";
import { authRequiredResponse, getDashboardAuth } from "@/lib/auth";
import { ForbiddenError, forbiddenResponse, requireCapability } from "@/lib/rbac";
import { deleteWebhookEndpoint } from "@/lib/webhookStore";

export const runtime = "nodejs";

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await getDashboardAuth(request);
  if (!auth) return authRequiredResponse();

  try {
    requireCapability(auth, "sandbox:write");
  } catch (error) {
    if (error instanceof ForbiddenError) return forbiddenResponse(error);
    throw error;
  }

  const db = await getAgentWingD1();
  if (!db) {
    return Response.json(
      { error: "Webhook storage is unavailable.", code: "database_unavailable" },
      { status: 503, headers: { "retry-after": "5" } },
    );
  }

  const { id } = await params;
  const deleted = await deleteWebhookEndpoint(db, auth.workspaceId, id);
  if (!deleted) {
    return Response.json({ error: "Endpoint not found.", code: "endpoint_not_found" }, { status: 404 });
  }

  return Response.json({ ok: true });
}
