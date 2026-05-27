import { revokeApiKey, trackEvent } from "@/lib/agentwingStore";
import { authRequiredResponse, getDashboardAuth } from "@/lib/auth";

export const runtime = "nodejs";

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await getDashboardAuth(request);
  if (!auth) return authRequiredResponse();

  const { id } = await params;
  if (!id) return Response.json({ error: "API key ID is required." }, { status: 400 });

  const revoked = await revokeApiKey(id, auth.workspaceId);
  if (!revoked) {
    return Response.json(
      { error: "API key not found or already revoked." },
      { status: 404 },
    );
  }

  await trackEvent("api_key_revoked", {
    workspaceId: auth.workspaceId,
    userId: auth.mode === "user" ? auth.user.userId : undefined,
    metadata: { apiKeyId: id },
  });

  return Response.json({ ok: true, message: "API key revoked." });
}
