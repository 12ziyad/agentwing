import { describe, expect, it } from "vitest";
import {
  assertDeliverableUrl,
  deliveryBody,
  isRetryableStatus,
  MAX_DELIVERY_ATTEMPTS,
  nextAttemptAt,
  signPayload,
  SIGNATURE_TOLERANCE_SECONDS,
  timingSafeEqual,
  verifySignature,
  WebhookUrlError,
} from "@/lib/webhooks";

/**
 * Webhooks are the reason an approval gate can reach a human at all. They are
 * also an outbound fetch to an address a customer chose, which makes the
 * destination attacker-influenced input pointed at our own network.
 */

describe("delivery URLs", () => {
  it("accepts an ordinary public https endpoint", () => {
    expect(() => assertDeliverableUrl("https://hooks.example.com/agentwing")).not.toThrow();
  });

  it("refuses plaintext http", () => {
    // Payloads carry decisions and action metadata.
    expect(() => assertDeliverableUrl("http://hooks.example.com/x")).toThrow(/https/);
  });

  it("refuses the cloud metadata address", () => {
    // 169.254.169.254 is the single most valuable SSRF target on any cloud.
    expect(() => assertDeliverableUrl("https://169.254.169.254/latest/meta-data/")).toThrow(WebhookUrlError);
    expect(() => assertDeliverableUrl("https://metadata.google.internal/x")).toThrow(WebhookUrlError);
  });

  it("refuses loopback and private ranges", () => {
    for (const url of [
      "https://127.0.0.1/x",
      "https://localhost/x",
      "https://10.0.0.5/x",
      "https://192.168.1.10/x",
      "https://172.16.0.1/x",
      "https://[::1]/x",
      "https://[fd00::1]/x",
    ]) {
      expect(() => assertDeliverableUrl(url), url).toThrow(WebhookUrlError);
    }
  });

  it("refuses an IPv4-mapped IPv6 route to metadata or loopback", () => {
    // ::ffff:169.254.169.254 reaches exactly the same place as the dotted form.
    // URL normalises it to hex (::ffff:a9fe:a9fe), so a check that only knows
    // the dotted spelling misses every one that arrives through a parsed URL.
    expect(() => assertDeliverableUrl("https://[::ffff:169.254.169.254]/x")).toThrow(WebhookUrlError);
    expect(() => assertDeliverableUrl("https://[::ffff:127.0.0.1]/x")).toThrow(WebhookUrlError);
    expect(() => assertDeliverableUrl("https://[::ffff:10.0.0.1]/x")).toThrow(WebhookUrlError);
  });

  it("refuses internal-looking suffixes", () => {
    for (const url of ["https://api.internal/x", "https://box.local/x", "https://svc.localhost/x"]) {
      expect(() => assertDeliverableUrl(url), url).toThrow(WebhookUrlError);
    }
  });

  it("refuses a bare hostname with no domain", () => {
    expect(() => assertDeliverableUrl("https://intranet/x")).toThrow(WebhookUrlError);
  });

  it("refuses something that is not a URL at all", () => {
    expect(() => assertDeliverableUrl("not a url")).toThrow(WebhookUrlError);
  });
});

describe("signatures", () => {
  const secret = "awhsec_testsecret";
  const body = JSON.stringify({ id: "evt_1", type: "approval.requested" });

  it("verifies a signature it produced", async () => {
    const timestamp = Math.floor(Date.now() / 1000).toString();
    const signature = await signPayload(secret, timestamp, body);
    await expect(verifySignature({ secret, signature, timestamp, body })).resolves.toBe(true);
  });

  it("rejects a different secret", async () => {
    const timestamp = Math.floor(Date.now() / 1000).toString();
    const signature = await signPayload(secret, timestamp, body);
    await expect(verifySignature({ secret: "awhsec_other", signature, timestamp, body })).resolves.toBe(false);
  });

  it("rejects an altered body", async () => {
    const timestamp = Math.floor(Date.now() / 1000).toString();
    const signature = await signPayload(secret, timestamp, body);
    await expect(verifySignature({ secret, signature, timestamp, body: `${body} ` })).resolves.toBe(false);
  });

  it("rejects a replay of an old delivery", async () => {
    // The timestamp is inside the signed material, so an attacker who captured
    // a delivery cannot make it fresh again by editing the header.
    const old = Math.floor(Date.now() / 1000 - SIGNATURE_TOLERANCE_SECONDS - 60).toString();
    const signature = await signPayload(secret, old, body);
    await expect(verifySignature({ secret, signature, timestamp: old, body })).resolves.toBe(false);
  });

  it("rejects a timestamp that is not a number", async () => {
    const signature = await signPayload(secret, "abc", body);
    await expect(verifySignature({ secret, signature, timestamp: "abc", body })).resolves.toBe(false);
  });

  it("compares in constant time", () => {
    // A fast `===` on hex leaks how much of a guess was right, which is enough
    // to forge a signature one byte at a time.
    expect(timingSafeEqual("abc", "abc")).toBe(true);
    expect(timingSafeEqual("abc", "abd")).toBe(false);
    expect(timingSafeEqual("abc", "abcd")).toBe(false);
  });
});

describe("retry policy", () => {
  it("retries transient failures and gives up on permanent ones", () => {
    expect(isRetryableStatus(500)).toBe(true);
    expect(isRetryableStatus(503)).toBe(true);
    expect(isRetryableStatus(429)).toBe(true);
    expect(isRetryableStatus(408)).toBe(true);
    // A 400 or 404 will not become valid by sending it again.
    expect(isRetryableStatus(400)).toBe(false);
    expect(isRetryableStatus(404)).toBe(false);
    expect(isRetryableStatus(410)).toBe(false);
  });

  it("backs off further each time", () => {
    const now = 1_000_000;
    const delays = [1, 2, 3, 4, 5].map((attempt) => Date.parse(nextAttemptAt(attempt, now)!) - now);
    for (let i = 1; i < delays.length; i += 1) {
      expect(delays[i]!).toBeGreaterThan(delays[i - 1]!);
    }
  });

  it("stops rather than retrying forever", () => {
    expect(nextAttemptAt(MAX_DELIVERY_ATTEMPTS, Date.now())).toBeUndefined();
  });
});

describe("delivery payloads", () => {
  it("redacts credentials before they leave", async () => {
    const body = deliveryBody({
      id: "evt_1",
      type: "action.blocked",
      workspaceId: "ws_1",
      createdAt: "2026-08-23T00:00:00.000Z",
      data: { action: "curl -H 'x-api-key: sk-live-abcdefghijk' https://x", apiKey: "aw_live_secret" },
    });

    expect(body).not.toContain("sk-live-abcdefghijk");
    expect(body).not.toContain("aw_live_secret");
  });

  it("carries the fields a consumer needs to route on", () => {
    const parsed = JSON.parse(
      deliveryBody({
        id: "evt_1",
        type: "approval.requested",
        workspaceId: "ws_1",
        createdAt: "2026-08-23T00:00:00.000Z",
        data: { runId: "run_1" },
      }),
    );

    expect(parsed).toMatchObject({ id: "evt_1", type: "approval.requested", workspaceId: "ws_1" });
    expect(parsed.data.runId).toBe("run_1");
  });
});
