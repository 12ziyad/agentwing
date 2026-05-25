import { getGoogleSigninUrl, serializeCookie, OAUTH_STATE_COOKIE_NAME } from "@/lib/auth";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    const { url, state } = getGoogleSigninUrl(request);
    return new Response(null, {
      status: 302,
      headers: {
        Location: url.toString(),
        "Set-Cookie": serializeCookie(OAUTH_STATE_COOKIE_NAME, state, { maxAge: 60 * 10 }),
      },
    });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Unable to start Google sign-in." },
      { status: 500 },
    );
  }
}
