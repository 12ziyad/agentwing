import { approveRunAndContinue } from "@/lib/actionRunLifecycle";
import { getActionRunByApprovalId, rejectActionRun, resolveApproval, trackEvent } from "@/lib/agentwingStore";
import { authRequiredResponse, getDashboardAuth } from "@/lib/auth";

export const runtime = "nodejs";

/**
 * Resolve an approval.
 *
 * The run and its approval are resolved together by the lifecycle functions.
 * This route used to call resolveApproval itself and then call
 * approveRunAndContinue, which resolves the approval again — both reported
 * success, because the old implementation returned `result.success`, which is
 * true for a statement that matched nothing.
 */
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await getDashboardAuth(request);
  if (!auth) return authRequiredResponse();

  const { id } = await params;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON body.", code: "invalid_json" }, { status: 400 });
  }

  const record = body && typeof body === "object" ? (body as Record<string, unknown>) : {};
  const status = typeof record.status === "string" ? record.status : undefined;
  const reason = typeof record.reason === "string" ? record.reason.slice(0, 500) : undefined;

  if (status !== "approved" && status !== "rejected") {
    return Response.json(
      { error: "status must be 'approved' or 'rejected'.", code: "invalid_status" },
      { status: 400 },
    );
  }

  const actor = auth.user.email;

  // Indexed lookup rather than scanning the newest hundred runs.
  const linkedRun = await getActionRunByApprovalId(auth.workspaceId, id);

  if (linkedRun) {
    const run =
      status === "approved"
        ? await approveRunAndContinue(linkedRun.runId, auth.workspaceId, actor, reason)
        : await rejectActionRun(linkedRun.runId, auth.workspaceId, actor, reason);

    if (!run) {
      return Response.json(
        { error: "The run linked to this approval could not be resolved.", code: "run_not_resolvable" },
        { status: 409 },
      );
    }
  } else {
    // An approval with no linked run — resolve the record on its own.
    const ok = await resolveApproval(id, auth.workspaceId, status, actor, reason);
    if (!ok) {
      return Response.json(
        { error: "Approval not found, already resolved, or not in your workspace.", code: "approval_not_pending" },
        { status: 404 },
      );
    }
  }

  await trackEvent("approval_resolved", {
    workspaceId: auth.workspaceId,
    userId: auth.user.userId,
    metadata: { approvalId: id, status, resolvedBy: actor },
  });

  return Response.json({ ok: true, approvalId: id, status, resolvedBy: actor });
}
