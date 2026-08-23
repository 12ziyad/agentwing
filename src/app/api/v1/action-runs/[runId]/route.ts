import { getActionRun, listExecutionEvents, validateApiKeyFromRequest } from "@/lib/agentwingStore";
import { authRequiredResponse, getDashboardAuth } from "@/lib/auth";
import { withRoute } from "@/lib/withRoute";

export const runtime = "nodejs";

async function handleGET(request: Request, { params }: { params: Promise<{ runId: string }> }) {
  const { runId } = await params;

  const apiAuth = await validateApiKeyFromRequest(request);
  if (apiAuth) {
    const run = await getActionRun(runId, apiAuth.workspaceId);
    if (!run) return Response.json({ error: "Run not found." }, { status: 404 });
    return Response.json({ run, events: await listExecutionEvents(runId, apiAuth.workspaceId) });
  }

  const dashboardAuth = await getDashboardAuth(request);
  if (!dashboardAuth) return authRequiredResponse();

  const run = await getActionRun(runId, dashboardAuth.workspaceId);
  if (!run) return Response.json({ error: "Run not found." }, { status: 404 });

  return Response.json({ run, events: await listExecutionEvents(runId, dashboardAuth.workspaceId) });
}

export const GET = withRoute("v1/action-runs/[runId]", handleGET);
