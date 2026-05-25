import { getSandboxConfig, removeE2BKey } from "@/lib/agentwingStore";
import { adminRequiredResponse, isAdminRequest } from "@/lib/adminAccess";

export const runtime = "nodejs";

export async function GET(request: Request) {
  if (!(await isAdminRequest(request))) return adminRequiredResponse();

  return Response.json({
    sandbox: await getSandboxConfig(),
  });
}

export async function DELETE(request: Request) {
  if (!(await isAdminRequest(request))) return adminRequiredResponse();

  return Response.json({
    ok: true,
    sandbox: await removeE2BKey(),
    message: "E2B BYOK key removed. Runtime sandbox execution is disabled until a new key is saved.",
  });
}
