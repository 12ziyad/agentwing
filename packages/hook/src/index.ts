/**
 * AgentWing agent hook.
 *
 * Coding agents run shell commands, edit files and install packages through
 * built-in local tools, not through MCP. A gateway sitting on remote tool
 * traffic is structurally blind to exactly the actions AgentWing exists to
 * govern. A `PreToolUse` hook is not.
 *
 * The hook runs on the developer's machine, in the agent's critical path,
 * before every tool call. That places two hard constraints on everything here:
 * it must be fast, and it must have a defined behaviour when AgentWing is
 * unreachable.
 */

export type HookVendor = "claude-code" | "cursor" | "codex";

/** The normalised view of a tool call, whatever vendor produced it. */
export type ToolCall = {
  vendor: HookVendor;
  toolName: string;
  input: Record<string, unknown>;
  sessionId?: string;
  cwd?: string;
};

export type HookDecision = {
  /** `deny` blocks the call; `ask` defers to the human; `allow` proceeds. */
  behaviour: "allow" | "deny" | "ask";
  reason: string;
  /** Present when AgentWing decided. Absent when we failed open or closed. */
  policy?: string;
  receiptId?: string;
  approvalUrl?: string;
};

export type FailureMode = "open" | "closed";

export type HookConfig = {
  apiKey: string;
  baseUrl?: string;
  /**
   * What to do when AgentWing cannot be reached.
   *
   * `closed` is the safe default for anything that matters: a control plane
   * that silently stops controlling when it is down is not a control. `open` is
   * offered because a developer whose network drops should be able to keep
   * working, and pretending otherwise just gets the hook uninstalled.
   */
  onUnreachable?: FailureMode;
  /** Budget for the whole check. This sits in front of every tool call. */
  timeoutMs?: number;
  projectId?: string;
  agentId?: string;
};

export const DEFAULT_TIMEOUT_MS = 3_000;

/**
 * Map a vendor's tool name and arguments onto an AgentWing action.
 *
 * Deliberately conservative: a tool this does not recognise becomes
 * `custom_action`, which the engine holds for a human rather than allowing.
 * Guessing an action type from an unfamiliar tool is how a destructive
 * operation gets classified as something harmless.
 */
export function toAgentAction(call: ToolCall): {
  actionType: string;
  tool: string;
  target?: string;
  command?: string;
  description: string;
  metadata: Record<string, unknown>;
} {
  const name = call.toolName.toLowerCase();
  const input = call.input;

  const str = (key: string): string | undefined => {
    const value = input[key];
    return typeof value === "string" ? value : undefined;
  };

  const base = {
    tool: call.toolName,
    metadata: { vendor: call.vendor, cwd: call.cwd, sessionId: call.sessionId } as Record<string, unknown>,
  };

  // Shell execution. Claude Code: Bash. Cursor: run_terminal_cmd. Codex: shell.
  if (name === "bash" || name === "shell" || name.includes("terminal") || name.includes("exec")) {
    const command = str("command") ?? str("cmd") ?? "";
    return {
      ...base,
      actionType: "shell_command",
      command,
      description: str("description") ?? `Run: ${command.slice(0, 160)}`,
    };
  }

  // File writes and edits.
  if (name === "write" || name === "edit" || name === "multiedit" || name === "apply_patch" || name.includes("write_file")) {
    const target = str("file_path") ?? str("path") ?? str("filePath");
    return {
      ...base,
      actionType: "file_access",
      target,
      description: `Modify ${target ?? "a file"}`,
      metadata: { ...base.metadata, operation: "write" },
    };
  }

  // File reads.
  if (name === "read" || name === "cat" || name.includes("read_file")) {
    const target = str("file_path") ?? str("path") ?? str("filePath");
    return {
      ...base,
      actionType: "file_access",
      target,
      description: `Read ${target ?? "a file"}`,
      metadata: { ...base.metadata, operation: "read" },
    };
  }

  // Network fetches.
  if (name.includes("fetch") || name.includes("webfetch") || name.includes("http")) {
    const target = str("url") ?? str("uri");
    return {
      ...base,
      actionType: "network_request",
      target,
      description: `Fetch ${target ?? "a URL"}`,
      metadata: { ...base.metadata, method: str("method") ?? "GET" },
    };
  }

  // Anything unrecognised is held, not allowed.
  return {
    ...base,
    actionType: "custom_action",
    description: `${call.vendor} tool: ${call.toolName}`,
    metadata: { ...base.metadata, rawInput: input },
  };
}

/**
 * Ask AgentWing about a tool call.
 *
 * Never throws. A hook that throws is a hook that breaks the agent, and an
 * agent broken by its safety layer gets its safety layer removed.
 */
export async function checkToolCall(call: ToolCall, config: HookConfig): Promise<HookDecision> {
  const baseUrl = (config.baseUrl ?? "https://agentwing.gpmai.dev").replace(/\/+$/, "");
  const timeoutMs = config.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const onUnreachable: FailureMode = config.onUnreachable ?? "closed";

  const action = toAgentAction(call);

  try {
    const response = await fetch(`${baseUrl}/api/v1/check-action`, {
      method: "POST",
      headers: {
        authorization: `Bearer ${config.apiKey}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        ...action,
        projectId: config.projectId,
        agentId: config.agentId ?? call.vendor,
        sessionId: call.sessionId,
      }),
      signal: AbortSignal.timeout(timeoutMs),
    });

    if (!response.ok) {
      const payload = (await response.json().catch(() => ({}))) as { error?: string; code?: string };
      return unreachable(
        onUnreachable,
        `AgentWing returned ${response.status}${payload.code ? ` (${payload.code})` : ""}.`,
      );
    }

    const result = (await response.json()) as {
      decision: string;
      policy: string;
      feedback: string;
      receiptId?: string;
    };

    switch (result.decision) {
      case "allow":
        return { behaviour: "allow", reason: result.feedback, policy: result.policy, receiptId: result.receiptId };

      case "block":
        return { behaviour: "deny", reason: result.feedback, policy: result.policy, receiptId: result.receiptId };

      // approval_required, sandbox_required and restore_point_required all mean
      // "not like this, not right now". Surfacing them as `ask` puts the human
      // in the loop, which is the point, rather than failing the agent outright.
      default:
        return {
          behaviour: "ask",
          reason: result.feedback,
          policy: result.policy,
          receiptId: result.receiptId,
        };
    }
  } catch (error) {
    const isTimeout = error instanceof Error && /timeout|abort/i.test(error.message);
    return unreachable(onUnreachable, isTimeout ? `AgentWing did not respond within ${timeoutMs}ms.` : "AgentWing could not be reached.");
  }
}

function unreachable(mode: FailureMode, detail: string): HookDecision {
  return mode === "open"
    ? { behaviour: "allow", reason: `${detail} Configured to fail open, so this action was not checked.` }
    : {
        behaviour: "deny",
        reason: `${detail} Configured to fail closed, so this action was refused rather than run unchecked.`,
      };
}
