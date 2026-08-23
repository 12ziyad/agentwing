import { getGoogleSigninUrl } from "@/lib/auth";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    // The PKCE verifier and nonce are stored server-side against `state`, not in
    // a cookie — a cookie holding the verifier can be read or replaced by page
    // script, which defeats the point of PKCE.
    const { url } = await getGoogleSigninUrl(request);
    return new Response(null, { status: 302, headers: { Location: url.toString() } });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Unable to start Google sign-in.", code: "signin_failed" },
      { status: 500 },
    );
  }
}
