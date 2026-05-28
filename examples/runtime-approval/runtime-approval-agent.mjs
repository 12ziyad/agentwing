import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createInterface } from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";

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

const baseUrl = (process.env.AGENTWING_BASE_URL || "https://agentwing.gpmai.dev").replace(/\/$/, "");
const apiKey = process.env.AGENTWING_API_KEY;
const projectId = process.env.AGENTWING_PROJECT_ID;

if (!apiKey) {
  console.error("AGENTWING_API_KEY is required.");
  process.exit(1);
}

async function executeAction() {
  const response = await fetch(`${baseUrl}/api/v1/execute-action`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      action: {
        projectId,
        sessionId: `runtime-approval-${Date.now()}`,
        agentId: "terminal-runtime-approval-demo",
        actionType: "deploy_action",
        tool: "deploy",
        target: "production",
        description: "Deploy the current build to production.",
      },
      runtime: {
        surface: "cli",
        interactiveApproval: true,
        runnerId: process.env.AGENTWING_RUNNER_ID || "terminal-demo-runner",
      },
    }),
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || `execute-action failed with ${response.status}`);
  return data;
}

async function postRunnerDecision(endpoint, runnerApprovalToken, reason) {
  const response = await fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ runnerApprovalToken, reason }),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || `runner decision failed with ${response.status}`);
  return data;
}

async function main() {
  console.log("AgentWing terminal runtime approval demo");
  console.log(`Base URL: ${baseUrl}`);

  const result = await executeAction();
  const run = result.run;
  console.log(`Run: ${run.runId}`);
  console.log(`Decision/status: ${result.decision} / ${result.status}`);
  if (result.nextStep) console.log(`Next: ${result.nextStep}`);

  if (result.status !== "waiting_approval" || !result.approval?.runnerApprovalToken) {
    console.log("This action did not return a runner approval token.");
    return;
  }

  console.log(`Dashboard approval URL: ${result.approval.approvalUrl}`);
  console.log(`Runner token expires at: ${result.approval.expiresAt}`);

  const rl = createInterface({ input, output });
  const answer = await rl.question("Approve? y/N ");
  rl.close();

  const approved = answer.trim().toLowerCase() === "y";
  const endpoint = approved ? result.approval.approveEndpoint : result.approval.rejectEndpoint;
  const decision = await postRunnerDecision(
    endpoint,
    result.approval.runnerApprovalToken,
    approved ? "Approved from terminal runtime surface." : "Rejected from terminal runtime surface.",
  );

  console.log(`Final status: ${decision.run.status}`);
  console.log(`Execution target: ${decision.run.executionTarget}`);
  if (decision.nextStep) console.log(`Next: ${decision.nextStep}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : "Unexpected error.");
  process.exit(1);
});
