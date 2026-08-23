import { clearCookie, getDashboardAuth, SESSION_COOKIE_NAME, signOutSession } from "@/lib/auth";
import { trackEvent } from "@/lib/agentwingStore";

export const runtime = "nodejs";

/** Legacy shared-secret admin cookie. Retained only so existing browsers get it cleared on sign-out. */
const LEGACY_ADMIN_COOKIE_NAME = "agentwing_admin_access";

export async function POST(request: Request) {
  const auth = await getDashboardAuth(request);
  if (auth) {
    await trackEvent("user_signed_out", {
      workspaceId: auth.workspaceId,
      userId: auth.user.userId,
    });
  }

  await signOutSession(request.headers.get("cookie") ?? "");
  const headers = new Headers({ Location: "/" });
  headers.append("Set-Cookie", clearCookie(SESSION_COOKIE_NAME));
  headers.append("Set-Cookie", clearCookie(LEGACY_ADMIN_COOKIE_NAME));

  return new Response(null, {
    status: 302,
    headers,
  });
}
