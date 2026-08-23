import { rejectActionRun, trackEvent } from "@/lib/agentwingStore";
import { authRequiredResponse, getDashboardAuth } from "@/lib/auth";
import { ForbiddenError, forbiddenResponse, requireCapability } from "@/lib/rbac";
import { withRoute } from "@/lib/withRoute";

export const runtime = "nodejs";

function reasonFromBody(body: unknown) {
  return body && typeof body === "object" && typeof (body as Record<string, unknown>).reason === "string"
    ? ((body as Record<string, unknown>).reason as string)
    : undefined;
}

async function handlePOST(request: Request, { params }: { params: Promise<{ runId: string }> }) {
  const auth = await getDashboardAuth(request);
  if (!auth) return authRequiredResponse();

  try {
    requireCapability(auth, "run:approve");
  } catch (error) {
    if (error instanceof ForbiddenError) return forbiddenResponse(error);
    throw error;
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    body = {};
  }

  const { runId } = await params;
  const run = await rejectActionRun(runId, auth.workspaceId, auth.user.email, reasonFromBody(body));
  if (!run) return Response.json({ error: "Run not found." }, { status: 404 });

  await trackEvent("action_run_rejected", {
    workspaceId: auth.workspaceId,
    userId: auth.user.userId,
    projectId: run.projectId,
    metadata: { runId },
  });

  return Response.json({ run });
}

export const POST = withRoute("v1/action-runs/[runId]/reject", handlePOST);
