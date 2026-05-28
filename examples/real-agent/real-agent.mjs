import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

function loadEnvFile(path = ".env") {
  const envPath = resolve(process.cwd(), path);
  if (!existsSync(envPath)) return;

  const lines = readFileSync(envPath, "utf8").split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;

    const index = trimmed.indexOf("=");
    if (index === -1) continue;

    const key = trimmed.slice(0, index).trim();
    const value = trimmed.slice(index + 1).trim().replace(/^['"]|['"]$/g, "");
    if (key && process.env[key] === undefined) {
      process.env[key] = value;
    }
  }
}

loadEnvFile();

const baseUrl = (process.env.AGENTWING_BASE_URL || "https://agentwing.gpmai.dev").replace(/\/$/, "");
const apiKey = process.env.AGENTWING_API_KEY;
const projectId = process.env.AGENTWING_PROJECT_ID;
const sessionId = `real-agent-${Date.now()}`;

if (!apiKey) {
  console.error("AGENTWING_API_KEY is required. Generate one at /dashboard/api-keys and add it to .env.");
  process.exit(1);
}

if (!projectId) {
  console.warn("AGENTWING_PROJECT_ID is empty. Add a project ID from /dashboard/projects for workspace-scoped receipts.");
}

if (process.env.OPENAI_API_KEY) {
  console.log("OPENAI_API_KEY detected. This demo still uses the deterministic plan for repeatable safety checks.");
}

const deterministicPlan = [
  {
    name: "read package.json",
    action: {
      projectId,
      sessionId,
      agentId: "real-local-agent",
      actionType: "file_access",
      tool: "filesystem",
      target: "package.json",
      description: "Read package.json before planning.",
      metadata: { operation: "read" },
    },
    execute: () => {
      const content = readFileSync(resolve(process.cwd(), "package.json"), "utf8");
      console.log(`Executed safe read: package.json (${content.length} bytes)`);
    },
  },
  {
    name: "read .env",
    action: {
      projectId,
      sessionId,
      agentId: "real-local-agent",
      actionType: "file_access",
      tool: "filesystem",
      target: ".env",
      description: "Read local environment secrets.",
      metadata: { operation: "read" },
    },
  },
  {
    name: "npm install lodash",
    action: {
      projectId,
      sessionId,
      agentId: "real-local-agent",
      actionType: "shell_command",
      tool: "terminal",
      command: "npm install lodash",
      description: "Install a package requested by the agent.",
    },
  },
  {
    name: "rm -rf /",
    action: {
      projectId,
      sessionId,
      agentId: "real-local-agent",
      actionType: "shell_command",
      tool: "terminal",
      command: "rm -rf /",
      description: "Destructive system-level cleanup.",
    },
  },
];

async function checkAction(action) {
  const response = await fetch(`${baseUrl}/api/v1/check-action`, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(action),
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.error || `AgentWing check failed with ${response.status}`);
  }
  return data;
}

function printDecision(result) {
  console.log(`AgentWing: ${result.decision} | risk=${result.risk} | policy=${result.policy}`);
  console.log(`Feedback: ${result.feedback}`);
  console.log(`Receipt: ${result.receiptId || "not returned"}`);
  if (result.nextStep) console.log(`Next: ${result.nextStep}`);
}

async function run() {
  console.log("AgentWing real-agent example");
  console.log(`Base URL: ${baseUrl}`);
  console.log(`Session: ${sessionId}`);

  for (const item of deterministicPlan) {
    console.log(`\nProposed action: ${item.name}`);
    const result = await checkAction(item.action);
    printDecision(result);

    if (result.decision === "allow") {
      if (typeof item.execute === "function") {
        item.execute();
      } else {
        console.log("Allowed, but no safe local executor is registered for this action. Skipped.");
      }
      continue;
    }

    if (result.decision === "block") {
      console.log("Blocked by AgentWing. Skipped local execution.");
      continue;
    }

    if (result.decision === "sandbox_required") {
      console.log("Sandbox required. Route to AgentWing sandbox/E2B or connected sandbox.");
      console.log("No local execution performed.");
      continue;
    }

    if (result.decision === "approval_required") {
      console.log(`Approval required. approvalId=${result.approvalId || "not returned"}`);
      console.log("Open /dashboard/runs for the managed run approval flow.");
      continue;
    }

    if (result.decision === "restore_point_required") {
      console.log("Restore point required. Create and verify a checkpoint before execution.");
      console.log("No rollback is faked by this example.");
      continue;
    }

    console.log("Unknown decision. Skipped local execution.");
  }
}

run().catch((error) => {
  console.error(error instanceof Error ? error.message : "Unexpected error.");
  process.exit(1);
});
