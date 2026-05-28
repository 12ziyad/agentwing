import { listActionRuns, validateApiKeyFromRequest } from "@/lib/agentwingStore";
import { authRequiredResponse, getDashboardAuth } from "@/lib/auth";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const projectId = searchParams.get("projectId") ?? undefined;
  const limit = Math.min(200, Math.max(1, Number(searchParams.get("limit") ?? "100") || 100));

  const apiAuth = await validateApiKeyFromRequest(request);
  if (apiAuth) {
    return Response.json({
      runs: await listActionRuns(apiAuth.workspaceId, projectId ?? apiAuth.projectId, limit),
    });
  }

  const dashboardAuth = await getDashboardAuth(request);
  if (!dashboardAuth) return authRequiredResponse();

  return Response.json({
    runs: await listActionRuns(dashboardAuth.workspaceId, projectId, limit),
  });
}
