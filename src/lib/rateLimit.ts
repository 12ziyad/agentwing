import type { ApiKeyUsage } from "./agentwingTypes";

/**
 * Plan quotas.
 *
 * These are lifetime counters against a plan allowance — they are NOT a rate
 * limit, and naming them one was misleading. A rate limit bounds requests per
 * unit of time and protects the service; these bound total usage per key and
 * protect the bill. Abuse control lives in `windowLimiter` below.
 *
 * The comparison is `>=` rather than `>`. With `>`, a key whose limit was 1000
 * could make 1001 calls before being stopped.
 */
export function actionCheckLimitExceeded(usage: ApiKeyUsage) {
  return usage.actionChecksUsed >= usage.actionCheckLimit;
}

export function sandboxRunLimitExceeded(usage: ApiKeyUsage) {
  return usage.sandboxRunsUsed >= usage.sandboxRunLimit;
}

export function actionCheckLimitResponse(usage: ApiKeyUsage) {
  return Response.json(
    {
      decision: "block",
      risk: "medium",
      policy: "plan-limit-action-checks",
      code: "plan_limit_reached",
      feedback: "Action check limit reached for this API key.",
      usage,
    },
    { status: 429, headers: { "cache-control": "no-store" } },
  );
}

export function sandboxRunLimitResponse(usage: ApiKeyUsage) {
  return Response.json(
    {
      ok: false,
      provider: "e2b-byok",
      decision: "block",
      risk: "medium",
      policy: "plan-limit-sandbox-runs",
      code: "plan_limit_reached",
      feedback: "Sandbox run limit reached for this API key.",
      message: "Sandbox run limit reached for this API key.",
      usage,
    },
    { status: 429, headers: { "cache-control": "no-store" } },
  );
}

// ---------------------------------------------------------------------------
// Abuse control
// ---------------------------------------------------------------------------

/**
 * A fixed-window request limiter keyed on caller identity.
 *
 * This is deliberately in-memory and therefore per-isolate: on Workers that
 * means the effective limit is (isolates x limit), not a global cap. It is a
 * blunt instrument that stops a single client hammering one isolate, and it is
 * honest about being that.
 *
 * A globally correct limiter needs shared state — a Durable Object keyed on the
 * caller, or Cloudflare's rate limiting binding. That is the documented next
 * step; this exists so that unauthenticated endpoints are not completely
 * unprotected in the meantime.
 */
type Window = { count: number; resetAt: number };

const windows = new Map<string, Window>();

/** Bound the map so a flood of distinct keys cannot grow it without limit. */
const MAX_TRACKED_KEYS = 10_000;

export type RateLimitResult = {
  allowed: boolean;
  remaining: number;
  resetAt: number;
  retryAfterSeconds: number;
};

export function checkRateLimit(key: string, limit: number, windowMs: number, now = Date.now()): RateLimitResult {
  const existing = windows.get(key);

  if (!existing || existing.resetAt <= now) {
    if (windows.size >= MAX_TRACKED_KEYS) {
      // Drop everything already expired; if that frees nothing, clear the map.
      // Being briefly permissive beats unbounded memory growth in an isolate.
      for (const [k, w] of windows) if (w.resetAt <= now) windows.delete(k);
      if (windows.size >= MAX_TRACKED_KEYS) windows.clear();
    }
    const window: Window = { count: 1, resetAt: now + windowMs };
    windows.set(key, window);
    return { allowed: true, remaining: limit - 1, resetAt: window.resetAt, retryAfterSeconds: 0 };
  }

  existing.count += 1;
  const allowed = existing.count <= limit;

  return {
    allowed,
    remaining: Math.max(0, limit - existing.count),
    resetAt: existing.resetAt,
    retryAfterSeconds: allowed ? 0 : Math.max(1, Math.ceil((existing.resetAt - now) / 1000)),
  };
}

/**
 * The caller's identity for limiting purposes.
 *
 * Prefers the API key over the IP, so one noisy client behind a shared NAT does
 * not throttle everyone alongside it. `CF-Connecting-IP` is set by Cloudflare
 * and cannot be spoofed by the client; `x-forwarded-for` is only consulted as a
 * local-development fallback and is not trusted in production.
 */
export function rateLimitKey(request: Request, scope: string): string {
  const authorization = request.headers.get("authorization");
  if (authorization) return `${scope}:key:${authorization.slice(-24)}`;

  const ip =
    request.headers.get("cf-connecting-ip") ??
    (process.env.NODE_ENV === "production" ? undefined : request.headers.get("x-forwarded-for")?.split(",")[0]?.trim());

  return `${scope}:ip:${ip ?? "unknown"}`;
}

export function rateLimitResponse(result: RateLimitResult) {
  return Response.json(
    {
      error: "Too many requests.",
      code: "rate_limited",
      retryAfterSeconds: result.retryAfterSeconds,
    },
    {
      status: 429,
      headers: {
        "retry-after": String(result.retryAfterSeconds),
        "cache-control": "no-store",
      },
    },
  );
}

/** Reset all windows. Tests only. */
export function __resetRateLimits() {
  windows.clear();
}
