import { getSandboxConfig, removeE2BKey, sandboxOwnerKeyForWorkspace } from "@/lib/agentwingStore";
import { authRequiredResponse, getDashboardAuth } from "@/lib/auth";
import { ForbiddenError, forbiddenResponse, requireCapability } from "@/lib/rbac";
import { withRoute } from "@/lib/withRoute";

export const runtime = "nodejs";

function isSandboxSecretConfigured() {
  const secret = process.env.AGENTWING_SANDBOX_SECRET ?? process.env.AGENTWING_SECRET_KEY;
  if (secret) return true;
  if (process.env.NODE_ENV !== "production") return true;
  return false;
}

async function handleGET(request: Request) {
  const auth = await getDashboardAuth(request);
  if (!auth) return authRequiredResponse();

  return Response.json({
    sandbox: await getSandboxConfig(sandboxOwnerKeyForWorkspace(auth.workspaceId)),
    secretMissing: !isSandboxSecretConfigured(),
  });
}

async function handleDELETE(request: Request) {
  const auth = await getDashboardAuth(request);
  if (!auth) return authRequiredResponse();

  try {
    requireCapability(auth, "sandbox:write");
  } catch (error) {
    if (error instanceof ForbiddenError) return forbiddenResponse(error);
    throw error;
  }

  return Response.json({
    ok: true,
    sandbox: await removeE2BKey(sandboxOwnerKeyForWorkspace(auth.workspaceId)),
    message: "E2B BYOK key removed. Runtime sandbox execution is disabled until a new key is saved.",
  });
}

export const GET = withRoute("v1/sandbox/config", handleGET);

export const DELETE = withRoute("v1/sandbox/config", handleDELETE);
