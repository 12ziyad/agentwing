import { describe, expect, it } from "vitest";
import { MAX_LOG_LENGTH, redactLog, redactText, redactValue } from "@/lib/redact";

/**
 * Redaction runs before anything is stored or returned.
 *
 * AgentWing persists command output, error text and action metadata, all of
 * which routinely contain credentials — an agent runs `env`, or a stack trace
 * carries an Authorization header. Redacting on the way out would leave the
 * secret sitting in the database waiting for a different code path to expose
 * it, so this happens on the way in.
 */

describe("credential formats are removed from text", () => {
  const cases: ReadonlyArray<readonly [label: string, input: string, secret: string]> = [
    ["bearer token", "Authorization: Bearer eyJhbGciOiJIUzI1NiJ9.abc.def", "eyJhbGciOiJIUzI1NiJ9.abc.def"],
    ["AgentWing key", "using aw_live_1a0b11bda69f9d687e923632166a9f7360cd73d1", "1a0b11bda69f9d687e"],
    ["E2B key", "E2B_API_KEY=e2b_1234567890abcdef", "1234567890abcdef"],
    ["OpenAI key", "OPENAI_API_KEY=sk-proj-abcdefghijklmnop", "abcdefghijklmnop"],
    ["GitHub token", "token ghp_abcdefghijklmnopqrstuvwxyz0123456789", "abcdefghijklmnopqrstuvwxyz"],
    ["Google API key", "key=AIzaSyA1B2C3D4E5F6G7H8I9J0", "SyA1B2C3D4E5F6G7H8I9J0"],
    ["Google client secret", "GOCSPX-abcdefghijklmnop", "abcdefghijklmnop"],
    ["email address", "contact operator@example.com for access", "operator@example.com"],
  ];

  for (const [label, input, secret] of cases) {
    it(`removes a ${label}`, () => {
      const output = redactText(input);
      expect(output).toContain("redacted");
      expect(output).not.toContain(secret);
    });
  }

  it("removes a private key block entirely", () => {
    const pem = "-----BEGIN RSA PRIVATE KEY-----\nMIIEowIBAAKCAQEA\n-----END RSA PRIVATE KEY-----";
    expect(redactText(`key: ${pem}`)).not.toContain("MIIEowIBAAKCAQEA");
  });

  it("leaves ordinary output alone", () => {
    const output = "npm install lodash\nadded 1 package in 812ms";
    expect(redactText(output)).toBe(output);
  });

  it("passes undefined through", () => {
    expect(redactText(undefined)).toBeUndefined();
  });
});

describe("logs are capped", () => {
  it("truncates output that would otherwise be unbounded", () => {
    expect(redactLog("x".repeat(50_000))!.length).toBe(MAX_LOG_LENGTH);
  });
});

describe("structured metadata is redacted recursively", () => {
  it("redacts by key name, whatever the value looks like", () => {
    const out = redactValue({ apiKey: "totally-ordinary-looking", nested: { password: "hunter2" } }) as Record<
      string,
      unknown
    >;
    expect(out.apiKey).toBe("[redacted]");
    expect((out.nested as Record<string, unknown>).password).toBe("[redacted]");
  });

  it("redacts by value shape, whatever the key is called", () => {
    // The case that motivated this: the key is `command`, which is innocuous,
    // but the value carries a credential inline.
    const out = redactValue({ command: "curl -H 'x-api-key: sk-live-abcdefghijk' https://api.example.com" }) as Record<
      string,
      unknown
    >;
    expect(out.command).not.toContain("sk-live-abcdefghijk");
  });

  it("walks arrays", () => {
    const out = redactValue(["e2b_secretkeyvalue", "fine"]) as string[];
    expect(out[0]).not.toContain("secretkeyvalue");
    expect(out[1]).toBe("fine");
  });

  it("stops at a bounded depth rather than recursing forever", () => {
    let deep: Record<string, unknown> = { value: "e2b_leaf" };
    for (let i = 0; i < 30; i += 1) deep = { nested: deep };
    expect(() => redactValue(deep)).not.toThrow();
  });

  it("leaves non-string primitives intact", () => {
    const out = redactValue({ exitCode: 0, ok: true, missing: null }) as Record<string, unknown>;
    expect(out.exitCode).toBe(0);
    expect(out.ok).toBe(true);
    expect(out.missing).toBeNull();
  });
});
