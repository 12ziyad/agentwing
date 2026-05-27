import {
  clearCookie,
  createSessionForGoogleProfile,
  exchangeGoogleCode,
  getCookieValue,
  getGoogleProfile,
  OAUTH_STATE_COOKIE_NAME,
  sessionCookie,
} from "@/lib/auth";
import { trackEvent } from "@/lib/agentwingStore";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const cookieState = getCookieValue(request.headers.get("cookie") ?? "", OAUTH_STATE_COOKIE_NAME);

  if (!code || !state || !cookieState || state !== cookieState) {
    return new Response(null, {
      status: 302,
      headers: {
        Location: "/dashboard?auth=failed",
        "Set-Cookie": clearCookie(OAUTH_STATE_COOKIE_NAME),
      },
    });
  }

  try {
    const accessToken = await exchangeGoogleCode(request, code);
    const profile = await getGoogleProfile(accessToken);
    const session = await createSessionForGoogleProfile(profile);
    const headers = new Headers({ Location: "/dashboard" });
    headers.append("Set-Cookie", clearCookie(OAUTH_STATE_COOKIE_NAME));
    headers.append("Set-Cookie", sessionCookie(session.token, session.maxAge));

    await trackEvent("user_signed_in", {
      workspaceId: session.workspace.workspaceId,
      userId: session.user.userId,
      metadata: { email: session.user.email },
    });

    return new Response(null, {
      status: 302,
      headers,
    });
  } catch {
    return new Response(null, {
      status: 302,
      headers: {
        Location: "/dashboard?auth=failed",
        "Set-Cookie": clearCookie(OAUTH_STATE_COOKIE_NAME),
      },
    });
  }
}
