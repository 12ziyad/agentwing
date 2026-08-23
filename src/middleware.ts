import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { checkRateLimit, rateLimitKey } from "@/lib/rateLimit";

/**
 * Cross-site request forgery protection for cookie-authenticated routes.
 *
 * The dashboard's session cookie is `SameSite=Lax`, which stops cross-site
 * POSTs from most contexts but is a single layer — and the routes it protects
 * include approve and reject, the most consequential controls in the product.
 *
 * Requests carrying an `Authorization` header are exempt: they are API-key
 * calls, which are not cookie-authenticated and therefore not forgeable by a
 * third-party site.
 */

const UNSAFE_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);

/** Fetch metadata values that mean "this request did not come from another site". */
const SAFE_FETCH_SITES = new Set(["same-origin", "same-site", "none"]);

/**
 * Per-window request ceilings, by area.
 *
 * Auth is tightest because it is the brute-forceable surface. The decision API
 * is generous because a busy agent legitimately makes many calls, and the plan
 * quota is what bounds total usage — this only stops a runaway loop.
 */
const RATE_LIMITS: ReadonlyArray<{ prefix: string; scope: string; limit: number; windowMs: number }> = [
  { prefix: "/api/auth/", scope: "auth", limit: 20, windowMs: 60_000 },
  { prefix: "/api/v1/", scope: "v1", limit: 600, windowMs: 60_000 },
  { prefix: "/api/", scope: "api", limit: 300, windowMs: 60_000 },
];

export function middleware(request: NextRequest) {
  const path = request.nextUrl.pathname;

  const rule = RATE_LIMITS.find((candidate) => path.startsWith(candidate.prefix));
  if (rule) {
    const result = checkRateLimit(rateLimitKey(request, rule.scope), rule.limit, rule.windowMs);
    if (!result.allowed) {
      return NextResponse.json(
        { error: "Too many requests.", code: "rate_limited", retryAfterSeconds: result.retryAfterSeconds },
        {
          status: 429,
          headers: {
            "retry-after": String(result.retryAfterSeconds),
            "cache-control": "no-store",
            "x-ratelimit-limit": String(rule.limit),
            "x-ratelimit-remaining": "0",
            "x-ratelimit-reset": String(Math.ceil(result.resetAt / 1000)),
          },
        },
      );
    }
  }

  if (!UNSAFE_METHODS.has(request.method)) return NextResponse.next();

  // Bearer-authenticated calls are not cookie-authenticated, so CSRF does not
  // apply. Machine callers also cannot be relied on to send Origin.
  if (request.headers.get("authorization")) return NextResponse.next();

  // Sec-Fetch-Site is set by the browser and cannot be forged by page script.
  // Prefer it when present.
  const fetchSite = request.headers.get("sec-fetch-site");
  if (fetchSite) {
    if (SAFE_FETCH_SITES.has(fetchSite)) return NextResponse.next();
    return forbidden("This request appears to originate from another site.");
  }

  // Fall back to Origin for clients that do not send fetch metadata.
  const origin = request.headers.get("origin");
  if (!origin) {
    // No Origin and no fetch metadata: not a browser form post. Allow, since
    // there is no cookie-bearing cross-site vector without one of the two.
    return NextResponse.next();
  }

  let originHost: string;
  try {
    originHost = new URL(origin).host;
  } catch {
    return forbidden("Malformed Origin header.");
  }

  if (originHost !== request.nextUrl.host) {
    return forbidden("Origin does not match the request host.");
  }

  return NextResponse.next();
}

function forbidden(message: string) {
  return NextResponse.json(
    { error: message, code: "cross_site_request_blocked" },
    { status: 403, headers: { "cache-control": "no-store" } },
  );
}

export const config = {
  // Static assets cannot be state-changing, so keep them off the hot path.
  matcher: ["/((?!_next/static|_next/image|favicon.ico|icon.png|.*\\.svg$|.*\\.png$).*)"],
};
