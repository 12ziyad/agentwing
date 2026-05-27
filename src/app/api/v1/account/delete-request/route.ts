import { requestAccountDeletion, trackEvent } from "@/lib/agentwingStore";
import { authRequiredResponse, getDashboardAuth } from "@/lib/auth";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const auth = await getDashboardAuth(request);
  if (!auth) return authRequiredResponse();

  if (auth.mode !== "user") {
    return Response.json(
      { error: "Google account session required." },
      { status: 403 },
    );
  }

  try {
    const result = await requestAccountDeletion(auth.user.userId, auth.workspace.workspaceId);
    await trackEvent("account_deletion_requested", {
      workspaceId: auth.workspace.workspaceId,
      userId: auth.user.userId,
      metadata: {
        workspaceId: auth.workspace.workspaceId,
        deleteRequestedAt: result.deleteRequestedAt,
        reviewRequired: true,
      },
    });

    return Response.json({
      ok: true,
      message: "Your account deletion request has been recorded.",
    });
  } catch {
    await trackEvent("account_deletion_requested", {
      workspaceId: auth.workspace.workspaceId,
      userId: auth.user.userId,
      status: "error",
      metadata: { reviewRequired: true },
    });

    return Response.json(
      { error: "Unable to record account deletion request right now." },
      { status: 500 },
    );
  }
}
