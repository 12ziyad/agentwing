/**
 * Glob matching for custom policy patterns.
 *
 * Policy patterns are written by customers and evaluated on the request path,
 * which makes them hostile input to our own hot loop. The previous
 * implementation compiled them straight to a regex with `*` → `.*` and no
 * anchors, which had two consequences:
 *
 *   - Unanchored: the pattern `prod` matched `reproduce.txt`, and `src/*.ts`
 *     matched `evil/src/a.ts.bak`. A policy meant to scope a rule to one place
 *     silently applied somewhere else.
 *   - Catastrophically backtrackable: `*a*a*a*a*a*a*a*a*b` against a 60
 *     character subject did not finish inside two minutes. Anyone who could
 *     save a policy could hang the worker.
 *
 * This module matches with a linear two-pointer scan instead of a regex, so
 * there is no backtracking to exploit, and it is anchored by construction: the
 * pattern must consume the entire subject.
 */

/** A pattern longer than this is a mistake, not a rule. */
export const MAX_PATTERN_LENGTH = 200;

/** Enough for `prefix/*​/name.*`; beyond this a pattern is unreadable anyway. */
export const MAX_WILDCARDS = 5;

/** Subjects are truncated rather than rejected — a long command is still a command. */
export const MAX_SUBJECT_LENGTH = 4000;

export class PatternError extends Error {
  readonly code: string;

  constructor(message: string, code: string) {
    super(message);
    this.name = "PatternError";
    this.code = code;
  }
}

/**
 * Check a pattern is safe to store and evaluate.
 *
 * Called when a policy is written, not when it is matched, so a bad pattern is
 * rejected at the point someone can still fix it.
 */
export function validatePattern(pattern: string, field = "pattern"): void {
  if (typeof pattern !== "string" || pattern.length === 0) {
    throw new PatternError(`${field} must be a non-empty string.`, "pattern_empty");
  }

  if (pattern.length > MAX_PATTERN_LENGTH) {
    throw new PatternError(
      `${field} is ${pattern.length} characters; the maximum is ${MAX_PATTERN_LENGTH}.`,
      "pattern_too_long",
    );
  }

  const wildcards = (pattern.match(/[*?]/g) ?? []).length;
  if (wildcards > MAX_WILDCARDS) {
    throw new PatternError(
      `${field} contains ${wildcards} wildcards; the maximum is ${MAX_WILDCARDS}. Write a more specific pattern.`,
      "pattern_too_many_wildcards",
    );
  }

  // `**` adds nothing over `*` here and is usually a mistaken import of shell
  // globstar semantics. Rejecting it keeps the language small and honest.
  if (pattern.includes("**")) {
    throw new PatternError(
      `${field} contains "**", which is not supported. Use a single "*" to match any sequence.`,
      "pattern_globstar",
    );
  }
}

/**
 * Whether `subject` matches `pattern`, anchored at both ends.
 *
 * `*` matches any sequence including empty. `?` matches exactly one character.
 * Matching is case-insensitive, because policies are written by humans about
 * paths and commands where case is rarely the distinguishing feature.
 *
 * Linear scan with a single backtrack point, so worst case is O(pattern ×
 * subject) with no exponential blowup.
 */
export function matchesPattern(pattern: string, subject: string): boolean {
  const p = pattern.toLowerCase();
  const s = subject.slice(0, MAX_SUBJECT_LENGTH).toLowerCase();

  let sIndex = 0;
  let pIndex = 0;
  let starIndex = -1;
  let sBacktrack = 0;

  while (sIndex < s.length) {
    const pChar = pIndex < p.length ? p[pIndex] : undefined;

    if (pChar === "?" || (pChar !== undefined && pChar !== "*" && pChar === s[sIndex])) {
      sIndex += 1;
      pIndex += 1;
    } else if (pChar === "*") {
      // Remember where the star was, and try matching it against nothing first.
      starIndex = pIndex;
      sBacktrack = sIndex;
      pIndex += 1;
    } else if (starIndex !== -1) {
      // Give the last star one more character and resume from just after it.
      pIndex = starIndex + 1;
      sBacktrack += 1;
      sIndex = sBacktrack;
    } else {
      return false;
    }
  }

  // Trailing stars may match the empty remainder.
  while (pIndex < p.length && p[pIndex] === "*") pIndex += 1;

  return pIndex === p.length;
}

/**
 * Match a pattern against a field that may be absent.
 *
 * This is the vacuous-satisfaction fix. `policyMatches` used to guard each
 * criterion with `if (policy.targetPattern && action.target)`, so an action
 * that simply omitted `target` *skipped* the constraint rather than failing it.
 * A policy scoped to `targetPattern: "safe/*"` therefore matched a shell
 * command with no target at all, and a policy with no criteria matched
 * everything — which let any authenticated caller write an `allow` rule that
 * neutralised every non-mandatory default.
 *
 * A declared criterion that cannot be evaluated is not satisfied.
 */
export function criterionMatches(pattern: string | undefined, value: string | undefined): boolean {
  if (!pattern) return true; // No criterion declared: nothing to satisfy.
  if (value === undefined || value === null || value === "") return false;
  return matchesPattern(pattern, value);
}
