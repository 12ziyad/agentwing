import { getAgentWingD1 } from "@/lib/cloudflareD1";
import { authRequiredResponse, getDashboardAuth } from "@/lib/auth";
import { ForbiddenError, forbiddenResponse, requireCapability } from "@/lib/rbac";
import { createWebhookEndpoint, listWebhookEndpoints } from "@/lib/webhookStore";
import { assertDeliverableUrl, isWebhookEventType, WEBHOOK_EVENT_TYPES, WebhookUrlError } from "@/lib/webhooks";
import type { WebhookEventType } from "@/lib/webhooks";
import { withRoute } from "@/lib/withRoute";

export const runtime = "nodejs";

function unavailable() {
  return Response.json(
    { error: "Webhook storage is unavailable.", code: "database_unavailable" },
    { status: 503, headers: { "retry-after": "5" } },
  );
}

async function handleGET(request: Request) {
  const auth = await getDashboardAuth(request);
  if (!auth) return authRequiredResponse();

  const db = await getAgentWingD1();
  if (!db) return unavailable();

  return Response.json({
    endpoints: await listWebhookEndpoints(db, auth.workspaceId),
    eventTypes: WEBHOOK_EVENT_TYPES,
  });
}

async function handlePOST(request: Request) {
  const auth = await getDashboardAuth(request);
  if (!auth) return authRequiredResponse();

  try {
    requireCapability(auth, "sandbox:write");
  } catch (error) {
    if (error instanceof ForbiddenError) return forbiddenResponse(error);
    throw error;
  }

  const db = await getAgentWingD1();
  if (!db) return unavailable();

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON body.", code: "invalid_json" }, { status: 400 });
  }

  const record = body && typeof body === "object" ? (body as Record<string, unknown>) : {};
  const url = typeof record.url === "string" ? record.url.trim() : "";
  const description = typeof record.description === "string" ? record.description.slice(0, 200) : undefined;

  let eventTypes: WebhookEventType[] | undefined;
  if (Array.isArray(record.eventTypes)) {
    const invalid = record.eventTypes.filter((t) => !isWebhookEventType(t));
    if (invalid.length > 0) {
      return Response.json(
        { error: `Unknown event types: ${invalid.join(", ")}.`, code: "invalid_event_type", eventTypes: WEBHOOK_EVENT_TYPES },
        { status: 400 },
      );
    }
    eventTypes = record.eventTypes as WebhookEventType[];
  }

  try {
    assertDeliverableUrl(url);
  } catch (error) {
    if (error instanceof WebhookUrlError) {
      return Response.json({ error: error.message, code: error.code }, { status: error.status });
    }
    throw error;
  }

  const { endpoint, secret } = await createWebhookEndpoint(db, auth.workspaceId, { url, eventTypes, description });

  return Response.json(
    {
      endpoint,
      // Shown once. Stored as a hash, like an API key, for the same reason.
      secret,
      note: "Save this signing secret now. It is stored hashed and cannot be shown again.",
    },
    { status: 201 },
  );
}

export const GET = withRoute("v1/webhooks", handleGET);

export const POST = withRoute("v1/webhooks", handlePOST);
