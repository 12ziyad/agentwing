/**
 * agentwing-hook — the executable a coding agent invokes before each tool call.
 *
 * Reads the vendor's hook payload on stdin, asks AgentWing, and answers in
 * whatever dialect that vendor speaks.
 *
 * Install (Claude Code, .claude/settings.json):
 *
 *   { "hooks": { "PreToolUse": [{ "matcher": "*",
 *       "hooks": [{ "type": "command", "command": "npx -y @agentwing/hook" }] }] } }
 *
 * Configuration comes from the environment, because a hook has no other
 * sensible channel:
 *
 *   AGENTWING_API_KEY        required
 *   AGENTWING_BASE_URL       optional, for self-hosting
 *   AGENTWING_FAIL           "open" | "closed"  (default: closed)
 *   AGENTWING_TIMEOUT_MS     default 3000
 *   AGENTWING_PROJECT_ID     optional
 */

import { checkToolCall } from "./index.js";
import type { HookVendor, ToolCall } from "./index.js";

/**
 * Read stdin as a stream rather than `readFileSync(0)`.
 *
 * The synchronous read leaves the stdin handle mid-teardown, and calling
 * `process.exit()` straight afterwards trips a libuv assertion on Windows
 * (`!(handle->flags & UV_HANDLE_CLOSING)`), which crashes the process with exit
 * 127 — so the block never reaches the agent as the exit 2 it expects.
 */
async function readStdin(): Promise<string> {
  if (process.stdin.isTTY) return "";
  const chunks: Buffer[] = [];
  for await (const chunk of process.stdin) chunks.push(chunk as Buffer);
  return Buffer.concat(chunks).toString("utf8");
}

/**
 * Work out which agent invoked us and normalise its payload.
 *
 * The vendors use different field names for the same two facts. Detection is by
 * shape rather than an env var, so one binary works everywhere with no
 * per-vendor configuration.
 */
function parsePayload(raw: string): ToolCall | undefined {
  let body: Record<string, unknown>;
  try {
    body = JSON.parse(raw) as Record<string, unknown>;
  } catch {
    return undefined;
  }

  const vendorHint = process.env.AGENTWING_HOOK_VENDOR as HookVendor | undefined;

  const snakeName = typeof body.tool_name === "string" ? body.tool_name : undefined; // Claude Code, Codex
  const camelName = typeof body.toolName === "string" ? body.toolName : undefined; // Cursor

  const toolName = snakeName ?? camelName;
  if (!toolName) return undefined;

  const input =
    (body.tool_input as Record<string, unknown> | undefined) ??
    (body.input as Record<string, unknown> | undefined) ??
    {};

  return {
    vendor: vendorHint ?? (camelName ? "cursor" : "claude-code"),
    toolName,
    input,
    sessionId:
      typeof body.session_id === "string" ? body.session_id : typeof body.sessionId === "string" ? body.sessionId : undefined,
    cwd: typeof body.cwd === "string" ? body.cwd : undefined,
  };
}

/** Emit the decision and set the exit code the vendor reads. */
function respond(decision: Awaited<ReturnType<typeof checkToolCall>>): void {
  const detail = decision.policy ? `${decision.reason} [${decision.policy}]` : decision.reason;

  const permissionDecision =
    decision.behaviour === "allow" ? "allow" : decision.behaviour === "deny" ? "deny" : "ask";

  process.stdout.write(
    `${JSON.stringify({
      hookSpecificOutput: {
        hookEventName: "PreToolUse",
        permissionDecision,
        permissionDecisionReason: detail,
      },
    })}\n`,
  );

  if (decision.behaviour === "deny") {
    // stderr reaches the model, so it can re-plan rather than retry blindly,
    // and exit 2 is what makes the vendor actually block the call.
    process.stderr.write(`AgentWing blocked this action: ${detail}\n`);
    process.exitCode = 2;
    return;
  }

  if (decision.behaviour === "ask") {
    process.stderr.write(
      `AgentWing is holding this action for review: ${detail}${
        decision.approvalUrl ? `\nApprove at: ${decision.approvalUrl}` : ""
      }\n`,
    );
  }

  process.exitCode = 0;
}

async function main(): Promise<void> {
  const apiKey = process.env.AGENTWING_API_KEY;

  if (!apiKey) {
    // A missing key is a configuration error, not a policy decision. Blocking
    // every tool call because someone forgot an env var is a worse failure than
    // not checking, and it is the kind that gets the hook uninstalled.
    process.stderr.write("agentwing-hook: AGENTWING_API_KEY is not set — tool calls are not being checked.\n");
    process.exitCode = 0;
    return;
  }

  const call = parsePayload(await readStdin());
  if (!call) {
    process.stderr.write("agentwing-hook: could not read a tool call from stdin.\n");
    process.exitCode = 0;
    return;
  }

  respond(
    await checkToolCall(call, {
      apiKey,
      baseUrl: process.env.AGENTWING_BASE_URL,
      onUnreachable: process.env.AGENTWING_FAIL === "open" ? "open" : "closed",
      timeoutMs: Number(process.env.AGENTWING_TIMEOUT_MS) || undefined,
      projectId: process.env.AGENTWING_PROJECT_ID,
    }),
  );
}

// Setting `process.exitCode` rather than calling `process.exit()` lets Node
// flush stdout and tear down cleanly. Exiting abruptly here truncates the JSON
// the agent is reading.
await main();
