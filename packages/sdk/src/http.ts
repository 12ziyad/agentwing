/**
 * The HTTP layer.
 *
 * Every request the SDK makes goes through `request()`. Previously each method
 * called `fetch` directly with only method, headers and body — no timeout, no
 * retry, no cancellation — so a hung AgentWing meant a hung agent, and a single
 * transient blip failed the whole operation.
 */

export class AgentWingError extends Error {
  readonly code: string;
  readonly status?: number;
  readonly requestId?: string;
  readonly retryAfterSeconds?: number;

  constructor(
    message: string,
    code: string,
    options: { status?: number; requestId?: string; retryAfterSeconds?: number; cause?: unknown } = {},
  ) {
    super(message);
    this.name = "AgentWingError";
    this.code = code;
    this.status = options.status;
    this.requestId = options.requestId;
    this.retryAfterSeconds = options.retryAfterSeconds;
    if (options.cause !== undefined) this.cause = options.cause;
  }

  /** Whether trying the same request again could plausibly succeed. */
  get retryable(): boolean {
    if (this.code === "network_error" || this.code === "timeout") return true;
    if (this.status === undefined) return false;
    return this.status === 429 || (this.status >= 500 && this.status <= 599);
  }
}

export type RequestOptions = {
  method?: string;
  body?: unknown;
  /** Per-attempt timeout. */
  timeoutMs: number;
  /** Total attempts including the first. */
  maxRetries: number;
  /** Caller-supplied cancellation, honoured alongside the timeout. */
  signal?: AbortSignal;
  idempotencyKey?: string;
};

const RETRYABLE_STATUS = new Set([408, 425, 429, 500, 502, 503, 504]);

function backoffMs(attempt: number, retryAfterSeconds?: number): number {
  if (retryAfterSeconds !== undefined && retryAfterSeconds > 0) {
    return Math.min(retryAfterSeconds * 1000, 30_000);
  }
  // Full jitter: spreads retries out instead of synchronising every client that
  // failed at the same moment into the same next moment.
  const ceiling = Math.min(30_000, 250 * 2 ** attempt);
  return Math.random() * ceiling;
}

function parseRetryAfter(response: Response): number | undefined {
  const header = response.headers.get("retry-after");
  if (!header) return undefined;
  const seconds = Number(header);
  return Number.isFinite(seconds) && seconds >= 0 ? seconds : undefined;
}

/**
 * Combine the caller's signal with a per-attempt timeout.
 *
 * `AbortSignal.any` is not available everywhere the SDK runs, so this is done
 * by hand — and the listener is removed on settle, because a listener left on a
 * long-lived caller signal is a leak that only shows up under load.
 */
function attemptSignal(timeoutMs: number, external?: AbortSignal): { signal: AbortSignal; dispose: () => void } {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(new Error("timeout")), timeoutMs);

  const onExternalAbort = () => controller.abort(external?.reason);
  if (external) {
    if (external.aborted) controller.abort(external.reason);
    else external.addEventListener("abort", onExternalAbort, { once: true });
  }

  return {
    signal: controller.signal,
    dispose: () => {
      clearTimeout(timer);
      external?.removeEventListener("abort", onExternalAbort);
    },
  };
}

export async function request<T>(
  fetcher: typeof fetch,
  url: string,
  apiKey: string,
  options: RequestOptions,
): Promise<T> {
  const attempts = Math.max(1, options.maxRetries);
  let lastError: AgentWingError | undefined;

  for (let attempt = 0; attempt < attempts; attempt += 1) {
    if (options.signal?.aborted) {
      throw new AgentWingError("The request was cancelled.", "cancelled");
    }

    const { signal, dispose } = attemptSignal(options.timeoutMs, options.signal);

    try {
      const headers: Record<string, string> = {
        authorization: `Bearer ${apiKey}`,
        accept: "application/json",
      };
      if (options.body !== undefined) headers["content-type"] = "application/json";
      if (options.idempotencyKey) headers["idempotency-key"] = options.idempotencyKey;

      const response = await fetcher(url, {
        method: options.method ?? "GET",
        headers,
        body: options.body === undefined ? undefined : JSON.stringify(options.body),
        signal,
      });

      const requestId = response.headers.get("x-request-id") ?? undefined;

      if (response.ok) {
        return (await response.json()) as T;
      }

      const payload = (await response.json().catch(() => ({}))) as { error?: string; code?: string };
      lastError = new AgentWingError(
        payload.error ?? `AgentWing request failed with ${response.status}.`,
        payload.code ?? "request_failed",
        { status: response.status, requestId, retryAfterSeconds: parseRetryAfter(response) },
      );

      if (!RETRYABLE_STATUS.has(response.status) || attempt === attempts - 1) throw lastError;
    } catch (error) {
      if (error instanceof AgentWingError) {
        lastError = error;
        if (!error.retryable || attempt === attempts - 1) throw error;
      } else {
        const aborted = options.signal?.aborted === true;
        if (aborted) throw new AgentWingError("The request was cancelled.", "cancelled", { cause: error });

        const isTimeout = error instanceof Error && /timeout|abort/i.test(error.message);
        lastError = new AgentWingError(
          isTimeout ? `Request timed out after ${options.timeoutMs}ms.` : "Could not reach AgentWing.",
          isTimeout ? "timeout" : "network_error",
          { cause: error },
        );
        if (attempt === attempts - 1) throw lastError;
      }
    } finally {
      dispose();
    }

    await new Promise((resolve) => setTimeout(resolve, backoffMs(attempt, lastError?.retryAfterSeconds)));
  }

  throw lastError ?? new AgentWingError("AgentWing request failed.", "request_failed");
}
