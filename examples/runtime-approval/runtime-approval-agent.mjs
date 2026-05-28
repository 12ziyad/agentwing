/**
 * AgentWing — interactive runtime approval CLI example.
 *
 * Uses the SDK executeAction with runtime.onApprovalRequired to prompt the
 * operator in the terminal before approving or rejecting a deploy_action.
 *
 * Usage:
 *   AGENTWING_API_KEY=aw_live_... node runtime-approval-agent.mjs
 *
 * Optional env vars:
 *   AGENTWING_BASE_URL   defaults to https://agentwing.gpmai.dev
 *   AGENTWING_PROJECT_ID project scoping (optional)
 *   AGENTWING_RUNNER_ID  runner identifier (optional)
 */
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createInterface } from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";

// ---------------------------------------------------------------------------
// Minimal env-file loader — reads .env from cwd if present
// ---------------------------------------------------------------------------
function loadEnvFile(path = ".env") {
  const envPath = resolve(process.cwd(), path);
  if (!existsSync(envPath)) return;
  for (const line of readFileSync(envPath, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const index = trimmed.indexOf("=");
    if (index === -1) continue;
    const key = trimmed.slice(0, index).trim();
    const value = trimmed.slice(index + 1).trim().replace(/^['"]|['"]$/g, "");
    if (key && process.env[key] === undefined) process.env[key] = value;
  }
}
loadEnvFile();

// ---------------------------------------------------------------------------
// Inline minimal SDK client (avoids requiring a local build step)
// ---------------------------------------------------------------------------
class AgentWingError extends Error {
  constructor(message, code) {
    super(message);
    this.name = "AgentWingError";
    this.code = code;
  }
}

class AgentWing {
  constructor({ apiKey, baseUrl }) {
    if (!apiKey) throw new Error("AgentWing requires an apiKey.");
    this.apiKey = apiKey;
    this.baseUrl = (baseUrl ?? "https://agentwing.gpmai.dev").replace(/\/$/, "");
  }

  async _post(path, body, headers = {}) {
    const res = await fetch(`${this.baseUrl}${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${this.apiKey}`, ...headers },
      body: JSON.stringify(body),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new AgentWingError(data.error ?? `${path} failed ${res.status}`, data.code ?? "request_failed");
    return data;
  }

  async _postBearer(url, token, body = {}) {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify(body),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new AgentWingError(data.error ?? `runner decision failed ${res.status}`, data.code ?? "runner_decision_failed");
    return data;
  }

  async executeAction(action, options = {}) {
    const { runtime } = options;
    const requestBody = {
      ...action,
      ...(runtime ? { runtime: { surface: runtime.surface, interactiveApproval: true, ...(runtime.runnerId ? { runnerId: runtime.runnerId } : {}) } } : {}),
    };

    const data = await this._post("/api/v1/execute-action", requestBody);
    let run = data.run;

    if (run.status === "waiting_approval" && data.approval && runtime?.onApprovalRequired) {
      const decisionResult = await runtime.onApprovalRequired({ run, approval: data.approval });
      const decision = typeof decisionResult === "string" ? decisionResult : decisionResult.decision;
      const reason = typeof decisionResult === "object" ? decisionResult.reason : undefined;
      const endpoint = decision === "approve" ? data.approval.approveEndpoint : data.approval.rejectEndpoint;
      const resp = await this._postBearer(endpoint, data.approval.runnerApprovalToken, reason ? { reason } : {});
      return { run: resp.run };
    }

    return { run };
  }
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
const baseUrl = (process.env.AGENTWING_BASE_URL || "https://agentwing.gpmai.dev").replace(/\/$/, "");
const apiKey = process.env.AGENTWING_API_KEY;
const projectId = process.env.AGENTWING_PROJECT_ID;

if (!apiKey) {
  console.error("AGENTWING_API_KEY is required.");
  process.exit(1);
}

const aw = new AgentWing({ apiKey, baseUrl });

console.log("AgentWing interactive runtime approval demo");
console.log(`Base URL: ${baseUrl}`);

let timedOut = false;

const { run } = await aw.executeAction(
  {
    actionType: "deploy_action",
    tool: "deploy",
    target: "production",
    description: "Deploy the current build to production.",
    ...(projectId ? { projectId } : {}),
    sessionId: `runtime-approval-${Date.now()}`,
    agentId: process.env.AGENTWING_RUNNER_ID || "terminal-demo-runner",
  },
  {
    runtime: {
      surface: "cli",
      runnerId: process.env.AGENTWING_RUNNER_ID || "terminal-demo-runner",
      approvalTimeoutMs: 2 * 60 * 1000,
      onApprovalRequired: async ({ run: pendingRun, approval }) => {
        console.log(`\nRun ID: ${pendingRun.runId}`);
        console.log(`Dashboard: ${approval.approvalUrl}`);
        console.log(`Token expires: ${approval.expiresAt}`);

        const rl = createInterface({ input, output });
        const answer = await rl.question("\nApprove deploy to production? (y/n) ");
        rl.close();

        const approved = answer.trim().toLowerCase() === "y";
        const reason = approved
          ? "Approved from terminal runtime surface."
          : "Rejected from terminal runtime surface.";
        return { decision: approved ? "approve" : "reject", reason };
      },
    },
  },
).catch((err) => {
  if (err instanceof AgentWingError && err.code === "approval_timeout") {
    timedOut = true;
    return { run: null };
  }
  throw err;
});

if (timedOut) {
  console.log("Approval timed out — no decision made.");
  process.exit(0);
}

console.log(`\nFinal status:     ${run.status}`);
console.log(`Execution target: ${run.executionTarget}`);
if (run.nextStep) console.log(`Next:             ${run.nextStep}`);
