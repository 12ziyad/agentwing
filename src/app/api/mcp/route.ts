import { evaluateActionPolicy } from "@/lib/actionRunLifecycle";
import {
  createReceipt,
  incrementActionCheckUsage,
  PolicyStoreUnavailableError,
  trackEvent,
  unauthorizedResponse,
  validateApiKeyFromRequest,
} from "@/lib/agentwingStore";
import { actionCheckLimitExceeded, actionCheckLimitResponse } from "@/lib/rateLimit";
import {
  approvalRequiredResult,
  blockedToolResult,
  MCP_ERROR,
  MCP_PROTOCOL_VERSION,
  rpcError,
  toolCallToAction,
  validateHeaders,
} from "@/lib/mcp";
import type { JsonRpcRequest } from "@/lib/mcp";
import { withRoute } from "@/lib/withRoute";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * MCP endpoint.
 *
 * Decides every `tools/call` against the same policy set as the REST API and
 * the hook adapter, and records it in the same receipt log. That shared
 * substrate is the reason this exists — not gateway features, which several
 * free products already do well.
 *
 * Stateless, which the 2026-07-28 spec made possible by removing the
 * initialize handshake and Mcp-Session-Id. No session affinity, no shared
 * store, so it scales the way a Worker should.
 */

function json(body: unknown, status = 200) {
  return Response.json(body, {
    status,
    headers: { "cache-control": "no-store", "mcp-protocol-version": MCP_PROTOCOL_VERSION },
  });
}

async function handlePOST(request: Request) {
  const auth = await validateApiKeyFromRequest(request);
  if (!auth) {
    await trackEvent("api_401", { metadata: { path: "/api/mcp" } });
    return unauthorizedResponse();
  }

  let body: JsonRpcRequest;
  try {
    body = (await request.json()) as JsonRpcRequest;
  } catch {
    return json(rpcError(null, MCP_ERROR.parse, "The request body is not valid JSON."), 400);
  }

  if (!body || body.jsonrpc !== "2.0" || typeof body.method !== "string") {
    return json(rpcError(body?.id ?? null, MCP_ERROR.invalidRequest, "Expected a JSON-RPC 2.0 request."), 400);
  }

  const id = body.id ?? null;

  // Headers must agree with the body. The spec puts the method and tool name in
  // headers so intermediaries can route without parsing the body — which only
  // holds if they match. Otherwise a caller sends Mcp-Method: tools/list with a
  // tools/call body and is routed as a harmless read.
  const headers = validateHeaders(request, body);
  if (!headers.ok) {
    return json(rpcError(id, headers.code, headers.message), 400);
  }

  if (body.method !== "tools/call") {
    // Deliberately narrow. This proxy exists to decide tool calls, not to
    // reimplement a full MCP server; anything else is out of scope rather than
    // half-implemented.
    return json(
      rpcError(id, MCP_ERROR.methodNotFound, `AgentWing's MCP endpoint handles tools/call. Received "${body.method}".`),
      404,
    );
  }

  const toolName = typeof body.params?.name === "string" ? body.params.name : undefined;
  if (!toolName) {
    return json(rpcError(id, MCP_ERROR.invalidParams, "tools/call requires a tool name."), 400);
  }

  const args = (body.params?.arguments as Record<string, unknown> | undefined) ?? {};

  const usage = await incrementActionCheckUsage(auth.apiKeyId);
  if (actionCheckLimitExceeded(usage)) return actionCheckLimitResponse(usage);

  const action = toolCallToAction(toolName, args, {
    serverName: request.headers.get("mcp-server") ?? undefined,
    sessionId: typeof body._meta?.["io.modelcontextprotocol/sessionId"] === "string"
      ? (body._meta["io.modelcontextprotocol/sessionId"] as string)
      : undefined,
  });

  let evaluation;
  try {
    evaluation = await evaluateActionPolicy(
      { ...action, actionType: action.actionType as never, projectId: auth.projectId },
      auth.workspaceId,
      auth.projectId,
    );
  } catch (error) {
    if (error instanceof PolicyStoreUnavailableError) {
      // Fail closed: without the workspace's policies we cannot know whether
      // this call is allowed.
      return json(rpcError(id, MCP_ERROR.internal, error.message), 503);
    }
    throw error;
  }

  const receipt = await createReceipt(
    { ...action, actionType: action.actionType as never, projectId: auth.projectId },
    evaluation,
    auth.apiKeyId,
    auth.workspaceId,
  );

  await trackEvent("mcp_tool_call", {
    workspaceId: auth.workspaceId,
    projectId: auth.projectId,
    metadata: { tool: toolName, decision: evaluation.decision, policy: evaluation.policy, receiptId: receipt.receiptId },
  });

  if (evaluation.decision === "block") {
    return json(blockedToolResult(id, evaluation.feedback, evaluation.policy, receipt.receiptId));
  }

  if (evaluation.decision === "approval_required") {
    const origin = new URL(request.url).origin;
    return json(
      approvalRequiredResult(id, {
        approvalUrl: `${origin}/dashboard/approvals`,
        reason: evaluation.feedback,
        policy: evaluation.policy,
        requestState: receipt.receiptId,
      }),
    );
  }

  // allow, sandbox_required and restore_point_required all mean the caller may
  // proceed on its own terms. The decision and its receipt are returned so the
  // client knows what was recorded and under which rule.
  return json({
    jsonrpc: "2.0",
    id,
    result: {
      content: [
        {
          type: "text",
          text:
            evaluation.decision === "allow"
              ? `AgentWing allowed this call. [${evaluation.policy}]`
              : `AgentWing requires ${evaluation.decision.replace(/_/g, " ")} before this runs. ${evaluation.feedback} [${evaluation.policy}]`,
        },
      ],
      _meta: {
        "dev.agentwing/decision": evaluation.decision,
        "dev.agentwing/policy": evaluation.policy,
        "dev.agentwing/receiptId": receipt.receiptId,
      },
    },
  });
}

/** Protected-resource metadata, so an MCP client can discover how to authenticate. */
async function handleGET(request: Request) {
  const origin = new URL(request.url).origin;
  return json({
    resource: `${origin}/api/mcp`,
    protocolVersion: MCP_PROTOCOL_VERSION,
    authorization: {
      type: "bearer",
      description: "Send an AgentWing API key as `Authorization: Bearer aw_live_...`.",
    },
    supportedMethods: ["tools/call"],
  });
}

export const GET = withRoute("mcp", handleGET);

export const POST = withRoute("mcp", handlePOST);
