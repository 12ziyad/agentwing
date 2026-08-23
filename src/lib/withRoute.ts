import { DatabaseUnavailableError, PolicyStoreUnavailableError } from "@/lib/agentwingStore";
import { ForbiddenError, SelfApprovalError } from "@/lib/rbac";
import { IdempotencyConflictError } from "@/lib/idempotency";
import { PolicyInputError } from "@/lib/policyInput";
import { RunTransitionError } from "@/lib/actionRunLifecycle";
import { WebhookUrlError } from "@/lib/webhooks";
import { OidcError } from "@/lib/oidc";

/**
 * One error envelope for every route.
 *
 * Before this, an unhandled error became an opaque framework 500 with no code
 * and no correlation id — so during a D1 incident every request looked like a
 * bug in the caller's request rather than an outage, and there was nothing to
 * quote when asking about it.
 *
 * Two rules the mapping follows. A 5xx never carries the underlying message,
 * because D1 errors contain SQL and column names. And "storage is unreachable"
 * answers 503 with Retry-After rather than 500, because it is a transient
 * condition a client should retry rather than a request it should fix.
 */

export type ErrorEnvelope = {
  error: string;
  code: string;
  requestId: string;
  retryAfterSeconds?: number;
};

/** Errors that already know their own status and code. */
type TypedError = { status: number; code: string; message: string };

function asTypedError(error: unknown): TypedError | undefined {
  if (
    error instanceof DatabaseUnavailableError ||
    error instanceof PolicyStoreUnavailableError ||
    error instanceof ForbiddenError ||
    error instanceof SelfApprovalError ||
    error instanceof IdempotencyConflictError ||
    error instanceof PolicyInputError ||
    error instanceof RunTransitionError ||
    error instanceof WebhookUrlError
  ) {
    return { status: error.status, code: error.code, message: error.message };
  }

  if (error instanceof OidcError) {
    return { status: 401, code: error.code, message: error.message };
  }

  return undefined;
}

export function newRequestId(): string {
  return `req_${globalThis.crypto.randomUUID().replace(/-/g, "").slice(0, 24)}`;
}

/**
 * Wrap a route handler.
 *
 * Assigns a request id, returns it on every response so a user can quote it,
 * and turns known errors into their documented status and code.
 */
export function withRoute<Args extends unknown[]>(
  name: string,
  handler: (request: Request, ...args: Args) => Promise<Response>,
) {
  return async (request: Request, ...args: Args): Promise<Response> => {
    const requestId = newRequestId();
    const startedAt = Date.now();

    try {
      const response = await handler(request, ...args);
      response.headers.set("x-request-id", requestId);

      log({
        msg: "request",
        route: name,
        method: request.method,
        status: response.status,
        durationMs: Date.now() - startedAt,
        requestId,
      });

      return response;
    } catch (error) {
      const typed = asTypedError(error);
      const status = typed?.status ?? 500;
      const retryAfter = status === 503 ? 5 : undefined;

      log({
        msg: "request_failed",
        level: status >= 500 ? "error" : "warn",
        route: name,
        method: request.method,
        status,
        durationMs: Date.now() - startedAt,
        requestId,
        code: typed?.code ?? "internal_error",
        // The real message goes to the log, never to a 5xx response body.
        error: error instanceof Error ? `${error.name}: ${error.message}` : "unknown",
      });

      const body: ErrorEnvelope = {
        error: typed?.message ?? "Something went wrong on our side.",
        code: typed?.code ?? "internal_error",
        requestId,
        ...(retryAfter ? { retryAfterSeconds: retryAfter } : {}),
      };

      return Response.json(body, {
        status,
        headers: {
          "x-request-id": requestId,
          "cache-control": "no-store",
          ...(retryAfter ? { "retry-after": String(retryAfter) } : {}),
        },
      });
    }
  };
}

/** One structured line per request, so it can be queried rather than read. */
export function log(fields: Record<string, unknown>): void {
  console.log(JSON.stringify({ ts: new Date().toISOString(), level: "info", ...fields }));
}
