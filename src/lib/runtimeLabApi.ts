import type { DemoEvent, TxStatus } from "./demoTypes";
import type { AgentAction, AgentWingDecision } from "./agentwingTypes";

const DEMO_API_KEY = "aw_live_demo_key";
const PROJECT_ID = "runtime-lab";
const AGENT_ID = "mini-code-agent";

type CheckActionResponse = {
  decision: AgentWingDecision;
  risk: "low" | "medium" | "high";
  policy: string;
  feedback: string;
  receiptId: string;
};

function decisionToStatus(decision: AgentWingDecision): TxStatus {
  if (decision === "block") return "blocked";
  if (decision === "approval_required") return "approval";
  if (decision === "sandbox_required") return "sandboxed";
  if (decision === "restore_point_required") return "restore";
  return "approved";
}

function actionForTransaction(event: Extract<DemoEvent, { type: "transaction" }>, sessionId: string): AgentAction {
  const base = {
    projectId: PROJECT_ID,
    sessionId,
    agentId: AGENT_ID,
  };

  switch (event.id) {
    case "TX-001":
      return {
        ...base,
        actionType: "file_access",
        tool: "read_file",
        target: ".env",
        command: "read .env",
        description: "Mini Code Agent requests environment configuration.",
        metadata: { operation: "read", runtimeLabTxId: event.id },
      };
    case "TX-002":
      return {
        ...base,
        actionType: "file_access",
        tool: "read_file",
        target: ".env.example",
        command: "read .env.example",
        description: "Mini Code Agent reads non-secret environment placeholders.",
        metadata: { operation: "read", runtimeLabTxId: event.id },
      };
    case "TX-003":
      return {
        ...base,
        actionType: "file_access",
        tool: "write_file",
        target: "src/boxArenaConfig.ts",
        command: "write src/boxArenaConfig.ts",
        description: "Mini Code Agent writes the Box Arena configuration.",
        metadata: { operation: "write", lines: 47, runtimeLabTxId: event.id },
      };
    case "TX-004":
      return {
        ...base,
        actionType: "shell_command",
        tool: "shell",
        target: "package scripts",
        command: "npm test",
        description: "Mini Code Agent runs the project test suite.",
        metadata: { runtimeLabTxId: event.id },
      };
    case "TX-005":
      return {
        ...base,
        actionType: "shell_command",
        tool: "shell",
        target: "origin main",
        command: "git push --force origin main",
        description: "Mini Code Agent attempts to force push to main.",
        metadata: { branch: "main", runtimeLabTxId: event.id },
      };
    case "TX-006":
      return {
        ...base,
        actionType: "deploy_action",
        tool: "http_request",
        target: "/deploy/staging",
        command: "POST /deploy/staging",
        description: "Mini Code Agent requests a staging deploy.",
        metadata: { method: "POST", environment: "staging", runtimeLabTxId: event.id },
      };
    default:
      return {
        ...base,
        actionType: "custom_action",
        tool: "runtime_lab",
        target: event.action,
        command: event.action,
        description: `Runtime Lab transaction ${event.id}`,
        metadata: { runtimeLabTxId: event.id, toolCall: event.tool_call },
      };
  }
}

export function createRuntimeLabSessionId() {
  if (globalThis.crypto?.randomUUID) {
    return `rtlab_${globalThis.crypto.randomUUID().replace(/-/g, "").slice(0, 12)}`;
  }
  return `rtlab_${Math.random().toString(36).slice(2, 14)}`;
}

export async function enrichRuntimeLabTransaction(
  event: Extract<DemoEvent, { type: "transaction" }>,
  sessionId: string,
): Promise<Extract<DemoEvent, { type: "transaction" }>> {
  const startedAt = performance.now();
  const action = actionForTransaction(event, sessionId);

  try {
    const response = await fetch("/api/v1/check-action", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${DEMO_API_KEY}`,
      },
      body: JSON.stringify(action),
    });

    const result = (await response.json()) as Partial<CheckActionResponse>;
    if (!response.ok || !result.decision || !result.policy || !result.feedback) {
      throw new Error(result.feedback ?? "AgentWing API check failed.");
    }

    const elapsed = Math.max(1, Math.round(performance.now() - startedAt));
    return {
      ...event,
      status: decisionToStatus(result.decision),
      policy: result.policy,
      risk: result.risk ?? event.risk,
      feedback: result.feedback,
      receipt_id: result.receiptId,
      meta: [
        `${elapsed}ms API policy check`,
        "POST /api/v1/check-action",
        `receipt ${result.receiptId}`,
        ...event.meta.filter((item) => !item.includes("policy check")),
      ],
    };
  } catch (error) {
    return {
      ...event,
      status: "blocked",
      policy: "runtime-lab-api-unavailable",
      risk: "medium",
      feedback: error instanceof Error ? error.message : "AgentWing API check failed.",
      meta: ["API policy check failed", ...event.meta.filter((item) => !item.includes("policy check"))],
    };
  }
}
