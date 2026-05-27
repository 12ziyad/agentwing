import { deleteCustomPolicy, updateCustomPolicy, trackEvent } from "@/lib/agentwingStore";
import { authRequiredResponse, getDashboardAuth } from "@/lib/auth";

export const runtime = "nodejs";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await getDashboardAuth(request);
  if (!auth) return authRequiredResponse();
  if (!auth.workspaceId) return Response.json({ error: "Workspace required." }, { status: 400 });

  const { id } = await params;
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const b = (body ?? {}) as Record<string, unknown>;
  const updated = await updateCustomPolicy(id, auth.workspaceId, {
    name: typeof b.name === "string" ? b.name : undefined,
    description: typeof b.description === "string" ? b.description : undefined,
    actionType: typeof b.actionType === "string" ? b.actionType : undefined,
    tool: typeof b.tool === "string" ? b.tool : undefined,
    targetPattern: typeof b.targetPattern === "string" ? b.targetPattern : undefined,
    commandPattern: typeof b.commandPattern === "string" ? b.commandPattern : undefined,
    decision: typeof b.decision === "string" ? b.decision : undefined,
    risk: typeof b.risk === "string" ? b.risk : undefined,
    priority: typeof b.priority === "number" ? b.priority : undefined,
    enabled: typeof b.enabled === "boolean" ? b.enabled : undefined,
    feedback: typeof b.feedback === "string" ? b.feedback : undefined,
  });

  if (!updated) {
    return Response.json({ error: "Policy not found." }, { status: 404 });
  }

  await trackEvent("custom_policy_updated", {
    workspaceId: auth.workspaceId,
    userId: auth.mode === "user" ? auth.user.userId : undefined,
    metadata: { policyId: id },
  });

  return Response.json({ ok: true });
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await getDashboardAuth(request);
  if (!auth) return authRequiredResponse();
  if (!auth.workspaceId) return Response.json({ error: "Workspace required." }, { status: 400 });

  const { id } = await params;
  const deleted = await deleteCustomPolicy(id, auth.workspaceId);

  if (!deleted) {
    return Response.json({ error: "Policy not found." }, { status: 404 });
  }

  await trackEvent("custom_policy_deleted", {
    workspaceId: auth.workspaceId,
    userId: auth.mode === "user" ? auth.user.userId : undefined,
    metadata: { policyId: id },
  });

  return Response.json({ ok: true });
}
