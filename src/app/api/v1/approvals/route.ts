import { listApprovals } from "@/lib/agentwingStore";
import { authRequiredResponse, getDashboardAuth } from "@/lib/auth";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const auth = await getDashboardAuth(request);
  if (!auth) return authRequiredResponse();
  if (!auth.workspaceId) return Response.json({ approvals: [] });

  const { searchParams } = new URL(request.url);
  const status = searchParams.get("status") ?? undefined;

  const approvals = await listApprovals(auth.workspaceId, status);
  return Response.json({ approvals });
}
