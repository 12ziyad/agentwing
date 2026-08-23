import { afterEach, describe, expect, it, vi } from "vitest";
import { DEMO_API_KEY, demoKeyEnabled, validateApiKeyFromRequest } from "@/lib/agentwingStore";

/**
 * The demo key is a publicly-known string. It exists so the local Runtime Lab
 * works without an account, and it authenticates without a real API key row.
 *
 * A deployed instance must never accept it. When it did, anyone who read the
 * repository could authenticate against production.
 */

const requestWithKey = (key: string) =>
  new Request("https://agentwing.example/api/v1/check-action", {
    method: "POST",
    headers: { authorization: `Bearer ${key}` },
  });

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("the demo key", () => {
  it("is refused in production", async () => {
    vi.stubEnv("NODE_ENV", "production");
    expect(demoKeyEnabled()).toBe(false);
    await expect(validateApiKeyFromRequest(requestWithKey(DEMO_API_KEY))).resolves.toBeUndefined();
  });

  it("is available in development", () => {
    vi.stubEnv("NODE_ENV", "development");
    expect(demoKeyEnabled()).toBe(true);
  });

  it("is available in test", () => {
    vi.stubEnv("NODE_ENV", "test");
    expect(demoKeyEnabled()).toBe(true);
  });

  it("resolves to a real, isolated workspace rather than no workspace", async () => {
    vi.stubEnv("NODE_ENV", "development");
    const auth = await validateApiKeyFromRequest(requestWithKey(DEMO_API_KEY));
    // The point of the fix: the demo caller is a tenant like any other. An
    // authenticated caller with no workspace is what made every query global.
    expect(auth?.workspaceId).toBeTruthy();
    expect(typeof auth?.workspaceId).toBe("string");
  });
});

describe("unknown credentials", () => {
  it("are refused when the header is missing", async () => {
    const request = new Request("https://agentwing.example/api/v1/check-action", { method: "POST" });
    await expect(validateApiKeyFromRequest(request)).resolves.toBeUndefined();
  });

  it("are refused when the scheme is not Bearer", async () => {
    const request = new Request("https://agentwing.example/api/v1/check-action", {
      method: "POST",
      headers: { authorization: `Basic ${DEMO_API_KEY}` },
    });
    await expect(validateApiKeyFromRequest(request)).resolves.toBeUndefined();
  });
});
