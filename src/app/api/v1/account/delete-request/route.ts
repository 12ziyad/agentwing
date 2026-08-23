import {
  deleteAllSessionsForUser,
  requestAccountDeletion,
  revokeAllApiKeys,
  trackEvent,
} from "@/lib/agentwingStore";
import { authRequiredResponse, clearCookie, getDashboardAuth, SESSION_COOKIE_NAME } from "@/lib/auth";
import { ForbiddenError, forbiddenResponse, requireCapability } from "@/lib/rbac";
import { withRoute } from "@/lib/withRoute";

export const runtime = "nodejs";

/**
 * Request account deletion.
 *
 * Deletion used to set two status flags and nothing else — sessions stayed
 * valid, API keys kept authenticating, and every row remained readable. The
 * request had no observable effect, while the UI said "permanently delete …
 * this cannot be undone".
 *
 * Access is now withdrawn immediately and irreversibly: every API key for the
 * workspace is revoked and every session for the user is destroyed, so nothing
 * belonging to the account can act after this call returns. The rows are marked
 * for erasure and removed by an operator, which is the part that still requires
 * a human — so that is what the response and the UI now say.
 */
async function handlePOST(request: Request) {
  const auth = await getDashboardAuth(request);
  if (!auth) return authRequiredResponse();

  try {
    requireCapability(auth, "workspace:delete");
  } catch (error) {
    if (error instanceof ForbiddenError) return forbiddenResponse(error);
    throw error;
  }

  const { userId } = auth.user;
  const { workspaceId } = auth;

  try {
    const result = await requestAccountDeletion(userId, workspaceId);

    // Withdraw access first. If the sweep below fails, the account is already
    // unable to act, which is the property that actually matters.
    const [keysRevoked, sessionsDestroyed] = await Promise.all([
      revokeAllApiKeys(workspaceId),
      deleteAllSessionsForUser(userId),
    ]);

    await trackEvent("account_deletion_requested", {
      workspaceId,
      userId,
      metadata: {
        deleteRequestedAt: result.deleteRequestedAt,
        keysRevoked,
        sessionsDestroyed,
      },
    });

    return Response.json(
      {
        ok: true,
        keysRevoked,
        sessionsDestroyed,
        message:
          "Access has been withdrawn. Every API key for this workspace is revoked and every session is signed out. " +
          "Stored data is scheduled for erasure and is removed by an operator.",
      },
      { headers: { "set-cookie": clearCookie(SESSION_COOKIE_NAME) } },
    );
  } catch {
    await trackEvent("account_deletion_requested", {
      workspaceId,
      userId,
      status: "error",
    });

    return Response.json(
      { error: "Unable to record the deletion request right now.", code: "deletion_request_failed" },
      { status: 500 },
    );
  }
}

export const POST = withRoute("v1/account/delete-request", handlePOST);
