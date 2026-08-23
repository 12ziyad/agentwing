/**
 * Redaction for anything that gets persisted or returned.
 *
 * AgentWing stores command output, action metadata and error text, all of which
 * routinely contain credentials — an agent runs `env`, or a stack trace carries
 * an Authorization header. Redaction happens before storage, not on the way
 * out, so a leak cannot survive in the database waiting for a different code
 * path to expose it.
 *
 * This lives in its own module because both the run lifecycle and the store
 * need it, and importing one from the other would be circular.
 */

const PATTERNS: ReadonlyArray<readonly [RegExp, string]> = [
  [/authorization\s*:\s*bearer\s+[A-Za-z0-9._~+/=-]+/gi, "authorization: bearer [redacted]"],
  [/\b(?:aw_live|aw_test|aw_rat|aw_dev)_[A-Za-z0-9._-]+/g, "aw_[redacted]"],
  [/\be2b_[A-Za-z0-9._-]+/g, "e2b_[redacted]"],
  [/\bsk-[A-Za-z0-9._-]+/g, "sk-[redacted]"],
  [/\bgh[pousr]_[A-Za-z0-9]{16,}/g, "gh_[redacted]"],
  [/\bAIza[0-9A-Za-z._-]{10,}/g, "AIza[redacted]"],
  [/\bGOCSPX-[A-Za-z0-9._-]+/g, "GOCSPX-[redacted]"],
  [/\bproj_[A-Za-z0-9._-]+/g, "proj_[redacted]"],
  [/-----BEGIN [A-Z ]*PRIVATE KEY-----[\s\S]*?-----END [A-Z ]*PRIVATE KEY-----/g, "[private key redacted]"],
  [/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, "[email redacted]"],
];

/** Keys whose value is a secret regardless of what it looks like. */
const SECRET_KEY = /secret|token|password|passwd|authorization|api[_-]?key|private[_-]?key|credential|session/i;

export const MAX_LOG_LENGTH = 8000;

/** Redact known credential shapes from free text. */
export function redactText(value: string): string;
export function redactText(value: undefined): undefined;
export function redactText(value?: string): string | undefined;
export function redactText(value?: string): string | undefined {
  if (!value) return value;
  let out = value;
  for (const [pattern, replacement] of PATTERNS) out = out.replace(pattern, replacement);
  return out;
}

/** Redact and cap a log stream for storage. */
export function redactLog(value?: string): string | undefined {
  const redacted = redactText(value);
  return redacted === undefined ? undefined : redacted.slice(0, MAX_LOG_LENGTH);
}

/**
 * Recursively redact a structure before it is persisted.
 *
 * Two passes, because either alone leaks: key-name matching catches a secret
 * whose value looks ordinary, and value matching catches a secret stored under
 * an innocuous key — `{ "command": "curl -H 'x-api-key: sk-live-...'" }` is the
 * case that motivated this, since the key name there is `command`.
 */
export function redactValue(value: unknown, depth = 0): unknown {
  if (depth > 8) return "[truncated]";

  if (typeof value === "string") return redactText(value);
  if (value === null || typeof value !== "object") return value;

  if (Array.isArray(value)) {
    return value.slice(0, 200).map((entry) => redactValue(entry, depth + 1));
  }

  const out: Record<string, unknown> = {};
  for (const [key, entry] of Object.entries(value as Record<string, unknown>)) {
    out[key] = SECRET_KEY.test(key) ? "[redacted]" : redactValue(entry, depth + 1);
  }
  return out;
}
