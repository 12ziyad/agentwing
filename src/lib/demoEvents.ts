import type { DemoEvent } from "./demoTypes";

// Each entry: [milliseconds from test run start, event]
export const REPLAY_SEQUENCE: Array<[number, DemoEvent]> = [
  // ── Phase 1: WITHOUT AgentWing runs fast ──────────────────────────
  [100,  { type: "phase", phase: 1, total: 7, label: "WITHOUT AgentWing · agent running directly" }],
  [500,  { type: "without_line", timestamp: "10:31:02", kind: "bad",  text: "read .env  ❌  secret values leaked into agent transcript" }],
  [1700, { type: "without_line", timestamp: "10:31:05", kind: "warn", text: "edit boxArenaConfig.ts  ⚠️  47 lines changed · no diff captured · no restore point" }],
  [3000, { type: "without_line", timestamp: "10:31:08", kind: "warn", text: "npm test on host  ⚠️  ran outside sandbox · no replay evidence" }],
  [4300, { type: "without_line", timestamp: "10:31:11", kind: "bad",  text: "git push --force  ❌  main branch overwritten · history rewritten" }],
  [5600, { type: "without_line", timestamp: "10:31:14", kind: "bad",  text: "POST /deploy/staging  ❌  deploy fired at 03:14 · no approval · no audit" }],
  [6500, { type: "without_frozen" }],

  // ── Phase 2: TX-001 · read .env → BLOCKED ─────────────────────────
  [7200,  { type: "phase", phase: 2, total: 7, label: "WITH AgentWing · intercepting tool calls" }],
  [7500,  { type: "wisp_state", state: "checking" }],
  [7500,  { type: "wisp_message", text: "Intercepting read .env…" }],
  [7900,  { type: "transaction", id: "TX-001", action: "read .env", tool_call: { tool: "read_file", args: { path: ".env" } }, status: "blocked", policy: "block-secret-file-access", risk: "high", meta: ["8ms policy check", "evaluated before fs access"], feedback: "Use .env.example instead" }],
  [8300,  { type: "feedback_contract", tx_id: "TX-001", risk_score: 0.94, policy_reason: "Secret file access blocked", sandbox_result: "not_executed", changed_files: [], command_output: null, errors: [], safer_alternative: "Use .env.example instead", feedback_to_agent: "Replace .env read with .env.example", show_full_json: true }],
  [9100,  { type: "plan_strike", line_id: "L1" }],
  [9700,  { type: "plan_add_after", after_id: "L1", text: "→ Read .env.example instead" }],
  [10300, { type: "wisp_state", state: "approved" }],
  [10300, { type: "wisp_message", text: "Approved: .env.example is safe to read" }],
  [10700, { type: "transaction", id: "TX-002", action: "read .env.example", tool_call: { tool: "read_file", args: { path: ".env.example" } }, status: "approved", policy: "allow-read-only-file-access", risk: "low", meta: ["3ms policy check", "non-secret placeholder file"] }],

  // ── Phase 3: TX-003 · write boxArenaConfig.ts → RESTORE POINT ──────────────
  [11600, { type: "phase", phase: 3, total: 7, label: "WITH AgentWing · capturing restore point" }],
  [11900, { type: "restore_point", id: "RP-001", desc: "initial state", current: true }],
  [11900, { type: "wisp_state", state: "checking" }],
  [11900, { type: "wisp_message", text: "Capturing restore point before code edit…" }],
  [12300, { type: "transaction", id: "TX-003", action: "write src/boxArenaConfig.ts", tool_call: { tool: "write_file", args: { path: "src/boxArenaConfig.ts", lines: 47 } }, status: "restore", policy: "restore-point-file-write", risk: "medium", meta: ["checkpoint locked", "6ms policy check"] }],
  [12700, { type: "wisp_state", state: "approved" }],
  [13000, { type: "terminal_line", tx_id: "TX-003", text: "agentwing@sandbox:~$ agentwing tx start TX-003" }],
  [13500, { type: "terminal_line", tx_id: "TX-003", text: "[TX-003] Proposed action: write src/boxArenaConfig.ts" }],
  [14000, { type: "terminal_line", tx_id: "TX-003", text: "[TX-003] Policy matched: restore-point-file-write" }],
  [14600, { type: "terminal_line", tx_id: "TX-003", text: "[TX-003] Capturing Restore Point: RP-002" }],
  [15200, { type: "terminal_line", tx_id: "TX-003", text: "[TX-003] Files captured: 7" }],
  [15700, { type: "terminal_line", tx_id: "TX-003", text: "[TX-003] Restore Point locked" }],
  [16200, { type: "terminal_line", tx_id: "TX-003", text: "[TX-003] Applying controlled write" }],
  [16800, { type: "terminal_line", tx_id: "TX-003", text: "[TX-003] Transaction committed" }],
  [17300, { type: "restore_point", id: "RP-002", desc: "before box edit", current: true }],

  // ── Phase 4: TX-004 · npm test → SANDBOXED ────────────────────────
  [18200, { type: "phase", phase: 4, total: 7, label: "WITH AgentWing · sandbox replay" }],
  [18500, { type: "wisp_state", state: "sandboxing" }],
  [18500, { type: "wisp_message", text: "Replaying npm test in E2B sandbox…" }],
  [18900, { type: "transaction", id: "TX-004", action: "npm test", tool_call: { tool: "shell", args: { cmd: "npm test" } }, status: "sandboxed", policy: "sandbox-node-command", risk: "medium", meta: ["E2B provider", "isolated replay", "11ms policy check"] }],
  [19300, { type: "terminal_line", tx_id: "TX-004", text: "agentwing@sandbox:~$ npm test" }],
  [19800, { type: "terminal_line", tx_id: "TX-004", text: "[TX-004] Syncing 7 files to E2B sandbox" }],
  [20400, { type: "terminal_line", tx_id: "TX-004", text: "[TX-004] Running npm test" }],
  [21100, { type: "terminal_line", tx_id: "TX-004", text: "[TX-004] ✓ boxArenaConfig.test.js passed (412ms)" }],
  [21700, { type: "terminal_line", tx_id: "TX-004", text: "[TX-004] ✓ auth.test.js passed (388ms)" }],
  [22300, { type: "terminal_line", tx_id: "TX-004", text: "[TX-004] Capturing stdout/stderr" }],
  [22900, { type: "terminal_line", tx_id: "TX-004", text: "[TX-004] Returning sandbox output to AgentWing" }],
  [23400, { type: "terminal_line", tx_id: "TX-004", text: "[TX-004] Feedback Contract sent to agent" }],
  [23900, { type: "feedback_contract", tx_id: "TX-004", risk_score: 0.15, policy_reason: "Tests passed in isolated sandbox", sandbox_result: "passed", changed_files: ["src/boxArenaConfig.ts"], command_output: "2 passed, 0 failed", errors: [], safer_alternative: null, feedback_to_agent: "Tests passed. Safe to proceed.", show_full_json: false }],

  // ── Phase 5: TX-005 · git push --force → BLOCKED ─────────────────
  [25000, { type: "phase", phase: 5, total: 7, label: "WITH AgentWing · blocking force push" }],
  [25300, { type: "wisp_state", state: "blocked" }],
  [25300, { type: "wisp_message", text: "Force push blocked · protecting main branch" }],
  [25700, { type: "transaction", id: "TX-005", action: "git push --force origin main", tool_call: { tool: "shell", args: { cmd: "git push --force origin main" } }, status: "blocked", policy: "block-force-push", risk: "high", meta: ["6ms policy check", "skipped before shell execution"], feedback: "Create a safe feature branch instead" }],
  [26300, { type: "plan_strike", line_id: "L4" }],
  [26900, { type: "plan_add_after", after_id: "L4", text: "→ git checkout -b safe-auth-fix" }],
  [27400, { type: "feedback_contract", tx_id: "TX-005", risk_score: 0.97, policy_reason: "Force push to protected branch blocked", sandbox_result: "not_executed", changed_files: [], command_output: null, errors: [], safer_alternative: "Create a feature branch and open a PR", feedback_to_agent: "Use git checkout -b safe-auth-fix instead", show_full_json: false }],

  // ── Phase 6: TX-006 · POST /deploy/staging → APPROVAL ────────────
  [28500, { type: "phase", phase: 6, total: 7, label: "WITH AgentWing · approval gate" }],
  [28800, { type: "wisp_state", state: "checking" }],
  [28800, { type: "wisp_message", text: "Deploy requires human approval…" }],
  [29200, { type: "transaction", id: "TX-006", action: "POST /deploy/staging", tool_call: { tool: "http_request", args: { method: "POST", url: "/deploy/staging" } }, status: "approval", policy: "approval-deploy-action", risk: "high", meta: ["external side effect", "cannot be rolled back", "9ms policy check"] }],
  [29800, { type: "plan_strike", line_id: "L5" }],
  [30400, { type: "plan_add_after", after_id: "L5", text: "→ Request deploy approval" }],
  [30900, { type: "restore_point", id: "RP-003", desc: "current state", current: true }],

  // Auto-approve after 7s if user hasn't acted
  [37000, { type: "approval_action", tx_id: "TX-006", action: "approve" }],
  [37500, { type: "wisp_state", state: "approved" }],
  [37500, { type: "wisp_message", text: "Deploy approved · immutable audit receipt generated" }],

  // ── Phase 7: Complete ─────────────────────────────────────────────
  [38500, { type: "phase", phase: 7, total: 7, label: "Test run complete · audit receipt generated" }],
  [39000, { type: "wisp_state", state: "idle" }],
  [39000, { type: "wisp_message", text: "All 6 transactions processed. Audit receipt sealed." }],
  [39800, {
    type: "summary",
    metrics: {
      "Transactions": 6,
      "Blocked": 2,
      "Sandboxed": 1,
      "Approval-gated": 1,
      "Replans": 2,
      "Restore Points": 2,
      "Policy overhead": "6–14ms",
      "Sandbox replay": "1.3s",
    },
    without_outcomes: [
      "Secret leaked to agent transcript",
      "main branch overwritten · history rewritten",
      "Staging deployed at 03:14 without approval",
      "47 lines changed · no diff captured",
      "No restore point",
      "No audit receipt",
    ],
    with_outcomes: [
      ".env blocked before execution",
      ".env.example used instead",
      "Restore Point captured before code edit",
      "Tests replayed in E2B sandbox",
      "Force push blocked · branch protected",
      "Deploy held for human approval",
      "Agent plan updated safely",
      "Audit receipt generated",
    ],
  }],
];
