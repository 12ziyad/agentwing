import { saveE2BKey, sandboxOwnerKeyForWorkspace } from "@/lib/agentwingStore";
import { authRequiredResponse, getDashboardAuth } from "@/lib/auth";
import { ForbiddenError, forbiddenResponse, requireCapability } from "@/lib/rbac";
import { withRoute } from "@/lib/withRoute";

export const runtime = "nodejs";

async function handlePOST(request: Request) {
  const auth = await getDashboardAuth(request);
  if (!auth) return authRequiredResponse();

  try {
    requireCapability(auth, "sandbox:write");
  } catch (error) {
    if (error instanceof ForbiddenError) return forbiddenResponse(error);
    throw error;
  }

  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const apiKey =
    body && typeof body === "object" && "apiKey" in body && typeof body.apiKey === "string"
      ? body.apiKey
      : "";

  try {
    const sandbox = await saveE2BKey(apiKey, sandboxOwnerKeyForWorkspace(auth.workspaceId));
    return Response.json({
      ok: true,
      sandbox,
      message: "E2B key saved server-side. The raw key is never returned.",
    });
  } catch (error) {
    return Response.json(
      { ok: false, error: error instanceof Error ? error.message : "Unable to save E2B key." },
      { status: 400 },
    );
  }
}

export const POST = withRoute("v1/sandbox/save-e2b", handlePOST);
