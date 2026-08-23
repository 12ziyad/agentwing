import { beforeEach, describe, expect, it } from "vitest";
import {
  __resetRateLimits,
  actionCheckLimitExceeded,
  checkRateLimit,
  rateLimitKey,
  sandboxRunLimitExceeded,
} from "@/lib/rateLimit";
import type { ApiKeyUsage } from "@/lib/agentwingTypes";

beforeEach(() => {
  __resetRateLimits();
});

const usage = (used: number, limit: number): ApiKeyUsage =>
  ({
    apiKey: "k",
    actionChecksUsed: used,
    actionCheckLimit: limit,
    sandboxRunsUsed: used,
    sandboxRunLimit: limit,
    receiptsCreated: 0,
    planName: "Beta",
  }) as ApiKeyUsage;

describe("plan quotas", () => {
  it("stops at the limit, not one past it", () => {
    // Previously `used > limit`, so a key with a limit of 1000 got 1001 calls.
    expect(actionCheckLimitExceeded(usage(999, 1000))).toBe(false);
    expect(actionCheckLimitExceeded(usage(1000, 1000))).toBe(true);
    expect(sandboxRunLimitExceeded(usage(20, 20))).toBe(true);
  });
});

describe("the request limiter", () => {
  it("allows up to the limit within a window", () => {
    for (let i = 0; i < 5; i += 1) {
      expect(checkRateLimit("k", 5, 60_000).allowed, `call ${i + 1}`).toBe(true);
    }
    expect(checkRateLimit("k", 5, 60_000).allowed).toBe(false);
  });

  it("reports how long to wait", () => {
    for (let i = 0; i < 3; i += 1) checkRateLimit("k", 3, 60_000);
    const blocked = checkRateLimit("k", 3, 60_000);
    expect(blocked.allowed).toBe(false);
    expect(blocked.retryAfterSeconds).toBeGreaterThan(0);
    expect(blocked.retryAfterSeconds).toBeLessThanOrEqual(60);
  });

  it("starts a fresh window once the old one has passed", () => {
    const now = 1_000_000;
    for (let i = 0; i < 3; i += 1) checkRateLimit("k", 3, 60_000, now);
    expect(checkRateLimit("k", 3, 60_000, now).allowed).toBe(false);
    expect(checkRateLimit("k", 3, 60_000, now + 60_001).allowed).toBe(true);
  });

  it("keeps callers separate", () => {
    for (let i = 0; i < 3; i += 1) checkRateLimit("a", 3, 60_000);
    expect(checkRateLimit("a", 3, 60_000).allowed).toBe(false);
    expect(checkRateLimit("b", 3, 60_000).allowed).toBe(true);
  });
});

describe("the limiter key", () => {
  const req = (headers: Record<string, string>) => new Request("https://x.test/api/v1/check-action", { headers });

  it("prefers the API key, so one client behind a shared address cannot throttle others", () => {
    const key = rateLimitKey(req({ authorization: "Bearer aw_live_abcdefghijklmnopqrstuvwxyz" }), "v1");
    expect(key).toContain("key:");
    expect(key).not.toContain("ip:");
  });

  it("falls back to the Cloudflare-set client address", () => {
    expect(rateLimitKey(req({ "cf-connecting-ip": "203.0.113.7" }), "v1")).toBe("v1:ip:203.0.113.7");
  });

  it("does not include the full credential in the key", () => {
    const secret = "aw_live_thisisaverylongsecretkeyvalue";
    expect(rateLimitKey(req({ authorization: `Bearer ${secret}` }), "v1")).not.toContain(secret);
  });

  it("separates scopes so auth attempts do not consume the API budget", () => {
    const headers = { "cf-connecting-ip": "203.0.113.7" };
    expect(rateLimitKey(req(headers), "auth")).not.toBe(rateLimitKey(req(headers), "v1"));
  });
});
