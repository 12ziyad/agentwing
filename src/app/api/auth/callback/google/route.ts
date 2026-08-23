import { createSessionForGoogleProfile, exchangeGoogleCodeForProfile, sessionCookie } from "@/lib/auth";
import { consumeTransaction } from "@/lib/oauthTransactions";
import { trackEvent } from "@/lib/agentwingStore";

export const runtime = "nodejs";

function failed(reason: string) {
  return new Response(null, {
    status: 302,
    headers: { Location: `/dashboard?auth=failed&reason=${encodeURIComponent(reason)}` },
  });
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");

  if (!code || !state) return failed("missing_parameters");

  // Claiming the transaction is a compare-and-swap, so a replayed callback
  // finds nothing to claim rather than starting a second session from one
  // authorization. It also carries the PKCE verifier and the nonce, which is
  // what ties this callback to the sign-in that started it.
  const transaction = await consumeTransaction(state);
  if (!transaction || transaction.provider !== "google") return failed("invalid_state");

  try {
    const profile = await exchangeGoogleCodeForProfile(request, code, transaction);
    const session = await createSessionForGoogleProfile(profile);

    await trackEvent("user_signed_in", {
      workspaceId: session.workspace.workspaceId,
      userId: session.user.userId,
    });

    return new Response(null, {
      status: 302,
      headers: {
        Location: transaction.redirectTo ?? "/dashboard",
        "Set-Cookie": sessionCookie(session.token, session.maxAge),
      },
    });
  } catch (error) {
    // The reason is surfaced because "sign-in failed" with no explanation is
    // indistinguishable from a bug, and the common cause here is an unverified
    // email address, which the user can actually fix.
    const reason =
      error instanceof Error && "code" in error && typeof (error as { code?: unknown }).code === "string"
        ? ((error as { code: string }).code)
        : "exchange_failed";
    return failed(reason);
  }
}
