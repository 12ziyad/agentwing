import { listApprovals } from "@/lib/agentwingStore";
import { authRequiredResponse, getDashboardAuth } from "@/lib/auth";
import { withRoute } from "@/lib/withRoute";

export const runtime = "nodejs";

async function handleGET(request: Request) {
  const auth = await getDashboardAuth(request);
  if (!auth) return authRequiredResponse();

  const { searchParams } = new URL(request.url);
  const status = searchParams.get("status") ?? undefined;

  const approvals = await listApprovals(auth.workspaceId, status);
  return Response.json({ approvals });
}

export const GET = withRoute("v1/approvals", handleGET);
