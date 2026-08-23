import { continueRunFromRunner, RunTransitionError } from "@/lib/actionRunLifecycle";
import { validateApiKeyFromRequest } from "@/lib/agentwingStore";
import { authRequiredResponse, getDashboardAuth } from "@/lib/auth";
import type { RunAuthContext } from "@/lib/actionRunLifecycle";
import { withRoute } from "@/lib/withRoute";

export const runtime = "nodejs";

async function handlePOST(request: Request, { params }: { params: Promise<{ runId: string }> }) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON body.", code: "invalid_json" }, { status: 400 });
  }

  const { runId } = await params;
  const payload = body && typeof body === "object" ? body : {};

  let auth: RunAuthContext;
  const apiAuth = await validateApiKeyFromRequest(request);
  if (apiAuth) {
    auth = apiAuth;
  } else {
    const dashboardAuth = await getDashboardAuth(request);
    if (!dashboardAuth) return authRequiredResponse();
    auth = { apiKeyId: "dashboard", workspaceId: dashboardAuth.workspaceId };
  }

  try {
    const run = await continueRunFromRunner(runId, auth, payload);
    if (!run) return Response.json({ error: "Run not found.", code: "run_not_found" }, { status: 404 });
    return Response.json({ run });
  } catch (error) {
    // An illegal transition is a conflict, not a bad request: the payload was
    // well-formed, the run is simply not in a state that permits it.
    if (error instanceof RunTransitionError) {
      return Response.json({ error: error.message, code: error.code }, { status: error.status });
    }
    throw error;
  }
}

export const POST = withRoute("v1/action-runs/[runId]/continue", handlePOST);
