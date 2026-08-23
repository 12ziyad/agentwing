import { AgentWingError, request } from "./http.js";
import type {
  ActionRun,
  AgentAction,
  ApprovalHandoff,
  CheckActionResult,
  ExecutionResultPayload,
  RuntimeSurface,
} from "./types.js";

export * from "./types.js";
export { AgentWingError } from "./http.js";

const DEFAULT_BASE_URL = "https://agentwing.gpmai.dev";
const DEFAULT_TIMEOUT_MS = 15_000;
const DEFAULT_MAX_RETRIES = 3;

export type AgentWingOptions = {
  apiKey: string;
  baseUrl?: string;
  /** Per-request timeout. Default 15s. */
  timeoutMs?: number;
  /** Total attempts per request, including the first. Default 3. */
  maxRetries?: number;
  fetch?: typeof fetch;
};

export type RequestOverrides = {
  timeoutMs?: number;
  maxRetries?: number;
  signal?: AbortSignal;
  /** Makes a retried write safe: the server replays the first response. */
  idempotencyKey?: string;
};

export type ExecuteActionOptions<T = unknown> = RequestOverrides & {
  runtime?: {
    surface: RuntimeSurface;
    runnerId?: string;
  };
  /**
   * Called when the run is held for human approval, before polling begins.
   * Use it to surface `handoff.approvalUrl` to your operator.
   */
  onApprovalRequired?: (ctx: { run: ActionRun; handoff?: ApprovalHandoff }) => void | Promise<void>;
  /** How often to poll while waiting on a human. Default 3s. */
  pollIntervalMs?: number;
  /** How long to wait for a human before giving up. Default 10 minutes. */
  maxWaitMs?: number;
  createRestorePoint?: (run: ActionRun) => Promise<void> | void;
  localRunner?: (run: ActionRun) => Promise<T> | T;
  serializeLocalResult?: (result: T) => ExecutionResultPayload;
};

export type ExecuteActionResult<T = unknown> = {
  run: ActionRun;
  handoff?: ApprovalHandoff;
  localResult?: T;
  /** True when the wait for a human elapsed without a decision. */
  timedOut?: boolean;
};

export class AgentWingGuardError extends Error {
  readonly result: CheckActionResult;

  constructor(result: CheckActionResult) {
    super(`AgentWing did not allow this action: ${result.decision} (${result.policy}). ${result.feedback}`);
    this.name = "AgentWingGuardError";
    this.result = result;
  }
}

export class AgentWing {
  readonly #apiKey: string;
  readonly #baseUrl: string;
  readonly #timeoutMs: number;
  readonly #maxRetries: number;
  readonly #fetcher: typeof fetch;

  constructor(options: AgentWingOptions) {
    if (!options.apiKey) throw new Error("AgentWing requires an apiKey.");

    this.#apiKey = options.apiKey;
    this.#baseUrl = (options.baseUrl ?? DEFAULT_BASE_URL).replace(/\/+$/, "");
    this.#timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    this.#maxRetries = options.maxRetries ?? DEFAULT_MAX_RETRIES;
    this.#fetcher = options.fetch ?? globalThis.fetch;

    if (typeof this.#fetcher !== "function") {
      throw new Error("No fetch implementation available. Pass one via options.fetch.");
    }
  }

  #send<T>(path: string, init: { method?: string; body?: unknown } & RequestOverrides): Promise<T> {
    return request<T>(this.#fetcher, `${this.#baseUrl}${path}`, this.#apiKey, {
      method: init.method,
      body: init.body,
      timeoutMs: init.timeoutMs ?? this.#timeoutMs,
      maxRetries: init.maxRetries ?? this.#maxRetries,
      signal: init.signal,
      idempotencyKey: init.idempotencyKey,
    });
  }

  /** Ask whether an action may proceed. Does not create a run. */
  checkAction(action: AgentAction, overrides: RequestOverrides = {}): Promise<CheckActionResult> {
    return this.#send<CheckActionResult>("/api/v1/check-action", { method: "POST", body: action, ...overrides });
  }

  async getActionRun(runId: string, overrides: RequestOverrides = {}): Promise<ActionRun> {
    const data = await this.#send<{ run: ActionRun }>(`/api/v1/action-runs/${encodeURIComponent(runId)}`, overrides);
    return data.run;
  }

  async continueActionRun(
    runId: string,
    body: Record<string, unknown>,
    overrides: RequestOverrides = {},
  ): Promise<ActionRun> {
    const data = await this.#send<{ run: ActionRun }>(
      `/api/v1/action-runs/${encodeURIComponent(runId)}/continue`,
      { method: "POST", body, ...overrides },
    );
    return data.run;
  }

  /**
   * Run an action through the full guarded lifecycle.
   *
   * When the decision is `approval_required`, this surfaces the handoff and
   * then polls. It cannot approve on your behalf: the server does not give the
   * proposing agent a credential that would let it.
   */
  async executeAction<T = unknown>(
    action: AgentAction,
    options: ExecuteActionOptions<T> = {},
  ): Promise<ExecuteActionResult<T>> {
    const body: Record<string, unknown> = { ...action };
    if (options.runtime) {
      body.runtime = {
        surface: options.runtime.surface,
        interactiveApproval: true,
        ...(options.runtime.runnerId ? { runnerId: options.runtime.runnerId } : {}),
      };
    }

    const data = await this.#send<{ run: ActionRun; approval?: ApprovalHandoff }>("/api/v1/execute-action", {
      method: "POST",
      body,
      timeoutMs: options.timeoutMs,
      maxRetries: options.maxRetries,
      signal: options.signal,
      idempotencyKey: options.idempotencyKey,
    });

    let run = data.run;
    const handoff = data.approval;

    if (run.status === "waiting_approval") {
      await options.onApprovalRequired?.({ run, handoff });

      const waited = await this.#waitForDecision(run.runId, options);
      run = waited.run;
      if (waited.timedOut) return { run, handoff, timedOut: true };
      if (run.status === "rejected" || run.status === "blocked") return { run, handoff };
    }

    if (run.status === "waiting_sandbox") return { run, handoff };

    if (run.status === "restore_point_required") {
      if (!options.createRestorePoint) return { run, handoff };
      await options.createRestorePoint(run);
      run = await this.continueActionRun(run.runId, { restorePointCreated: true }, { signal: options.signal });
    }

    if (run.status === "external_runner_required" || run.status === "checkpoint_created" || run.status === "approved") {
      if (!options.localRunner) return { run, handoff };

      const startedAt = Date.now();
      try {
        const localResult = await options.localRunner(run);
        const executionResult = options.serializeLocalResult
          ? options.serializeLocalResult(localResult)
          : { stdout: "", stderr: "", exitCode: 0, durationMs: Date.now() - startedAt };

        run = await this.continueActionRun(
          run.runId,
          { executionTarget: "local_runner", executionResult },
          { signal: options.signal },
        );
        return { run, handoff, localResult };
      } catch (error) {
        run = await this.continueActionRun(
          run.runId,
          {
            executionTarget: "local_runner",
            executionResult: {
              stdout: "",
              stderr: "",
              exitCode: 1,
              durationMs: Date.now() - startedAt,
              error: error instanceof Error ? error.message : "The local runner failed.",
            },
          },
          { signal: options.signal },
        );
        return { run, handoff };
      }
    }

    return { run, handoff };
  }

  /**
   * Check first, then run.
   *
   * Throws `AgentWingGuardError` when the decision is anything but `allow`, so
   * the failure is impossible to ignore by forgetting to read a return value.
   */
  async guardAction<T>(
    { action, execute }: { action: AgentAction; execute: () => Promise<T> | T },
    overrides: RequestOverrides = {},
  ): Promise<T> {
    const result = await this.checkAction(action, overrides);
    if (result.decision !== "allow") throw new AgentWingGuardError(result);
    return execute();
  }

  async #waitForDecision(
    runId: string,
    options: { pollIntervalMs?: number; maxWaitMs?: number; signal?: AbortSignal },
  ): Promise<{ run: ActionRun; timedOut: boolean }> {
    const interval = options.pollIntervalMs ?? 3_000;
    const deadline = Date.now() + (options.maxWaitMs ?? 10 * 60 * 1000);

    let run = await this.getActionRun(runId, { signal: options.signal });
    while (run.status === "waiting_approval" || run.status === "running") {
      if (Date.now() >= deadline) return { run, timedOut: true };
      await sleep(interval, options.signal);
      run = await this.getActionRun(runId, { signal: options.signal });
    }

    return { run, timedOut: false };
  }
}

/**
 * A cancellable sleep whose timer is always cleared.
 *
 * The previous approval wait raced a callback against a `setTimeout` that was
 * never cleared and never unrefed, so the process stayed alive for the full
 * timeout after the work had finished — measured at eight seconds past exit.
 */
function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(new AgentWingError("The request was cancelled.", "cancelled"));
      return;
    }

    const timer = setTimeout(() => {
      signal?.removeEventListener("abort", onAbort);
      resolve();
    }, ms);

    function onAbort() {
      clearTimeout(timer);
      reject(new AgentWingError("The request was cancelled.", "cancelled"));
    }

    signal?.addEventListener("abort", onAbort, { once: true });
  });
}
