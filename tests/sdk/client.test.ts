import { describe, expect, it, vi } from "vitest";
import { AgentWing, AgentWingError, AgentWingGuardError } from "../../packages/sdk/src/index.js";
import type { ActionRun, CheckActionResult } from "../../packages/sdk/src/types.js";

/**
 * The SDK is on the agent's critical path.
 *
 * Every call previously passed only method, headers and body to fetch — no
 * timeout, no retry, no cancellation — so a hung AgentWing hung the agent, and
 * a single transient blip failed the whole operation.
 */

const jsonResponse = (body: unknown, init: ResponseInit = {}) =>
  new Response(JSON.stringify(body), {
    status: 200,
    headers: { "content-type": "application/json" },
    ...init,
  });

const allowResult: CheckActionResult = {
  decision: "allow",
  risk: "low",
  policy: "allow-read-only-shell",
  feedback: "ok",
  receiptId: "rcp_1",
};

const blockResult: CheckActionResult = {
  decision: "block",
  risk: "critical",
  policy: "block-destructive-shell-command",
  feedback: "This command is destructive.",
  receiptId: "rcp_2",
};

const client = (fetchImpl: typeof fetch, overrides = {}) =>
  new AgentWing({
    apiKey: "aw_live_test",
    baseUrl: "https://agentwing.test",
    fetch: fetchImpl,
    maxRetries: 3,
    timeoutMs: 200,
    ...overrides,
  });

const action = { actionType: "shell_command", command: "ls" } as const;

describe("authentication and shape", () => {
  it("refuses to construct without a key", () => {
    expect(() => new AgentWing({ apiKey: "" })).toThrow(/apiKey/);
  });

  it("sends the key as a bearer token and posts JSON", async () => {
    const fetchImpl = vi.fn(async () => jsonResponse(allowResult));
    await client(fetchImpl as unknown as typeof fetch).checkAction(action);

    const [url, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://agentwing.test/api/v1/check-action");
    expect((init.headers as Record<string, string>).authorization).toBe("Bearer aw_live_test");
    expect(init.method).toBe("POST");
    expect(JSON.parse(init.body as string)).toEqual(action);
  });

  it("normalises a base URL with a trailing slash", async () => {
    const fetchImpl = vi.fn(async () => jsonResponse(allowResult));
    await client(fetchImpl as unknown as typeof fetch, { baseUrl: "https://agentwing.test///" }).checkAction(action);
    expect((fetchImpl.mock.calls[0] as unknown as [string])[0]).toBe("https://agentwing.test/api/v1/check-action");
  });
});

describe("retries", () => {
  it("retries a 503 and succeeds", async () => {
    let calls = 0;
    const fetchImpl = vi.fn(async () => {
      calls += 1;
      return calls < 3 ? jsonResponse({ error: "down", code: "database_unavailable" }, { status: 503 }) : jsonResponse(allowResult);
    });

    const result = await client(fetchImpl as unknown as typeof fetch).checkAction(action);
    expect(result.decision).toBe("allow");
    expect(calls).toBe(3);
  });

  it("does not retry a 400 — the request will not become valid", async () => {
    let calls = 0;
    const fetchImpl = vi.fn(async () => {
      calls += 1;
      return jsonResponse({ error: "bad action", code: "invalid_action" }, { status: 400 });
    });

    await expect(client(fetchImpl as unknown as typeof fetch).checkAction(action)).rejects.toMatchObject({
      code: "invalid_action",
      status: 400,
    });
    expect(calls).toBe(1);
  });

  it("does not retry a 401", async () => {
    let calls = 0;
    const fetchImpl = vi.fn(async () => {
      calls += 1;
      return jsonResponse({ error: "Unauthorized", code: "unauthorized" }, { status: 401 });
    });

    await expect(client(fetchImpl as unknown as typeof fetch).checkAction(action)).rejects.toThrow(AgentWingError);
    expect(calls).toBe(1);
  });

  it("gives up after the configured number of attempts", async () => {
    let calls = 0;
    const fetchImpl = vi.fn(async () => {
      calls += 1;
      return jsonResponse({ error: "still down" }, { status: 503 });
    });

    await expect(
      client(fetchImpl as unknown as typeof fetch, { maxRetries: 2 }).checkAction(action),
    ).rejects.toThrow(AgentWingError);
    expect(calls).toBe(2);
  });

  it("surfaces the server's error code and request id", async () => {
    const fetchImpl = vi.fn(async () =>
      new Response(JSON.stringify({ error: "Policies unreadable.", code: "policy_store_unavailable" }), {
        status: 503,
        headers: { "content-type": "application/json", "x-request-id": "req_abc" },
      }),
    );

    let error: AgentWingError | undefined;
    try {
      await client(fetchImpl as unknown as typeof fetch, { maxRetries: 1 }).checkAction(action);
    } catch (thrown) {
      error = thrown as AgentWingError;
    }

    expect(error).toBeInstanceOf(AgentWingError);
    expect(error?.code).toBe("policy_store_unavailable");
    expect(error?.requestId).toBe("req_abc");
    expect(error?.retryable).toBe(true);
  });
});

describe("timeouts and cancellation", () => {
  it("times out a request that never resolves", async () => {
    const fetchImpl = vi.fn(
      (_url: string, init?: RequestInit) =>
        new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener("abort", () => reject(new Error("aborted")));
        }),
    );

    await expect(
      client(fetchImpl as unknown as typeof fetch, { timeoutMs: 30, maxRetries: 1 }).checkAction(action),
    ).rejects.toMatchObject({ code: "timeout" });
  });

  it("honours a caller's abort signal", async () => {
    const controller = new AbortController();
    const fetchImpl = vi.fn(
      (_url: string, init?: RequestInit) =>
        new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener("abort", () => reject(new Error("aborted")));
        }),
    );

    const pending = client(fetchImpl as unknown as typeof fetch, { timeoutMs: 5000 }).checkAction(action, {
      signal: controller.signal,
    });
    controller.abort();

    await expect(pending).rejects.toMatchObject({ code: "cancelled" });
  });

  it("leaves no timer holding the event loop open", async () => {
    // The previous approval wait raced a callback against a setTimeout it never
    // cleared and never unrefed, so a process stayed alive for the full timeout
    // after its work had finished — measured at eight seconds past exit.
    const fetchImpl = vi.fn(async () => jsonResponse(allowResult));
    const before = process.getActiveResourcesInfo?.().filter((r) => r === "Timeout").length ?? 0;

    await client(fetchImpl as unknown as typeof fetch).checkAction(action);

    const after = process.getActiveResourcesInfo?.().filter((r) => r === "Timeout").length ?? 0;
    expect(after).toBeLessThanOrEqual(before);
  });
});

describe("guardAction", () => {
  it("runs the work when the decision is allow", async () => {
    const fetchImpl = vi.fn(async () => jsonResponse(allowResult));
    const execute = vi.fn(async () => "did the thing");

    await expect(client(fetchImpl as unknown as typeof fetch).guardAction({ action, execute })).resolves.toBe(
      "did the thing",
    );
    expect(execute).toHaveBeenCalledOnce();
  });

  it("throws instead of returning, so a blocked action cannot be ignored", async () => {
    const fetchImpl = vi.fn(async () => jsonResponse(blockResult));
    const execute = vi.fn(async () => "should not run");

    let error: AgentWingGuardError | undefined;
    try {
      await client(fetchImpl as unknown as typeof fetch).guardAction({ action, execute });
    } catch (thrown) {
      error = thrown as AgentWingGuardError;
    }

    expect(error).toBeInstanceOf(AgentWingGuardError);
    expect(error?.result.decision).toBe("block");
    expect(error?.message).toContain("block-destructive-shell-command");
    expect(execute).not.toHaveBeenCalled();
  });
});

describe("approval handoff", () => {
  const heldRun = {
    runId: "run_1",
    action,
    decision: "approval_required",
    risk: "high",
    policy: "approval-deploy-action",
    status: "waiting_approval",
    executionTarget: "none",
  } as unknown as ActionRun;

  it("surfaces the handoff and polls, and never receives a credential", async () => {
    let runCall = 0;
    const fetchImpl = vi.fn(async (url: string) => {
      if (url.endsWith("/execute-action")) {
        return jsonResponse({
          run: heldRun,
          approval: {
            approvalId: "apr_1",
            approvalUrl: "https://agentwing.test/dashboard/runs/run_1",
            statusUrl: "https://agentwing.test/api/v1/action-runs/run_1",
            surface: "dashboard",
          },
        });
      }
      runCall += 1;
      return jsonResponse({ run: { ...heldRun, status: runCall < 2 ? "waiting_approval" : "rejected" } });
    });

    const seen: string[] = [];
    const { run, handoff } = await client(fetchImpl as unknown as typeof fetch).executeAction(action, {
      pollIntervalMs: 1,
      onApprovalRequired: ({ handoff: h }) => {
        if (h) seen.push(h.approvalUrl);
      },
    });

    expect(seen).toEqual(["https://agentwing.test/dashboard/runs/run_1"]);
    expect(run.status).toBe("rejected");
    // The whole point: nothing token-shaped comes back to the caller.
    expect(JSON.stringify(handoff)).not.toMatch(/token/i);
  });

  it("reports a timeout rather than hanging forever", async () => {
    const fetchImpl = vi.fn(async (url: string) =>
      url.endsWith("/execute-action")
        ? jsonResponse({ run: heldRun })
        : jsonResponse({ run: heldRun }),
    );

    const result = await client(fetchImpl as unknown as typeof fetch).executeAction(action, {
      pollIntervalMs: 1,
      maxWaitMs: 5,
    });

    expect(result.timedOut).toBe(true);
    expect(result.run.status).toBe("waiting_approval");
  });
});
