import { continueRunFromRunner } from "@/lib/actionRunLifecycle";
import { validateApiKeyFromRequest } from "@/lib/agentwingStore";
import { authRequiredResponse, getDashboardAuth } from "@/lib/auth";

export const runtime = "nodejs";

export async function POST(request: Request, { params }: { params: Promise<{ runId: string }> }) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const { runId } = await params;
  const apiAuth = await validateApiKeyFromRequest(request);
  if (apiAuth) {
    const run = await continueRunFromRunner(runId, apiAuth, body && typeof body === "object" ? body : {});
    if (!run) return Response.json({ error: "Run not found." }, { status: 404 });
    return Response.json({ run });
  }

  const dashboardAuth = await getDashboardAuth(request);
  if (!dashboardAuth) return authRequiredResponse();
  if (!dashboardAuth.workspaceId) return Response.json({ error: "Workspace required." }, { status: 403 });

  const run = await continueRunFromRunner(
    runId,
    { apiKeyId: "dashboard", workspaceId: dashboardAuth.workspaceId },
    body && typeof body === "object" ? body : {},
  );
  if (!run) return Response.json({ error: "Run not found." }, { status: 404 });

  return Response.json({ run });
}
