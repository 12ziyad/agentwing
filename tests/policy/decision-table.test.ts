import { describe, expect, it } from "vitest";
import { evaluateAgentAction } from "@/lib/agentwingPolicy";
import { actionTypes } from "@/lib/agentwingTypes";
import type { AgentAction, AgentWingDecision, AgentWingRisk } from "@/lib/agentwingTypes";

/**
 * The golden decision table.
 *
 * This is the security contract of the engine. Every row states the decision an
 * action MUST receive. Rows are grouped by the guarantee they encode, not by
 * implementation detail, so the table survives the engine being rewritten.
 *
 * A row that changes here is a change to what AgentWing promises. That should
 * never happen by accident.
 */

type Row = {
  readonly name: string;
  readonly action: AgentAction;
  readonly decision: AgentWingDecision;
  readonly risk?: AgentWingRisk;
};

const shell = (command: string, extra: Partial<AgentAction> = {}): AgentAction => ({
  actionType: "shell_command",
  tool: "terminal",
  command,
  description: extra.description ?? "Run a shell command.",
  ...extra,
});

const file = (target: string, extra: Partial<AgentAction> = {}): AgentAction => ({
  actionType: "file_access",
  tool: "filesystem",
  target,
  description: extra.description ?? "Access a file.",
  ...extra,
});

// ---------------------------------------------------------------------------
// Guarantee 1 — secrets are never readable
// ---------------------------------------------------------------------------
const secretRows: Row[] = [
  { name: "reads .env", action: file(".env", { metadata: { operation: "read" } }), decision: "block", risk: "high" },
  { name: "reads nested .env", action: file("apps/api/.env", { metadata: { operation: "read" } }), decision: "block" },
  { name: "reads .env.production", action: file(".env.production", { metadata: { operation: "read" } }), decision: "block" },
  { name: "reads a private key", action: file("certs/private_key.pem", { metadata: { operation: "read" } }), decision: "block" },
  { name: "reads credentials.json", action: file("credentials.json", { metadata: { operation: "read" } }), decision: "block" },
  { name: "cat .env via shell", action: shell("cat .env"), decision: "block", risk: "high" },
  // .env.example is a committed template and carries no secret.
  { name: "reads .env.example", action: file(".env.example", { metadata: { operation: "read" } }), decision: "allow" },
];

// ---------------------------------------------------------------------------
// Guarantee 2 — irreversibly destructive commands are blocked outright
// ---------------------------------------------------------------------------
const destructiveRows: Row[] = [
  { name: "rm -rf /", action: shell("rm -rf /"), decision: "block", risk: "critical" },
  { name: "sudo rm -rf /", action: shell("sudo rm -rf /"), decision: "block", risk: "critical" },
  { name: "rm -rf /*", action: shell("rm -rf /*"), decision: "block", risk: "critical" },
  { name: "rm -r -f / (split flags)", action: shell("rm -r -f /"), decision: "block", risk: "critical" },
  { name: "mkfs.ext4", action: shell("mkfs.ext4 /dev/sda1"), decision: "block", risk: "critical" },
  { name: "dd zeroing a disk", action: shell("dd if=/dev/zero of=/dev/sda"), decision: "block", risk: "critical" },
  { name: "shutdown", action: shell("shutdown"), decision: "block", risk: "critical" },
  { name: "reboot now", action: shell("reboot now"), decision: "block", risk: "critical" },
  { name: "windows format", action: shell("format C:"), decision: "block", risk: "critical" },
  { name: "Remove-Item recurse force", action: shell("Remove-Item -Recurse -Force C:\\"), decision: "block", risk: "critical" },
  { name: "prod drop database", action: shell("psql production -c 'drop database app'"), decision: "block", risk: "critical" },
  { name: "force push", action: shell("git push --force origin main"), decision: "block", risk: "high" },
];

// ---------------------------------------------------------------------------
// Guarantee 3 — actions with real-world consequence need a human
// ---------------------------------------------------------------------------
const approvalRows: Row[] = [
  { name: "payment", action: { actionType: "payment_action", tool: "stripe", target: "cus_123", description: "Charge a customer." }, decision: "approval_required", risk: "high" },
  { name: "deploy", action: { actionType: "deploy_action", tool: "deploy", target: "production", description: "Deploy to production." }, decision: "approval_required", risk: "high" },
  { name: "external email", action: { actionType: "message_send", tool: "email", target: "someone@example.com", description: "Email a customer.", metadata: { external: true } }, decision: "approval_required" },
  { name: "spawning an agent", action: { actionType: "agent_spawn", tool: "orchestrator", description: "Spawn a sub-agent." }, decision: "approval_required", risk: "high" },
  { name: "db delete", action: { actionType: "database_operation", tool: "database", command: "DELETE FROM users WHERE id = 1", description: "Delete a row." }, decision: "approval_required", risk: "high" },
];

// ---------------------------------------------------------------------------
// Guarantee 4 — untrusted code runs in a sandbox, never on the host
// ---------------------------------------------------------------------------
const sandboxRows: Row[] = [
  { name: "npm install", action: shell("npm install lodash"), decision: "sandbox_required" },
  { name: "package install", action: { actionType: "package_install", tool: "npm", target: "lodash", command: "npm install lodash", description: "Install a package." }, decision: "sandbox_required" },
  { name: "code execution", action: { actionType: "code_execution", tool: "node", command: "node script.js", description: "Run a script." }, decision: "sandbox_required" },
  { name: "unknown shell command", action: shell("./configure --prefix=/usr/local"), decision: "sandbox_required" },
];

// ---------------------------------------------------------------------------
// Guarantee 5 — mutations are reversible before they happen
// ---------------------------------------------------------------------------
const restorePointRows: Row[] = [
  { name: "file write", action: file("src/index.ts", { metadata: { operation: "write" }, description: "Edit source." }), decision: "restore_point_required" },
  { name: "config change", action: { actionType: "config_change", tool: "filesystem", target: "wrangler.jsonc", description: "Change deploy config." }, decision: "restore_point_required" },
];

// ---------------------------------------------------------------------------
// Guarantee 6 — genuinely read-only work is not obstructed
// ---------------------------------------------------------------------------
const allowRows: Row[] = [
  { name: "pwd", action: shell("pwd"), decision: "allow", risk: "low" },
  { name: "ls", action: shell("ls -la"), decision: "allow", risk: "low" },
  { name: "git status", action: shell("git status"), decision: "allow", risk: "low" },
  { name: "git diff", action: shell("git diff HEAD~1"), decision: "allow", risk: "low" },
  { name: "node --version", action: shell("node --version"), decision: "allow", risk: "low" },
  { name: "read a source file", action: file("src/index.ts", { metadata: { operation: "read" } }), decision: "allow" },
  { name: "select query", action: { actionType: "database_query", tool: "database", command: "SELECT id FROM users LIMIT 10", description: "Read rows." }, decision: "allow", risk: "low" },
];

const table: ReadonlyArray<readonly [string, Row[]]> = [
  ["secrets are never readable", secretRows],
  ["destructive commands are blocked", destructiveRows],
  ["consequential actions need a human", approvalRows],
  ["untrusted code is sandboxed", sandboxRows],
  ["mutations are reversible", restorePointRows],
  ["read-only work is not obstructed", allowRows],
];

describe("policy decision table", () => {
  for (const [guarantee, rows] of table) {
    describe(guarantee, () => {
      for (const row of rows) {
        it(`${row.name} -> ${row.decision}`, () => {
          const result = evaluateAgentAction(row.action);
          expect(result.decision, `expected ${row.decision} for: ${JSON.stringify(row.action)}`).toBe(row.decision);
          if (row.risk) expect(result.risk).toBe(row.risk);
        });
      }
    });
  }
});

describe("engine invariants", () => {
  const everyRow = table.flatMap(([, rows]) => rows);

  it("always returns a decision, a risk, a policy id and feedback", () => {
    for (const row of everyRow) {
      const result = evaluateAgentAction(row.action);
      expect(result.decision, row.name).toBeTruthy();
      expect(result.risk, row.name).toBeTruthy();
      expect(result.policy, row.name).toBeTruthy();
      expect(result.feedback, row.name).toBeTruthy();
    }
  });

  it("is deterministic — the same action always yields the same decision", () => {
    for (const row of everyRow) {
      const a = evaluateAgentAction(row.action);
      const b = evaluateAgentAction(row.action);
      expect(a, row.name).toEqual(b);
    }
  });

  it("is side-effect free — it does not mutate the action it is given", () => {
    for (const row of everyRow) {
      const snapshot = JSON.stringify(row.action);
      evaluateAgentAction(row.action);
      expect(JSON.stringify(row.action), row.name).toBe(snapshot);
    }
  });

  it("handles every declared action type without throwing", () => {
    for (const actionType of actionTypes) {
      expect(() => evaluateAgentAction({ actionType, tool: "x", description: "y" }), actionType).not.toThrow();
    }
  });

  it("never returns a decision outside the declared set", () => {
    const allowed = new Set<AgentWingDecision>([
      "allow",
      "block",
      "approval_required",
      "sandbox_required",
      "restore_point_required",
    ]);
    for (const actionType of actionTypes) {
      const result = evaluateAgentAction({ actionType, tool: "x", description: "y" });
      expect(allowed.has(result.decision), `${actionType} -> ${result.decision}`).toBe(true);
    }
  });
});
