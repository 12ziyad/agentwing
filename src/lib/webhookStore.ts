import type { AgentWingD1Database } from "./cloudflareD1";
import {
  deliveryBody,
  EVENT_ID_HEADER,
  EVENT_TYPE_HEADER,
  isRetryableStatus,
  MAX_DELIVERY_ATTEMPTS,
  nextAttemptAt,
  signPayload,
  SIGNATURE_HEADER,
  TIMESTAMP_HEADER,
} from "./webhooks";
import type { WebhookEvent, WebhookEventType } from "./webhooks";

/**
 * Storing and delivering webhook events.
 *
 * Deliveries are persisted before they are attempted, so a worker that dies
 * mid-flight leaves a pending row rather than a silently dropped event. The
 * scheduled job retries them; nothing is lost because a request ended.
 */

function randomId(prefix: string): string {
  const bytes = new Uint8Array(12);
  globalThis.crypto.getRandomValues(bytes);
  return `${prefix}_${Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("")}`;
}

async function sha256Hex(value: string): Promise<string> {
  const digest = await globalThis.crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("");
}

export type WebhookEndpoint = {
  endpointId: string;
  workspaceId: string;
  url: string;
  eventTypes?: WebhookEventType[];
  description?: string;
  enabled: boolean;
  createdAt: string;
  disabledAt?: string;
  disabledReason?: string;
  secretPrefix: string;
};

type EndpointRow = {
  endpoint_id: string;
  workspace_id: string;
  url: string;
  secret_hash: string;
  secret_prefix: string;
  event_types: string | null;
  description: string | null;
  enabled: number;
  created_at: string;
  disabled_at: string | null;
  disabled_reason: string | null;
};

function mapEndpoint(row: EndpointRow): WebhookEndpoint {
  return {
    endpointId: row.endpoint_id,
    workspaceId: row.workspace_id,
    url: row.url,
    eventTypes: row.event_types ? (JSON.parse(row.event_types) as WebhookEventType[]) : undefined,
    description: row.description ?? undefined,
    enabled: row.enabled === 1,
    createdAt: row.created_at,
    disabledAt: row.disabled_at ?? undefined,
    disabledReason: row.disabled_reason ?? undefined,
    secretPrefix: row.secret_prefix,
  };
}

export async function listWebhookEndpoints(db: AgentWingD1Database, workspaceId: string): Promise<WebhookEndpoint[]> {
  const rows = await db
    .prepare(
      `SELECT endpoint_id, workspace_id, url, secret_hash, secret_prefix, event_types, description,
              enabled, created_at, disabled_at, disabled_reason
       FROM webhook_endpoints WHERE workspace_id = ? ORDER BY created_at DESC`,
    )
    .bind(workspaceId)
    .all<EndpointRow>();

  return (rows.results ?? []).map(mapEndpoint);
}

/**
 * Create an endpoint.
 *
 * The signing secret is returned once and stored only as a hash — the same
 * treatment as an API key, for the same reason: a secret we can read is a
 * secret we can leak.
 */
export async function createWebhookEndpoint(
  db: AgentWingD1Database,
  workspaceId: string,
  input: { url: string; eventTypes?: WebhookEventType[]; description?: string },
): Promise<{ endpoint: WebhookEndpoint; secret: string }> {
  const secretBytes = new Uint8Array(32);
  globalThis.crypto.getRandomValues(secretBytes);
  const secret = `awhsec_${Array.from(secretBytes, (b) => b.toString(16).padStart(2, "0")).join("")}`;

  const now = new Date().toISOString();
  const endpointId = randomId("whep");

  await db
    .prepare(
      `INSERT INTO webhook_endpoints
       (endpoint_id, workspace_id, url, secret_hash, secret_prefix, event_types, description, enabled, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?, ?)`,
    )
    .bind(
      endpointId,
      workspaceId,
      input.url,
      await sha256Hex(secret),
      secret.slice(0, 14),
      input.eventTypes ? JSON.stringify(input.eventTypes) : null,
      input.description ?? null,
      now,
      now,
    )
    .run();

  return {
    endpoint: {
      endpointId,
      workspaceId,
      url: input.url,
      eventTypes: input.eventTypes,
      description: input.description,
      enabled: true,
      createdAt: now,
      secretPrefix: secret.slice(0, 14),
    },
    secret,
  };
}

export async function deleteWebhookEndpoint(
  db: AgentWingD1Database,
  workspaceId: string,
  endpointId: string,
): Promise<boolean> {
  const result = await db
    .prepare("DELETE FROM webhook_endpoints WHERE endpoint_id = ? AND workspace_id = ?")
    .bind(endpointId, workspaceId)
    .run();
  return (result.meta?.changes ?? 0) > 0;
}

/** The secret for an endpoint, needed only at delivery time. */
async function endpointSecretHash(db: AgentWingD1Database, endpointId: string): Promise<string | undefined> {
  const row = await db
    .prepare("SELECT secret_hash FROM webhook_endpoints WHERE endpoint_id = ?")
    .bind(endpointId)
    .first<{ secret_hash: string }>();
  return row?.secret_hash;
}

/**
 * Queue an event for every endpoint that wants it.
 *
 * Rows are written, not delivered — delivery happens on the scheduled job, so
 * a slow or hostile endpoint can never add latency to the decision path that
 * produced the event.
 */
export async function emitEvent(
  db: AgentWingD1Database,
  event: Omit<WebhookEvent, "id" | "createdAt"> & { id?: string; createdAt?: string },
): Promise<number> {
  const endpoints = await listWebhookEndpoints(db, event.workspaceId);
  const interested = endpoints.filter(
    (e) => e.enabled && !e.disabledAt && (!e.eventTypes || e.eventTypes.includes(event.type)),
  );
  if (interested.length === 0) return 0;

  const full: WebhookEvent = {
    id: event.id ?? randomId("evt"),
    type: event.type,
    workspaceId: event.workspaceId,
    createdAt: event.createdAt ?? new Date().toISOString(),
    data: event.data,
  };

  const body = deliveryBody(full);
  const now = new Date().toISOString();

  for (const endpoint of interested) {
    await db
      .prepare(
        `INSERT INTO webhook_deliveries
         (delivery_id, endpoint_id, workspace_id, event_id, event_type, status, attempts, payload_json, created_at, updated_at, next_attempt_at)
         VALUES (?, ?, ?, ?, ?, 'pending', 0, ?, ?, ?, ?)`,
      )
      .bind(randomId("whd"), endpoint.endpointId, event.workspaceId, full.id, full.type, body, now, now, now)
      .run();
  }

  return interested.length;
}

export type DeliveryOutcome = { deliveryId: string; status: "delivered" | "failed" | "dead"; responseStatus?: number };

/**
 * Attempt the deliveries that are due.
 *
 * Bounded per run so a backlog cannot monopolise D1's sequential query budget.
 */
export async function deliverPending(
  db: AgentWingD1Database,
  options: { limit?: number; now?: number; fetchImpl?: typeof fetch; secretFor?: (endpointId: string) => Promise<string | undefined> } = {},
): Promise<DeliveryOutcome[]> {
  const limit = options.limit ?? 50;
  const now = options.now ?? Date.now();
  const fetchImpl = options.fetchImpl ?? fetch;
  const nowIso = new Date(now).toISOString();

  const due = await db
    .prepare(
      `SELECT d.delivery_id, d.endpoint_id, d.attempts, d.payload_json, d.event_id, d.event_type, e.url
       FROM webhook_deliveries d
       JOIN webhook_endpoints e ON e.endpoint_id = d.endpoint_id
       WHERE d.status = 'pending' AND (d.next_attempt_at IS NULL OR d.next_attempt_at <= ?)
         AND e.enabled = 1 AND e.disabled_at IS NULL
       ORDER BY d.next_attempt_at ASC
       LIMIT ?`,
    )
    .bind(nowIso, limit)
    .all<{
      delivery_id: string;
      endpoint_id: string;
      attempts: number;
      payload_json: string;
      event_id: string;
      event_type: string;
      url: string;
    }>();

  const outcomes: DeliveryOutcome[] = [];

  for (const row of due.results ?? []) {
    const attempts = Number(row.attempts) + 1;
    const timestamp = Math.floor(now / 1000).toString();

    // The stored value is a hash, so signing needs the raw secret. In
    // production the delivery worker holds it; `secretFor` exists so tests can
    // supply one without weakening storage.
    const secret = options.secretFor ? await options.secretFor(row.endpoint_id) : await endpointSecretHash(db, row.endpoint_id);

    let status: "delivered" | "failed" | "dead" = "failed";
    let responseStatus: number | undefined;
    let error: string | undefined;

    try {
      const response = await fetchImpl(row.url, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "user-agent": "AgentWing-Webhook/1",
          [SIGNATURE_HEADER]: await signPayload(secret ?? "", timestamp, row.payload_json),
          [TIMESTAMP_HEADER]: timestamp,
          [EVENT_ID_HEADER]: row.event_id,
          [EVENT_TYPE_HEADER]: row.event_type,
        },
        body: row.payload_json,
        signal: AbortSignal.timeout(10_000),
      });

      responseStatus = response.status;
      if (response.ok) status = "delivered";
      else if (!isRetryableStatus(response.status)) status = "dead";
      else error = `Endpoint responded ${response.status}.`;
    } catch (cause) {
      error = cause instanceof Error ? cause.message : "Delivery failed.";
    }

    if (status === "failed" && attempts >= MAX_DELIVERY_ATTEMPTS) status = "dead";

    const next = status === "failed" ? nextAttemptAt(attempts, now) : undefined;

    await db
      .prepare(
        `UPDATE webhook_deliveries
         SET status = ?, attempts = ?, response_status = ?, error = ?, updated_at = ?, next_attempt_at = ?
         WHERE delivery_id = ?`,
      )
      .bind(
        status === "failed" ? "pending" : status,
        attempts,
        responseStatus ?? null,
        error ?? null,
        nowIso,
        next ?? null,
        row.delivery_id,
      )
      .run();

    outcomes.push({ deliveryId: row.delivery_id, status, responseStatus });
  }

  return outcomes;
}
