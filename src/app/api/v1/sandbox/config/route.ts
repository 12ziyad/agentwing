import { getSandboxConfig, removeE2BKey, sandboxOwnerKeyForWorkspace } from "@/lib/agentwingStore";
import { authRequiredResponse, getDashboardAuth } from "@/lib/auth";

export const runtime = "nodejs";

function isSandboxSecretConfigured() {
  const secret = process.env.AGENTWING_SANDBOX_SECRET ?? process.env.AGENTWING_SECRET_KEY;
  if (secret) return true;
  if (process.env.NODE_ENV !== "production") return true;
  return false;
}

export async function GET(request: Request) {
  const auth = await getDashboardAuth(request);
  if (!auth) return authRequiredResponse();

  return Response.json({
    sandbox: await getSandboxConfig(sandboxOwnerKeyForWorkspace(auth.workspaceId)),
    secretMissing: !isSandboxSecretConfigured(),
  });
}

export async function DELETE(request: Request) {
  const auth = await getDashboardAuth(request);
  if (!auth) return authRequiredResponse();

  return Response.json({
    ok: true,
    sandbox: await removeE2BKey(sandboxOwnerKeyForWorkspace(auth.workspaceId)),
    message: "E2B BYOK key removed. Runtime sandbox execution is disabled until a new key is saved.",
  });
}
