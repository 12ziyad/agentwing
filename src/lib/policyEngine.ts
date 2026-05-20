import type { AgentAction, AgentWingDecision } from "./types";

function isSourcePath(path = "") {
  return path.startsWith("src/");
}

export function evaluateAction(action: AgentAction): AgentWingDecision {
  const target = action.target ?? "";
  const command = action.command?.trim() ?? "";

  if (action.type === "readFile" && (target === ".env" || target.endsWith("/.env"))) {
    return {
      decision: "blocked",
      risk: "high",
      reason: "Direct secret access is blocked before file contents are exposed.",
      policy_triggered: "block-secret-access",
      suggested_next_action: "Use .env.example instead.",
    };
  }

  if (action.type === "runCommand" && /\bcat\s+\.env\b/.test(command)) {
    return {
      decision: "blocked",
      risk: "high",
      reason: "Terminal command attempts to print environment secrets.",
      policy_triggered: "block-secret-access",
      suggested_next_action: "Use .env.example instead.",
    };
  }

  if (action.type === "runCommand" && /^git\s+push\s+--force\b/.test(command)) {
    return {
      decision: "blocked",
      risk: "high",
      reason: "Force pushes to protected branches are blocked.",
      policy_triggered: "block-force-push",
      suggested_next_action: "Create a feature branch and open a PR instead.",
    };
  }

  if (action.type === "runCommand" && command === "npm test") {
    return {
      decision: "sandbox_required",
      risk: "medium",
      reason: "Command execution should run in isolated sandbox first.",
      fidelity: {
        score: 0.85,
        reason: "Executed in isolated E2B sandbox",
      },
    };
  }

  if (action.type === "runCommand" && /^git\s+checkout\s+-b\b/.test(command)) {
    return {
      decision: "allowed",
      risk: "low",
      reason: "Creating a feature branch is safe.",
    };
  }

  if (action.type === "readFile" && isSourcePath(target)) {
    return {
      decision: "allowed",
      risk: "low",
      reason: "Reading source file is safe.",
    };
  }

  if (action.type === "readFile" && target === ".env.example") {
    return {
      decision: "allowed",
      risk: "low",
      reason: "Reading example environment placeholders is safe.",
    };
  }

  if (action.type === "writeFile" && isSourcePath(target)) {
    return {
      decision: "allowed",
      risk: "medium",
      checkpoint: true,
      reason: "Source file edit allowed. Checkpoint created before change.",
    };
  }

  if (action.type === "finish") {
    return {
      decision: "allowed",
      risk: "low",
      reason: "Agent completed with policy outcomes recorded.",
    };
  }

  return {
    decision: "needs_approval",
    risk: "medium",
    reason: "Action is outside the prototype allowlist and requires review.",
  };
}
