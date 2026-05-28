import { approveRunWithRunnerToken } from "@/lib/actionRunLifecycle";
import { trackEvent } from "@/lib/agentwingStore";

export const runtime = "nodejs";

function tokenFromBody(body: unknown) {
  if (!body || typeof body !== "object") return undefined;
  const value = (body as Record<string, unknown>).runnerApprovalToken ?? (body as Record<string, unknown>).token;
  return typeof value === "string" ? value : undefined;
}

function reasonFromBody(body: unknown) {
  if (!body || typeof body !== "object") return undefined;
  const value = (body as Record<string, unknown>).reason;
  return typeof value === "string" ? value.slice(0, 500) : undefined;
}

export async function POST(request: Request, { params }: { params: Promise<{ runId: string }> }) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const token = tokenFromBody(body);
  if (!token) {
    return Response.json({ error: "runnerApprovalToken is required." }, { status: 401 });
  }

  const { runId } = await params;
  const result = await approveRunWithRunnerToken(runId, token, reasonFromBody(body));
  if (!result.ok) return Response.json({ error: result.error }, { status: result.status });

  await trackEvent("runner_approval_approved", {
    workspaceId: result.run.workspaceId,
    projectId: result.run.projectId,
    metadata: { runId, status: result.run.status },
  });

  return Response.json({
    run: result.run,
    nextStep: result.run.nextStep ?? "Approval recorded. Continue only through the configured runner.",
  });
}
