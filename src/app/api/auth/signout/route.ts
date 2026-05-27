import { clearCookie, getDashboardAuth, SESSION_COOKIE_NAME, signOutSession } from "@/lib/auth";
import { ADMIN_COOKIE_NAME } from "@/lib/adminAccess";
import { trackEvent } from "@/lib/agentwingStore";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const auth = await getDashboardAuth(request);
  if (auth?.mode === "user") {
    await trackEvent("user_signed_out", {
      workspaceId: auth.workspaceId,
      userId: auth.user.userId,
    });
  }

  await signOutSession(request.headers.get("cookie") ?? "");
  const headers = new Headers({ Location: "/" });
  headers.append("Set-Cookie", clearCookie(SESSION_COOKIE_NAME));
  headers.append("Set-Cookie", clearCookie(ADMIN_COOKIE_NAME));

  return new Response(null, {
    status: 302,
    headers,
  });
}
