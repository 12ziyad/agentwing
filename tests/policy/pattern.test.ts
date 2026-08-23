import { describe, expect, it } from "vitest";
import {
  criterionMatches,
  matchesPattern,
  MAX_PATTERN_LENGTH,
  PatternError,
  validatePattern,
} from "@/lib/policyPattern";

describe("pattern matching is anchored", () => {
  it("matches the whole subject, not a substring", () => {
    // The bug this replaces: `prod` matched `reproduce.txt`, so a rule scoped
    // to production silently applied to an unrelated file.
    expect(matchesPattern("prod", "reproduce.txt")).toBe(false);
    expect(matchesPattern("prod", "prod")).toBe(true);
    expect(matchesPattern("src/*.ts", "evil/src/a.ts.bak")).toBe(false);
    expect(matchesPattern("src/*.ts", "src/index.ts")).toBe(true);
  });

  it("supports * for any sequence and ? for exactly one character", () => {
    expect(matchesPattern("*.env", "app.env")).toBe(true);
    expect(matchesPattern("*.env", ".env")).toBe(true);
    expect(matchesPattern("src/*", "src/lib/deep/file.ts")).toBe(true);
    expect(matchesPattern("file?.txt", "file1.txt")).toBe(true);
    expect(matchesPattern("file?.txt", "file12.txt")).toBe(false);
  });

  it("treats a trailing star as matching the empty remainder", () => {
    expect(matchesPattern("deploy*", "deploy")).toBe(true);
    expect(matchesPattern("deploy*", "deployment")).toBe(true);
  });

  it("is case-insensitive", () => {
    expect(matchesPattern("*.ENV", "app.env")).toBe(true);
    expect(matchesPattern("Prod/*", "prod/db")).toBe(true);
  });

  it("matches a bare star against anything", () => {
    expect(matchesPattern("*", "")).toBe(true);
    expect(matchesPattern("*", "anything at all")).toBe(true);
  });
});

describe("pattern matching cannot be made to hang", () => {
  it("returns promptly on the input that used to run for minutes", () => {
    // `*a*a*a*a*a*a*a*a*b` against a 60-character subject previously exceeded a
    // two-minute timeout in the regex implementation and had to be killed.
    // Anyone who could save a policy could hang the worker with it.
    const pattern = "*a*a*a*a*a*a*a*a*b";
    const subject = "a".repeat(60);

    const started = performance.now();
    const result = matchesPattern(pattern, subject);
    const elapsed = performance.now() - started;

    expect(result).toBe(false);
    expect(elapsed).toBeLessThan(50);
  });

  it("stays fast on a long subject with many stars", () => {
    const started = performance.now();
    matchesPattern("*x*y*z*", "q".repeat(4000));
    expect(performance.now() - started).toBeLessThan(50);
  });

  it("truncates rather than scanning an unbounded subject", () => {
    const started = performance.now();
    matchesPattern("*needle*", "h".repeat(200_000));
    expect(performance.now() - started).toBeLessThan(50);
  });
});

describe("patterns are validated when written, not when matched", () => {
  it("accepts an ordinary pattern", () => {
    expect(() => validatePattern("src/**")).toThrow(PatternError);
    expect(() => validatePattern("src/*.ts")).not.toThrow();
    expect(() => validatePattern("deploy")).not.toThrow();
  });

  it("rejects an empty pattern", () => {
    expect(() => validatePattern("")).toThrow(/non-empty/);
  });

  it("rejects a pattern that is too long", () => {
    expect(() => validatePattern("a".repeat(MAX_PATTERN_LENGTH + 1))).toThrow(/maximum/);
  });

  it("rejects a pattern with too many wildcards", () => {
    expect(() => validatePattern("*a*a*a*a*a*a*a*b")).toThrow(/wildcards/);
  });

  it("names the field in the error so the operator knows which one to fix", () => {
    expect(() => validatePattern("", "targetPattern")).toThrow(/targetPattern/);
  });
});

describe("a declared criterion that cannot be evaluated is not satisfied", () => {
  it("fails when the action omits the field the policy constrains", () => {
    // The bug this replaces: omitting `target` SKIPPED the target constraint,
    // so a policy scoped to `safe/*` matched an action with no target at all.
    expect(criterionMatches("safe/*", undefined)).toBe(false);
    expect(criterionMatches("safe/*", "")).toBe(false);
  });

  it("passes when there is no criterion to satisfy", () => {
    expect(criterionMatches(undefined, "anything")).toBe(true);
    expect(criterionMatches(undefined, undefined)).toBe(true);
  });

  it("evaluates normally when both are present", () => {
    expect(criterionMatches("safe/*", "safe/file.txt")).toBe(true);
    expect(criterionMatches("safe/*", "danger/file.txt")).toBe(false);
  });
});
