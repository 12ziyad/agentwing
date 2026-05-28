import { rejectRunWithRunnerToken } from "@/lib/actionRunLifecycle";
import { trackEvent } from "@/lib/agentwingStore";
import { extractRunnerToken, reasonFromBody } from "@/lib/runnerTokenAuth";

export const runtime = "nodejs";

export async function POST(request: Request, { params }: { params: Promise<{ runId: string }> }) {
  let body: unknown;
  try {
    const text = await request.text();
    body = text ? JSON.parse(text) : {};
  } catch {
    return Response.json({ error: "Invalid JSON body.", code: "invalid_request" }, { status: 400 });
  }

  const tokenResult = extractRunnerToken(request, body);
  if (!tokenResult.ok) {
    return Response.json(
      { error: "Runner approval token is required.", code: tokenResult.code },
      { status: tokenResult.status },
    );
  }

  const { runId } = await params;
  const result = await rejectRunWithRunnerToken(runId, tokenResult.token, reasonFromBody(body));
  if (!result.ok) {
    return Response.json({ error: result.error, code: result.code ?? "invalid_runner_token" }, { status: result.status });
  }

  await trackEvent("runner_approval_rejected", {
    workspaceId: result.run.workspaceId,
    projectId: result.run.projectId,
    metadata: { runId, status: result.run.status },
  });

  return Response.json({ ok: true, run: result.run });
}
