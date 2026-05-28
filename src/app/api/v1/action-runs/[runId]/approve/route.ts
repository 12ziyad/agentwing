import { approveRunAndContinue } from "@/lib/actionRunLifecycle";
import { trackEvent } from "@/lib/agentwingStore";
import { authRequiredResponse, getDashboardAuth } from "@/lib/auth";

export const runtime = "nodejs";

function reasonFromBody(body: unknown) {
  return body && typeof body === "object" && typeof (body as Record<string, unknown>).reason === "string"
    ? ((body as Record<string, unknown>).reason as string)
    : undefined;
}

export async function POST(request: Request, { params }: { params: Promise<{ runId: string }> }) {
  const auth = await getDashboardAuth(request);
  if (!auth) return authRequiredResponse();
  if (!auth.workspaceId) return Response.json({ error: "Workspace required." }, { status: 403 });

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    body = {};
  }

  const { runId } = await params;
  const run = await approveRunAndContinue(runId, auth.workspaceId, reasonFromBody(body));
  if (!run) return Response.json({ error: "Run not found or not awaiting approval." }, { status: 404 });

  await trackEvent("action_run_approved", {
    workspaceId: auth.workspaceId,
    userId: auth.mode === "user" ? auth.user.userId : undefined,
    projectId: run.projectId,
    metadata: { runId, status: run.status },
  });

  return Response.json({ run });
}
