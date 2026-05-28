import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

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
const sessionId = `guarded-runner-${Date.now()}`;

if (!apiKey) {
  console.error("AGENTWING_API_KEY is required.");
  process.exit(1);
}

const actions = [
  {
    name: "package.json read",
    action: { actionType: "file_access", tool: "filesystem", target: "package.json", description: "Read package manifest.", metadata: { operation: "read" } },
    localRunner: () => readFileSync(resolve(process.cwd(), "package.json"), "utf8"),
  },
  {
    name: ".env read",
    action: { actionType: "file_access", tool: "filesystem", target: ".env", description: "Read environment secrets.", metadata: { operation: "read" } },
  },
  {
    name: "npm install lodash",
    action: { actionType: "package_install", tool: "npm", target: "lodash", command: "npm install lodash", description: "Install lodash." },
  },
  {
    name: "deploy to production",
    action: { actionType: "deploy_action", tool: "deploy", target: "production", description: "Deploy to production." },
  },
  {
    name: "external email",
    action: { actionType: "message_send", tool: "email", target: "external-customer", description: "Send an external email.", metadata: { external: true, channel: "email" } },
  },
  {
    name: "file write",
    action: { actionType: "file_access", tool: "filesystem", target: "src/auth.ts", description: "Edit auth code.", metadata: { operation: "write" } },
  },
  {
    name: "package.json read again",
    action: { actionType: "file_access", tool: "filesystem", target: "package.json", description: "Read package manifest.", metadata: { operation: "read" } },
  },
];

async function api(path, options = {}) {
  const response = await fetch(`${baseUrl}${path}`, {
    ...options,
    headers: {
      "Authorization": `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || `Request failed with ${response.status}`);
  return data;
}

async function pollRun(runId) {
  for (;;) {
    const { run } = await api(`/api/v1/action-runs/${runId}`);
    if (!["waiting_approval", "approved", "running"].includes(run.status)) return run;
    console.log(`Waiting for human approval/run progress: ${run.status}`);
    await new Promise((resolve) => setTimeout(resolve, 3000));
  }
}

async function continueWithLocalResult(run, localRunner) {
  if (!localRunner) return run;
  const startedAt = Date.now();
  const output = localRunner(run);
  const { run: updated } = await api(`/api/v1/action-runs/${run.runId}/continue`, {
    method: "POST",
    body: JSON.stringify({
      executionTarget: "local_runner",
      executionResult: {
        stdout: typeof output === "string" ? `local runner returned ${output.length} bytes` : "",
        stderr: "",
        exitCode: 0,
        durationMs: Date.now() - startedAt,
      },
    }),
  });
  return updated;
}

async function run() {
  console.log("AgentWing guarded-runner example");
  console.log(`Base URL: ${baseUrl}`);
  console.log(`Session: ${sessionId}`);

  for (const item of actions) {
    const action = {
      projectId,
      sessionId,
      agentId: "guarded-runner-demo",
      ...item.action,
    };

    console.log(`\nProposed action: ${item.name}`);
    const { run: created } = await api("/api/v1/execute-action", {
      method: "POST",
      body: JSON.stringify(action),
    });

    let run = created;
    console.log(`Run: ${run.runId}`);
    console.log(`Decision/status: ${run.decision} / ${run.status}`);
    if (run.nextStep) console.log(`Next: ${run.nextStep}`);

    if (run.status === "waiting_approval") {
      console.log("Waiting for human approval in /dashboard/runs. No local execution performed.");
      run = await pollRun(run.runId);
    }

    if (run.status === "waiting_sandbox") {
      console.log("Connect E2B BYOK sandbox to continue. No local execution performed.");
      continue;
    }

    if (run.status === "restore_point_required") {
      console.log("Restore point required. This demo does not fake checkpoints.");
      continue;
    }

    if (run.status === "external_runner_required" || run.status === "execution_skipped") {
      if (item.localRunner) {
        console.log("Running explicit local callback for this safe demo action.");
        run = await continueWithLocalResult(run, item.localRunner);
        console.log(`Updated status: ${run.status}`);
      } else {
        console.log("No explicit local runner configured. Skipped local execution.");
      }
      continue;
    }

    if (run.status === "blocked") {
      console.log("Blocked by AgentWing. No execution performed.");
    } else {
      console.log(`Final status: ${run.status}`);
    }
  }
}

run().catch((error) => {
  console.error(error instanceof Error ? error.message : "Unexpected error.");
  process.exit(1);
});
