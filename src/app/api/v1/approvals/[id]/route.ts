import { resolveApproval, trackEvent } from "@/lib/agentwingStore";
import { authRequiredResponse, getDashboardAuth } from "@/lib/auth";

export const runtime = "nodejs";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await getDashboardAuth(request);
  if (!auth) return authRequiredResponse();
  if (!auth.workspaceId) return Response.json({ error: "No workspace." }, { status: 403 });

  const { id } = await params;
  let body: unknown;
  try { body = await request.json(); } catch { return Response.json({ error: "Invalid JSON." }, { status: 400 }); }

  const status = typeof body === "object" && body && "status" in body && typeof (body as Record<string, unknown>).status === "string"
    ? ((body as Record<string, unknown>).status as string)
    : undefined;
  const reason = typeof body === "object" && body && "reason" in body && typeof (body as Record<string, unknown>).reason === "string"
    ? ((body as Record<string, unknown>).reason as string)
    : undefined;

  if (status !== "approved" && status !== "rejected") {
    return Response.json({ error: "status must be 'approved' or 'rejected'." }, { status: 400 });
  }

  const ok = await resolveApproval(id, auth.workspaceId, status, reason);
  if (!ok) return Response.json({ error: "Approval not found, already resolved, or not in your workspace." }, { status: 404 });

  await trackEvent("approval_resolved", {
    workspaceId: auth.workspaceId,
    metadata: { approvalId: id, status, reason },
  });

  return Response.json({ ok: true, approvalId: id, status });
}
