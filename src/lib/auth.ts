import {
  createUserSession,
  deleteUserSession,
  getUserSession,
  upsertGoogleUserAndWorkspace,
} from "@/lib/agentwingStore";
import type { DashboardAuthContext } from "@/lib/agentwingTypes";
import { discover, verifiedEmail, verifyIdToken } from "@/lib/oidc";
import { startTransaction } from "@/lib/oauthTransactions";

export const SESSION_COOKIE_NAME = "agentwing_session";
export const OAUTH_STATE_COOKIE_NAME = "agentwing_oauth_state";
const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 30;

function randomToken(bytesLength = 32) {
  const bytes = new Uint8Array(bytesLength);
  globalThis.crypto.getRandomValues(bytes);
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

export async function hashSessionToken(token: string) {
  const digest = await globalThis.crypto.subtle.digest("SHA-256", new TextEncoder().encode(token));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

export function getCookieValue(cookieHeader: string, name: string) {
  return Object.fromEntries(
    cookieHeader
      .split(";")
      .map((entry) => entry.trim())
      .filter(Boolean)
      .map((entry) => {
        const index = entry.indexOf("=");
        return index === -1 ? [entry, ""] : [entry.slice(0, index), decodeURIComponent(entry.slice(index + 1))];
      }),
  )[name];
}

export function serializeCookie(
  name: string,
  value: string,
  options: { maxAge?: number; expires?: Date; httpOnly?: boolean; secure?: boolean } = {},
) {
  const parts = [`${name}=${encodeURIComponent(value)}`, "Path=/", "SameSite=Lax"];
  if (options.httpOnly ?? true) parts.push("HttpOnly");
  if (options.secure ?? process.env.NODE_ENV === "production") parts.push("Secure");
  if (typeof options.maxAge === "number") parts.push(`Max-Age=${options.maxAge}`);
  if (options.expires) parts.push(`Expires=${options.expires.toUTCString()}`);
  return parts.join("; ");
}

export function clearCookie(name: string) {
  return serializeCookie(name, "", { maxAge: 0, expires: new Date(0) });
}

function authBaseUrl(request: Request) {
  return (process.env.AUTH_URL ?? process.env.NEXTAUTH_URL ?? new URL(request.url).origin).replace(/\/$/, "");
}

function googleClientId() {
  return process.env.GOOGLE_CLIENT_ID ?? process.env.AUTH_GOOGLE_ID;
}

function googleClientSecret() {
  return process.env.GOOGLE_CLIENT_SECRET ?? process.env.AUTH_GOOGLE_SECRET;
}

/**
 * Build the Google authorization URL.
 *
 * Carries a PKCE challenge and a nonce. Without PKCE an intercepted code can be
 * redeemed by whoever intercepted it; without a nonce a token minted for another
 * session can be replayed into this one.
 */
export async function getGoogleSigninUrl(request: Request, redirectTo?: string) {
  const clientId = googleClientId();
  if (!clientId) throw new Error("Set GOOGLE_CLIENT_ID or AUTH_GOOGLE_ID.");

  const transaction = await startTransaction({ provider: "google", redirectTo });

  const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  url.searchParams.set("client_id", clientId);
  url.searchParams.set("redirect_uri", `${authBaseUrl(request)}/api/auth/callback/google`);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", "openid email profile");
  url.searchParams.set("state", transaction.state);
  url.searchParams.set("nonce", transaction.nonce);
  url.searchParams.set("code_challenge", transaction.codeChallenge);
  url.searchParams.set("code_challenge_method", "S256");
  url.searchParams.set("prompt", "select_account");

  return { url, state: transaction.state };
}

const GOOGLE_ISSUER = "https://accounts.google.com";

/**
 * Exchange the code and verify the identity it represents.
 *
 * The previous implementation read only `access_token` and threw the id token
 * away, then fetched the profile from the userinfo endpoint. Nothing was ever
 * checked against Google's signing keys, so the identity rested entirely on
 * having called the right URL. This verifies signature, issuer, audience,
 * expiry and nonce, and refuses an unverified email address.
 */
export async function exchangeGoogleCodeForProfile(
  request: Request,
  code: string,
  transaction: { codeVerifier: string; nonce: string },
) {
  const clientId = googleClientId();
  const clientSecret = googleClientSecret();
  if (!clientId || !clientSecret) throw new Error("Google OAuth credentials are not configured.");

  const discovery = await discover(GOOGLE_ISSUER);

  const response = await fetch(discovery.token_endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: `${authBaseUrl(request)}/api/auth/callback/google`,
      grant_type: "authorization_code",
      code_verifier: transaction.codeVerifier,
    }),
    // An authorization code is single-use, so a retry after the server received
    // it burns the code. One attempt, bounded.
    signal: AbortSignal.timeout(10_000),
  });

  const token = (await response.json().catch(() => ({}))) as { id_token?: string; error?: string };
  if (!response.ok || !token.id_token) {
    throw new Error(token.error ? `Google token exchange failed: ${token.error}` : "Google token exchange failed.");
  }

  const claims = await verifyIdToken(token.id_token, {
    discovery,
    clientId,
    nonce: transaction.nonce,
  });

  return {
    providerAccountId: claims.sub,
    email: verifiedEmail(claims),
    name: typeof claims.name === "string" ? claims.name : undefined,
    image: typeof claims.picture === "string" ? claims.picture : undefined,
  };
}

export async function createSessionForGoogleProfile(profile: Awaited<ReturnType<typeof exchangeGoogleCodeForProfile>>) {
  const { user, workspace } = await upsertGoogleUserAndWorkspace(profile);
  const token = randomToken(32);
  const tokenHash = await hashSessionToken(token);
  const expiresAt = new Date(Date.now() + SESSION_MAX_AGE_SECONDS * 1000).toISOString();
  await createUserSession(user.userId, tokenHash, expiresAt);
  return { token, user, workspace, maxAge: SESSION_MAX_AGE_SECONDS };
}

export async function getDashboardAuthFromCookieHeader(cookieHeader: string): Promise<DashboardAuthContext | undefined> {
  const sessionToken = getCookieValue(cookieHeader, SESSION_COOKIE_NAME);
  if (!sessionToken) return undefined;

  return getUserSession(await hashSessionToken(sessionToken));
}

export async function getDashboardAuth(request: Request) {
  return getDashboardAuthFromCookieHeader(request.headers.get("cookie") ?? "");
}

export async function signOutSession(cookieHeader: string) {
  const sessionToken = getCookieValue(cookieHeader, SESSION_COOKIE_NAME);
  if (sessionToken) {
    await deleteUserSession(await hashSessionToken(sessionToken));
  }
}

export function authRequiredResponse() {
  return Response.json(
    {
      error: "Dashboard sign-in required",
      feedback: "Sign in at /dashboard to continue.",
    },
    { status: 401 },
  );
}

export function sessionCookie(token: string, maxAge: number) {
  return serializeCookie(SESSION_COOKIE_NAME, token, { maxAge });
}
