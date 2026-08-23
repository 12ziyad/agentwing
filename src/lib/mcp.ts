/**
 * MCP proxy.
 *
 * Sits between an agent and an upstream MCP server, deciding every
 * `tools/call` before it reaches the tool.
 *
 * Built deliberately narrow. The MCP gateway market is crowded and partly free
 * — Cloudflare MCP Server Portals, AWS AgentCore Gateway, Pomerium, Kong,
 * agentgateway, Docker's — and competing on gateway features is not the point.
 * The point is that this shares one policy set and one receipt log with the
 * hook adapter, so remote tool calls and local shell actions are governed by
 * the same rules and land in the same audit trail. Nobody spans both layers.
 *
 * The honest limitation, stated because a control that can be walked around
 * should say so: an agent configured to talk to the upstream server directly
 * bypasses this entirely. What AgentWing guarantees is that traffic routed
 * through it is decided and recorded — not that no other route exists. Closing
 * that requires the upstream to refuse unproxied callers, which is the
 * upstream's decision, not ours.
 */

export const MCP_PROTOCOL_VERSION = "2026-07-28";

/** Errors the 2026-07-28 transport defines for us. */
export const MCP_ERROR = {
  parse: -32700,
  invalidRequest: -32600,
  methodNotFound: -32601,
  invalidParams: -32602,
  internal: -32603,
  headerMismatch: -32020,
} as const;

export type JsonRpcRequest = {
  jsonrpc: "2.0";
  id?: string | number | null;
  method: string;
  params?: Record<string, unknown>;
  _meta?: Record<string, unknown>;
};

export type JsonRpcError = {
  jsonrpc: "2.0";
  id: string | number | null;
  error: { code: number; message: string; data?: unknown };
};

export function rpcError(id: string | number | null, code: number, message: string, data?: unknown): JsonRpcError {
  return { jsonrpc: "2.0", id, error: { code, message, ...(data === undefined ? {} : { data }) } };
}

/**
 * Decode an `Mcp-Name` header.
 *
 * The spec permits RFC 2047-style base64 encoding for names that are not plain
 * ASCII, and requires servers to decode before comparing — a proxy that
 * compares the raw header treats an encoded name as a different tool, which is
 * a routing bug and, here, a policy bypass.
 */
export function decodeMcpName(raw: string | null): string | undefined {
  if (!raw) return undefined;
  const encoded = /^=\?base64\?(.*)\?=$/.exec(raw.trim());
  if (!encoded) return raw.trim();
  try {
    return new TextDecoder().decode(Uint8Array.from(atob(encoded[1]!), (c) => c.charCodeAt(0)));
  } catch {
    return undefined;
  }
}

export type HeaderValidation =
  | { ok: true; method: string; name?: string }
  | { ok: false; code: number; message: string };

/**
 * Check the routing headers against the body.
 *
 * The 2026-07-28 transport requires `Mcp-Method` and `Mcp-Name` on Streamable
 * HTTP POSTs precisely so intermediaries can route and meter without parsing
 * the body. That only holds if the headers actually match the body — otherwise
 * a caller sends `Mcp-Method: tools/list` with a `tools/call` body and is
 * routed as a harmless read.
 */
export function validateHeaders(request: Request, body: JsonRpcRequest): HeaderValidation {
  const headerMethod = request.headers.get("mcp-method");
  if (!headerMethod) {
    return { ok: false, code: MCP_ERROR.headerMismatch, message: "The Mcp-Method header is required." };
  }

  if (headerMethod !== body.method) {
    return {
      ok: false,
      code: MCP_ERROR.headerMismatch,
      message: `Mcp-Method says "${headerMethod}" but the body calls "${body.method}".`,
    };
  }

  const headerName = decodeMcpName(request.headers.get("mcp-name"));

  if (body.method === "tools/call") {
    const bodyName = typeof body.params?.name === "string" ? body.params.name : undefined;
    if (!headerName) {
      return { ok: false, code: MCP_ERROR.headerMismatch, message: "The Mcp-Name header is required for tools/call." };
    }
    if (headerName !== bodyName) {
      return {
        ok: false,
        code: MCP_ERROR.headerMismatch,
        message: `Mcp-Name says "${headerName}" but the body calls "${bodyName}".`,
      };
    }
  }

  return { ok: true, method: body.method, name: headerName };
}

/**
 * Map an MCP tool call onto an AgentWing action.
 *
 * Names are conventional rather than specified, so this reads the shape of the
 * arguments as well as the name. Anything unrecognised becomes `custom_action`,
 * which the engine holds for a human — guessing a type from an unfamiliar tool
 * is how a destructive operation gets classified as harmless.
 */
export function toolCallToAction(
  toolName: string,
  args: Record<string, unknown>,
  context: { serverName?: string; sessionId?: string } = {},
): {
  actionType: string;
  tool: string;
  target?: string;
  command?: string;
  description: string;
  metadata: Record<string, unknown>;
} {
  const name = toolName.toLowerCase();
  const str = (key: string): string | undefined => (typeof args[key] === "string" ? (args[key] as string) : undefined);

  const base = {
    tool: context.serverName ? `${context.serverName}:${toolName}` : toolName,
    metadata: { surface: "mcp", mcpTool: toolName, mcpServer: context.serverName, sessionId: context.sessionId } as Record<
      string,
      unknown
    >,
  };

  const command = str("command") ?? str("cmd") ?? str("script");
  if (command || name.includes("exec") || name.includes("shell") || name.includes("bash") || name.includes("terminal")) {
    return { ...base, actionType: "shell_command", command: command ?? "", description: `Run: ${(command ?? toolName).slice(0, 160)}` };
  }

  const path = str("path") ?? str("file_path") ?? str("filePath") ?? str("filename");
  if (path) {
    const writing = /write|edit|create|delete|remove|patch|append|move/.test(name);
    return {
      ...base,
      actionType: "file_access",
      target: path,
      description: `${writing ? "Modify" : "Read"} ${path}`,
      metadata: { ...base.metadata, operation: writing ? "write" : "read" },
    };
  }

  const url = str("url") ?? str("uri") ?? str("endpoint");
  if (url) {
    return {
      ...base,
      actionType: "network_request",
      target: url,
      description: `Request ${url}`,
      metadata: { ...base.metadata, method: str("method") ?? "GET" },
    };
  }

  const query = str("query") ?? str("sql");
  if (query) {
    return { ...base, actionType: "database_query", command: query, description: `Query: ${query.slice(0, 160)}` };
  }

  return {
    ...base,
    actionType: "custom_action",
    description: `MCP tool: ${toolName}`,
    metadata: { ...base.metadata, arguments: args },
  };
}

/**
 * A blocked call, expressed in-protocol.
 *
 * Returned as a successful JSON-RPC result carrying `isError: true` rather than
 * a transport error, because this is the tool reporting a refusal — the call
 * was well-formed and the proxy understood it. A transport error would look
 * like a broken gateway and invite a retry.
 */
export function blockedToolResult(id: string | number | null, reason: string, policy: string, receiptId?: string) {
  return {
    jsonrpc: "2.0" as const,
    id,
    result: {
      isError: true,
      content: [
        {
          type: "text",
          text: `AgentWing blocked this tool call.\n\n${reason}\n\nPolicy: ${policy}${
            receiptId ? `\nReceipt: ${receiptId}` : ""
          }\n\nDo not retry this call. Re-plan with a safe alternative.`,
        },
      ],
    },
  };
}

/**
 * A held call, expressed with MRTR.
 *
 * The 2026-07-28 spec added Multi Round-Trip Requests: a server answers
 * `resultType: "input_required"` and the client retries once it has what was
 * asked for. That is an in-protocol `approval_required` — the agent is told to
 * wait, without needing to know anything about AgentWing.
 *
 * `requestState` is integrity-protected by the spec's own requirement, which is
 * why the run id is carried inside a signed value rather than as a bare string
 * the client could edit to point at a different run.
 */
export function approvalRequiredResult(
  id: string | number | null,
  options: { approvalUrl: string; reason: string; policy: string; requestState: string },
) {
  return {
    jsonrpc: "2.0" as const,
    id,
    result: {
      resultType: "input_required",
      requestState: options.requestState,
      inputRequests: {
        approval: {
          type: "confirmation",
          message: `${options.reason}\n\nA human must approve this at: ${options.approvalUrl}`,
        },
      },
    },
  };
}
