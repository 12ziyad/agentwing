import { revokeApiKey, trackEvent } from "@/lib/agentwingStore";
import { authRequiredResponse, getDashboardAuth } from "@/lib/auth";
import { ForbiddenError, forbiddenResponse, requireCapability } from "@/lib/rbac";
import { withRoute } from "@/lib/withRoute";

export const runtime = "nodejs";

async function handleDELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await getDashboardAuth(request);
  if (!auth) return authRequiredResponse();

  try {
    requireCapability(auth, "key:write");
  } catch (error) {
    if (error instanceof ForbiddenError) return forbiddenResponse(error);
    throw error;
  }

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
    userId: auth.user.userId,
    metadata: { apiKeyId: id },
  });

  return Response.json({ ok: true, message: "API key revoked." });
}

export const DELETE = withRoute("v1/api-keys/[id]", handleDELETE);
