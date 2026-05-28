// ============================================================================
//  AgentWing — Mini Agent Live Demo
//  A fake "AI agent" that proposes risky actions and lets AgentWing control them.
//  Watch it: allow / block / ask-for-approval / sandbox / checkpoint — live.
//
//  HOW TO RUN:
//    1. Paste your FRESH api key below (regenerate it in the dashboard first).
//    2. Make sure you have Node 18+  (run:  node -v )
//    3. node mini-agent.mjs
//
//  No npm install needed. Uses built-in fetch + readline only.
// ============================================================================

import readline from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";

// ----------------------------------------------------------------------------
// CONFIG  — paste your key here (or set AGENTWING_API_KEY env var)
// ----------------------------------------------------------------------------
const API_KEY  = process.env.AGENTWING_API_KEY || "aw_live_1a0b11bda69f9d687e923632166a9f7360cd73d1ebf6153e";
const BASE_URL = "https://agentwing.gpmai.dev";
const RUNNER_ID = "mini-agent-cli";

// ----------------------------------------------------------------------------
// pretty terminal helpers
// ----------------------------------------------------------------------------
const c = {
  reset: "\x1b[0m", dim: "\x1b[2m", bold: "\x1b[1m",
  cyan: "\x1b[36m", green: "\x1b[32m", red: "\x1b[31m",
  yellow: "\x1b[33m", magenta: "\x1b[35m", blue: "\x1b[34m", gray: "\x1b[90m",
};
const paint = (color, s) => `${c[color]}${s}${c.reset}`;
const line = () => console.log(paint("gray", "─".repeat(74)));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function decisionColor(d) {
  return { allow: "green", block: "red", approval_required: "yellow",
           sandbox_required: "cyan", restore_point_required: "magenta" }[d] || "blue";
}

const rl = readline.createInterface({ input, output });

// ----------------------------------------------------------------------------
// API helpers
// ----------------------------------------------------------------------------
async function api(path, { method = "GET", body, token } = {}) {
  const url = path.startsWith("http") ? path : `${BASE_URL}${path}`;
  const res = await fetch(url, {
    method,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token || API_KEY}`,
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  let data;
  try { data = await res.json(); } catch { data = {}; }
  return { status: res.status, ok: res.ok, data };
}

const executeAction = (action) =>
  api("/api/v1/execute-action", {
    method: "POST",
    body: { ...action, runtime: { surface: "cli", interactiveApproval: true, runnerId: RUNNER_ID } },
  });

const getRun = (runId) => api(`/api/v1/action-runs/${runId}`);

const runnerApprove = (endpoint, token, reason) =>
  api(endpoint, { method: "POST", token, body: { reason } });

const runnerReject = (endpoint, token, reason) =>
  api(endpoint, { method: "POST", token, body: { reason } });

const continueRun = (runId, body) =>
  api(`/api/v1/action-runs/${runId}/continue`, { method: "POST", body });

// poll until the run reaches a settled state (or times out)
async function pollUntilSettled(runId, { tries = 8, intervalMs = 1500 } = {}) {
  const waiting = new Set(["waiting_approval", "approved", "running", "proposed", "checked"]);
  let run;
  for (let i = 0; i < tries; i++) {
    const { data } = await getRun(runId);
    run = data.run || data;
    if (!run || !waiting.has(run.status)) return run;
    await sleep(intervalMs);
  }
  return run;
}

// ----------------------------------------------------------------------------
// the demo "agent" — a list of actions it wants to perform
// ----------------------------------------------------------------------------
const AGENT_PLAN = [
  { label: "Read project manifest",
    action: { actionType: "file_access", tool: "filesystem", target: "package.json",
              description: "Agent reads package.json to understand deps" } },

  { label: "Read environment secrets",
    action: { actionType: "file_access", tool: "filesystem", target: ".env",
              description: "Agent tries to read .env secrets" } },

  { label: "Install a dependency",
    action: { actionType: "shell_command", tool: "terminal", command: "npm install lodash",
              description: "Agent installs lodash" } },

  { label: "Wipe the filesystem",
    action: { actionType: "shell_command", tool: "terminal", command: "rm -rf /",
              description: "Agent attempts a destructive command" } },

  { label: "Deploy to production",
    action: { actionType: "deploy_action", tool: "ci", target: "production",
              command: "deploy", description: "Agent wants to deploy to prod" } },

  { label: "Edit config file",
    action: { actionType: "config_change", tool: "filesystem", target: "config/app.yaml",
              description: "Agent modifies a config file" } },

  { label: "Charge a customer",
    action: { actionType: "payment_action", tool: "stripe", target: "cus_123",
              command: "charge $499", description: "Agent issues a payment" } },
];

// ----------------------------------------------------------------------------
// run ONE action through the full lifecycle, narrating each step
// ----------------------------------------------------------------------------
async function runOne(step, idx) {
  line();
  console.log(`${paint("bold", `ACTION ${idx + 1}/${AGENT_PLAN.length}`)}  ${paint("cyan", step.label)}`);
  const a = step.action;
  console.log(paint("dim", `   agent proposes → ${a.actionType}  ${a.command || a.target || ""}`));

  // 1) propose → AgentWing checks
  const res = await executeAction(a);
  if (!res.ok) {
    console.log(paint("red", `   ✖ execute-action failed (${res.status}): ${JSON.stringify(res.data)}`));
    return { label: step.label, decision: "error" };
  }

  let run = res.data.run || res.data;
  const decision = res.data.decision || run.decision;
  const dc = decisionColor(decision);
  console.log(`   ${paint("bold", "AgentWing decision:")} ${paint(dc, decision.toUpperCase())}  ` +
              paint("gray", `(risk: ${res.data.risk || run.risk}, policy: ${res.data.policy || run.policy})`));
  if (res.data.nextStep) console.log(paint("dim", `   ↳ ${res.data.nextStep}`));

  // 2) branch on decision
  if (decision === "allow") {
    console.log(paint("green", "   ✓ Cleared. Agent executes the action."));
  }

  else if (decision === "block") {
    console.log(paint("red", "   ⛔ BLOCKED. The action never runs. Agent must re-plan."));
  }

  else if (decision === "approval_required") {
    const approval = res.data.approval;
    if (!approval) {
      console.log(paint("yellow", "   ⏳ Waiting for approval in the dashboard (no runner token returned)."));
      run = await pollUntilSettled(run.runId);
      console.log(`   final status: ${paint(decisionColor(run.status), run.status)}`);
    } else {
      console.log(paint("yellow", `   ⚠ HUMAN APPROVAL NEEDED — agent is paused, waiting for YOU.`));
      console.log(paint("dim", `     approval url: ${approval.approvalUrl}`));
      const ans = (await rl.question(paint("bold", `     Approve "${step.label}"? (y/n) `))).trim().toLowerCase();

      if (ans === "y" || ans === "yes") {
        const r = await runnerApprove(approval.approveEndpoint, approval.runnerApprovalToken, "approved via mini-agent");
        if (r.ok) {
          console.log(paint("green", "   ✓ Approved (with one-time runner token)."));
          run = await pollUntilSettled((r.data.run || run).runId || run.runId);
          console.log(`   execution status: ${paint(decisionColor(run.status), run.status)}`);
        } else {
          console.log(paint("red", `   ✖ approve failed (${r.status}): code=${r.data.code} ${r.data.error || ""}`));
        }
      } else {
        const r = await runnerReject(approval.rejectEndpoint, approval.runnerApprovalToken, "rejected via mini-agent");
        console.log(r.ok ? paint("red", "   ⛔ Rejected. Action will not run.")
                         : paint("red", `   ✖ reject failed (${r.status}): ${r.data.error || ""}`));
        run = (r.data && r.data.run) || run;
      }
    }
  }

  else if (decision === "sandbox_required") {
    const sb = res.data.sandbox;
    if (sb && sb.connected) {
      console.log(paint("cyan", "   📦 Routed to your BYOK E2B sandbox. Waiting for result..."));
      run = await pollUntilSettled(run.runId);
      console.log(`   sandbox status: ${paint(decisionColor(run.status), run.status)}`);
      if (run.stdout) console.log(paint("gray", `   stdout: ${String(run.stdout).slice(0, 200)}`));
    } else {
      console.log(paint("cyan", "   📦 SANDBOX REQUIRED — but no E2B sandbox connected."));
      console.log(paint("dim", "     Action is NOT run locally (safe). Connect E2B at /dashboard/sandboxes."));
    }
  }

  else if (decision === "restore_point_required") {
    console.log(paint("magenta", "   💾 RESTORE POINT REQUIRED — agent creates a checkpoint first."));
    await sleep(500);
    console.log(paint("dim", "     ...checkpoint created."));
    const r = await continueRun(run.runId, { restorePointCreated: true });
    run = (r.data && r.data.run) || run;
    console.log(`   status after checkpoint: ${paint(decisionColor(run.status), run.status)}`);
    console.log(paint("dim", "     (now safe to proceed with the change)"));
  }

  console.log(paint("gray", `   receipt: ${res.data.receiptId || run.receiptId || "—"}   runId: ${run.runId}`));
  return { label: step.label, decision };
}

// ----------------------------------------------------------------------------
// main
// ----------------------------------------------------------------------------
async function main() {
  console.clear();
  line();
  console.log(paint("bold", "  🛫  AgentWing — Mini Agent Live Demo"));
  console.log(paint("dim", "  A fake agent proposes 7 actions. AgentWing controls each one."));
  line();

  if (API_KEY.includes("PASTE_YOUR_KEY")) {
    console.log(paint("red", "\n  ✖ No API key set. Edit API_KEY at the top, or run:"));
    console.log(paint("dim", "    AGENTWING_API_KEY=aw_live_xxx node mini-agent.mjs\n"));
    rl.close();
    return;
  }

  // sanity ping
  const ping = await api("/api/v1/check-action", {
    method: "POST",
    body: { actionType: "file_access", tool: "filesystem", target: ".env", description: "ping" },
  });
  if (!ping.ok) {
    console.log(paint("red", `\n  ✖ API not reachable / key invalid (status ${ping.status}).`));
    console.log(paint("dim", `    ${JSON.stringify(ping.data)}\n`));
    rl.close();
    return;
  }
  console.log(paint("green", `  ✓ Connected. Key works. (.env check returned: ${ping.data.decision})\n`));

  const results = [];
  for (let i = 0; i < AGENT_PLAN.length; i++) {
    results.push(await runOne(AGENT_PLAN[i], i));
    await sleep(400);
  }

  // summary
  line();
  console.log(paint("bold", "  SUMMARY"));
  const tally = {};
  for (const r of results) {
    tally[r.decision] = (tally[r.decision] || 0) + 1;
    console.log(`   ${paint(decisionColor(r.decision), r.decision.padEnd(22))} ${r.label}`);
  }
  line();
  const parts = Object.entries(tally).map(([k, v]) => `${paint(decisionColor(k), k)}:${v}`);
  console.log("  totals → " + parts.join("   "));
  console.log(paint("dim", "\n  Open https://agentwing.gpmai.dev/dashboard/runs to see every run + receipt.\n"));
  rl.close();
}

main().catch((e) => { console.error(paint("red", "Fatal: " + e.message)); rl.close(); });
