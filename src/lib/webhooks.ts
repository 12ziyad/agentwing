import { redactValue } from "./redact";

/**
 * Outbound webhooks.
 *
 * The reason these exist: an approval gate needs a way to reach a human that is
 * not "the agent tells them". Everything else — run completed, policy blocked
 * something — falls out of the same machinery.
 *
 * Deliveries are signed, retried with backoff, and dead-lettered rather than
 * retried forever, and the destination URL is validated because it is
 * attacker-influenced input pointed at by our own fetch.
 */

export const WEBHOOK_EVENT_TYPES = [
  "approval.requested",
  "approval.resolved",
  "run.completed",
  "run.failed",
  "action.blocked",
] as const;

export type WebhookEventType = (typeof WEBHOOK_EVENT_TYPES)[number];

export function isWebhookEventType(value: unknown): value is WebhookEventType {
  return typeof value === "string" && (WEBHOOK_EVENT_TYPES as readonly string[]).includes(value);
}

export type WebhookEvent = {
  id: string;
  type: WebhookEventType;
  workspaceId: string;
  createdAt: string;
  data: Record<string, unknown>;
};

// ---------------------------------------------------------------------------
// Destination safety
// ---------------------------------------------------------------------------

/**
 * Hostnames that must never be fetched.
 *
 * `global_fetch_strictly_public` in wrangler.jsonc is often mistaken for SSRF
 * protection. It routes requests as if from the public internet so a same-zone
 * request cannot bypass Cloudflare's own security settings — it does not
 * validate hostnames, does not follow-and-recheck redirects, and is not an
 * allowlist. This is the actual control.
 */
const BLOCKED_HOSTNAMES = new Set([
  "localhost",
  "localhost.localdomain",
  "metadata.google.internal",
  "metadata.goog",
]);

const BLOCKED_SUFFIXES = [".localhost", ".local", ".internal", ".localdomain"];

/** Ranges that are private, loopback, link-local or otherwise not the public internet. */
function isPrivateIPv4(host: string): boolean {
  const parts = host.split(".");
  if (parts.length !== 4) return false;

  const octets = parts.map((p) => Number(p));
  if (octets.some((n) => !Number.isInteger(n) || n < 0 || n > 255)) return false;

  const [a, b] = octets as [number, number, number, number];
  if (a === 10) return true; // 10/8
  if (a === 127) return true; // loopback
  if (a === 0) return true; // "this network"
  if (a === 169 && b === 254) return true; // link-local, incl. cloud metadata
  if (a === 172 && b >= 16 && b <= 31) return true; // 172.16/12
  if (a === 192 && b === 168) return true; // 192.168/16
  if (a === 100 && b >= 64 && b <= 127) return true; // carrier-grade NAT
  if (a >= 224) return true; // multicast and reserved
  return false;
}

function isPrivateIPv6(host: string): boolean {
  const h = host.replace(/^\[|\]$/g, "").toLowerCase();
  if (h === "::1" || h === "::") return true;
  if (h.startsWith("fc") || h.startsWith("fd")) return true; // unique-local
  if (h.startsWith("fe80")) return true; // link-local

  // IPv4-mapped addresses reach exactly the same hosts as their IPv4 form —
  // `::ffff:169.254.169.254` is the cloud metadata service.
  //
  // `new URL()` normalises the dotted form to hex (`::ffff:a9fe:a9fe`), so
  // checking only the dotted spelling misses every one that arrives through a
  // parsed URL, which is all of them.
  const dotted = /^::ffff:(\d+\.\d+\.\d+\.\d+)$/.exec(h);
  if (dotted) return isPrivateIPv4(dotted[1]!);

  const hex = /^::ffff:([0-9a-f]{1,4}):([0-9a-f]{1,4})$/.exec(h);
  if (hex) {
    const high = Number.parseInt(hex[1]!, 16);
    const low = Number.parseInt(hex[2]!, 16);
    const ipv4 = [(high >> 8) & 0xff, high & 0xff, (low >> 8) & 0xff, low & 0xff].join(".");
    return isPrivateIPv4(ipv4);
  }

  return false;
}

export class WebhookUrlError extends Error {
  readonly code = "invalid_webhook_url";
  readonly status = 400;

  constructor(message: string) {
    super(message);
    this.name = "WebhookUrlError";
  }
}

/**
 * Validate a customer-supplied delivery URL.
 *
 * Rejects anything that is not public HTTPS. The interesting cases are
 * `169.254.169.254` (cloud metadata) and loopback — a webhook pointed at either
 * turns our outbound fetch into a probe of our own infrastructure.
 */
export function assertDeliverableUrl(raw: string): URL {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new WebhookUrlError("That is not a valid URL.");
  }

  if (url.protocol !== "https:") {
    throw new WebhookUrlError("Webhook URLs must use https. Payloads carry decision data and must not travel in the clear.");
  }

  const host = url.hostname.toLowerCase();

  if (BLOCKED_HOSTNAMES.has(host) || BLOCKED_SUFFIXES.some((suffix) => host.endsWith(suffix))) {
    throw new WebhookUrlError(`Deliveries cannot be sent to ${host}. Use a publicly reachable address.`);
  }

  if (isPrivateIPv4(host) || isPrivateIPv6(host)) {
    throw new WebhookUrlError(`${host} is a private or link-local address, which AgentWing will not fetch.`);
  }

  if (!host.includes(".") && !host.includes(":")) {
    throw new WebhookUrlError("Use a fully-qualified public hostname.");
  }

  return url;
}

// ---------------------------------------------------------------------------
// Signing
// ---------------------------------------------------------------------------

export const SIGNATURE_HEADER = "x-agentwing-signature";
export const TIMESTAMP_HEADER = "x-agentwing-timestamp";
export const EVENT_ID_HEADER = "x-agentwing-event-id";
export const EVENT_TYPE_HEADER = "x-agentwing-event-type";

/** Reject anything older than this, so a captured delivery cannot be replayed later. */
export const SIGNATURE_TOLERANCE_SECONDS = 300;

function toHex(buffer: ArrayBuffer): string {
  return Array.from(new Uint8Array(buffer), (b) => b.toString(16).padStart(2, "0")).join("");
}

/**
 * Sign a delivery.
 *
 * The timestamp is inside the signed material, not merely alongside it —
 * otherwise an attacker who captures a delivery can replay it indefinitely by
 * changing only the header.
 */
export async function signPayload(secret: string, timestamp: string, body: string): Promise<string> {
  const key = await globalThis.crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret) as unknown as ArrayBuffer,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await globalThis.crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(`${timestamp}.${body}`) as unknown as ArrayBuffer,
  );
  return `v1=${toHex(signature)}`;
}

/**
 * Verify a delivery. Exported for consumers to copy, and used by our own tests.
 *
 * Comparison is constant-time: a fast `===` on a hex signature leaks how much
 * of a guess was correct, which is enough to forge one byte at a time.
 */
export async function verifySignature(options: {
  secret: string;
  signature: string;
  timestamp: string;
  body: string;
  toleranceSeconds?: number;
  now?: number;
}): Promise<boolean> {
  const tolerance = options.toleranceSeconds ?? SIGNATURE_TOLERANCE_SECONDS;
  const now = options.now ?? Date.now();

  const sentAt = Number(options.timestamp);
  if (!Number.isFinite(sentAt)) return false;
  if (Math.abs(now / 1000 - sentAt) > tolerance) return false;

  const expected = await signPayload(options.secret, options.timestamp, options.body);
  return timingSafeEqual(expected, options.signature);
}

export function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

// ---------------------------------------------------------------------------
// Retry schedule
// ---------------------------------------------------------------------------

/** Roughly 30s, 2m, 10m, 1h, 6h — then dead-lettered. */
export const RETRY_DELAYS_MS = [30_000, 120_000, 600_000, 3_600_000, 21_600_000] as const;
export const MAX_DELIVERY_ATTEMPTS = RETRY_DELAYS_MS.length + 1;

export function nextAttemptAt(attempts: number, now = Date.now()): string | undefined {
  const delay = RETRY_DELAYS_MS[attempts - 1];
  if (delay === undefined) return undefined; // Out of retries: dead-letter it.
  // Jitter so a fleet of endpoints that failed together does not retry together.
  return new Date(now + delay + Math.random() * Math.min(delay * 0.2, 30_000)).toISOString();
}

/** A 4xx that is not 408 or 429 will not become valid by repeating it. */
export function isRetryableStatus(status: number): boolean {
  if (status === 408 || status === 429) return true;
  return status >= 500;
}

/** Build the body actually sent, with credential-shaped values removed. */
export function deliveryBody(event: WebhookEvent): string {
  return JSON.stringify({
    id: event.id,
    type: event.type,
    workspaceId: event.workspaceId,
    createdAt: event.createdAt,
    data: redactValue(event.data),
  });
}
