import { ADMIN_COOKIE_NAME, getAdminAccessCode, hashAdminAccessCode } from "@/lib/adminAccess";
import {
  createUserSession,
  deleteUserSession,
  getUserSession,
  upsertGoogleUserAndWorkspace,
} from "@/lib/agentwingStore";
import type { DashboardAuthContext } from "@/lib/agentwingTypes";

export const SESSION_COOKIE_NAME = "agentwing_session";
export const OAUTH_STATE_COOKIE_NAME = "agentwing_oauth_state";
const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 30;

type GoogleProfile = {
  sub?: string;
  email?: string;
  email_verified?: boolean;
  name?: string;
  picture?: string;
};

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

export function getGoogleSigninUrl(request: Request) {
  const clientId = googleClientId();
  if (!clientId) throw new Error("Set GOOGLE_CLIENT_ID or AUTH_GOOGLE_ID.");

  const state = randomToken(24);
  const redirectUri = `${authBaseUrl(request)}/api/auth/callback/google`;
  const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  url.searchParams.set("client_id", clientId);
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", "openid email profile");
  url.searchParams.set("state", state);
  url.searchParams.set("prompt", "select_account");
  return { url, state };
}

export async function exchangeGoogleCode(request: Request, code: string) {
  const clientId = googleClientId();
  const clientSecret = googleClientSecret();
  if (!clientId || !clientSecret) throw new Error("Google OAuth credentials are not configured.");

  const redirectUri = `${authBaseUrl(request)}/api/auth/callback/google`;
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
      grant_type: "authorization_code",
    }),
  });

  const token = (await response.json().catch(() => ({}))) as { access_token?: string; error?: string };
  if (!response.ok || !token.access_token) {
    throw new Error(token.error ? `Google token exchange failed: ${token.error}` : "Google token exchange failed.");
  }

  return token.access_token;
}

export async function getGoogleProfile(accessToken: string) {
  const response = await fetch("https://openidconnect.googleapis.com/v1/userinfo", {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const profile = (await response.json().catch(() => ({}))) as GoogleProfile;

  if (!response.ok || !profile.sub || !profile.email) {
    throw new Error("Google profile lookup failed.");
  }

  return {
    providerAccountId: profile.sub,
    email: profile.email,
    name: profile.name,
    image: profile.picture,
  };
}

export async function createSessionForGoogleProfile(profile: Awaited<ReturnType<typeof getGoogleProfile>>) {
  const { user, workspace } = await upsertGoogleUserAndWorkspace(profile);
  const token = randomToken(32);
  const tokenHash = await hashSessionToken(token);
  const expiresAt = new Date(Date.now() + SESSION_MAX_AGE_SECONDS * 1000).toISOString();
  await createUserSession(user.userId, tokenHash, expiresAt);
  return { token, user, workspace, maxAge: SESSION_MAX_AGE_SECONDS };
}

export async function getDashboardAuthFromCookieHeader(cookieHeader: string): Promise<DashboardAuthContext | undefined> {
  const sessionToken = getCookieValue(cookieHeader, SESSION_COOKIE_NAME);
  if (sessionToken) {
    const session = await getUserSession(await hashSessionToken(sessionToken));
    if (session) return session;
  }

  const accessCode = getAdminAccessCode();
  const adminCookie = getCookieValue(cookieHeader, ADMIN_COOKIE_NAME);
  if (accessCode && adminCookie === (await hashAdminAccessCode(accessCode))) {
    return { mode: "admin" };
  }

  return undefined;
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
      feedback: "Sign in with Google or use the admin access fallback from /dashboard.",
    },
    { status: 401 },
  );
}

export function sessionCookie(token: string, maxAge: number) {
  return serializeCookie(SESSION_COOKIE_NAME, token, { maxAge });
}
