import { deleteCustomPolicy, updateCustomPolicy, trackEvent } from "@/lib/agentwingStore";
import { authRequiredResponse, getDashboardAuth } from "@/lib/auth";
import { parsePolicyInput, PolicyInputError } from "@/lib/policyInput";

export const runtime = "nodejs";

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

  let input;
  try {
    // Identical validation to POST. These used to diverge: POST checked the
    // decision enum and PATCH did not, so a policy could be updated to an
    // unknown decision that no rule knew how to apply.
    input = parsePolicyInput(body, { partial: true });
  } catch (error) {
    if (error instanceof PolicyInputError) {
      return Response.json({ error: error.message, code: error.code }, { status: error.status });
    }
    throw error;
  }

  const updated = await updateCustomPolicy(id, auth.workspaceId, input);
  if (!updated) {
    return Response.json({ error: "Policy not found.", code: "policy_not_found" }, { status: 404 });
  }

  await trackEvent("custom_policy_updated", {
    workspaceId: auth.workspaceId,
    userId: auth.user.userId,
    metadata: { policyId: id },
  });

  return Response.json({ ok: true });
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await getDashboardAuth(request);
  if (!auth) return authRequiredResponse();

  const { id } = await params;
  const deleted = await deleteCustomPolicy(id, auth.workspaceId);

  if (!deleted) {
    return Response.json({ error: "Policy not found.", code: "policy_not_found" }, { status: 404 });
  }

  await trackEvent("custom_policy_deleted", {
    workspaceId: auth.workspaceId,
    userId: auth.user.userId,
    metadata: { policyId: id },
  });

  return Response.json({ ok: true });
}
