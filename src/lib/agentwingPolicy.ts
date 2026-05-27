import type { AgentAction, PolicyEvaluation } from "./agentwingTypes";

const SAFE_READ_COMMANDS = [
  /^pwd$/,
  /^ls(\s|$)/,
  /^dir(\s|$)/,
  /^git\s+status\b/,
  /^git\s+diff\b/,
  /^git\s+log\b/,
  /^git\s+show\b/,
  /^npm\s+--version$/,
  /^node\s+--version$/,
  /^cat\s+(?!.*(^|\s)\.env(\s|$))/,
  /^type\s+(?!.*(^|\s)\.env(\s|$))/,
  /^Get-Content\s+(?!.*(^|\s)\.env(\s|$))/i,
];

function text(action: AgentAction) {
  return [
    action.tool,
    action.target,
    action.command,
    action.description,
    JSON.stringify(action.metadata ?? {}),
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

function metadataString(action: AgentAction, key: string) {
  const value = action.metadata?.[key];
  return typeof value === "string" ? value.toLowerCase() : "";
}

function isSecretPath(value: string) {
  if (/(^|[/\\])\.env\.example$/i.test(value)) return false;
  return /(^|[/\\])\.env($|[./\\])|secret|private[_-]?key|credentials/i.test(value);
}

function isFileWrite(action: AgentAction) {
  const operation = metadataString(action, "operation");
  const mode = metadataString(action, "mode");
  const verb = metadataString(action, "verb");
  const combined = text(action);

  return (
    action.actionType === "file_access" &&
    (operation === "write" ||
      operation === "edit" ||
      mode === "write" ||
      verb === "write" ||
      /\b(write|edit|modify|delete|remove|create)\b/.test(combined))
  );
}

function isExternalMessage(action: AgentAction) {
  if (action.actionType !== "message_send") return false;
  if (action.metadata?.external === true) return true;

  const target = (action.target ?? "").toLowerCase();
  const channel = metadataString(action, "channel");
  return (
    target.includes("@") ||
    target.includes("external") ||
    channel === "email" ||
    channel === "slack_external"
  );
}

function shellCommand(action: AgentAction) {
  return (action.command ?? action.target ?? "").trim();
}

function commandSegments(command: string) {
  return command
    .replace(/[`"']/g, "")
    .split(/\s*(?:&&|\|\||[;|])\s*/)
    .map((segment) => segment.trim())
    .filter(Boolean);
}

function isRootRecursiveForceRm(segment: string) {
  const tokens = segment.split(/\s+/).filter(Boolean);
  if (tokens[0]?.toLowerCase() === "sudo") tokens.shift();
  if (tokens[0]?.toLowerCase() !== "rm") return false;

  const args = tokens.slice(1);
  const optionLetters = args
    .filter((arg) => arg.startsWith("-") && arg !== "--")
    .join("")
    .toLowerCase();
  const hasRecursiveForce = optionLetters.includes("r") && optionLetters.includes("f");
  const targets = args.filter((arg) => !arg.startsWith("-") || arg === "/");

  return hasRecursiveForce && targets.some((target) => target === "/" || target === "/*");
}

function isDestructiveShellCommand(action: AgentAction) {
  const command = shellCommand(action);
  const normalized = command.replace(/[`"']/g, "").replace(/\s+/g, " ").trim();
  const lower = normalized.toLowerCase();
  const segments = commandSegments(command);

  if (segments.some(isRootRecursiveForceRm)) return true;
  if (/\bdel\s+(?:\/[a-z]\s+)*[a-z]:\\?(?:\s|$)/i.test(normalized)) return true;
  if (/\bremove-item\b(?=.*\b-recurse\b)(?=.*\b-force\b)(?=.*\b[a-z]:\\?(?:\s|$))/i.test(normalized)) return true;
  if (/\bformat\s+[a-z]:/i.test(normalized)) return true;
  if (/(?:^|\s)(?:sudo\s+)?mkfs(?:\.[a-z0-9_+-]+)?\b/i.test(normalized)) return true;
  if (/(?:^|\s)(?:sudo\s+)?dd\b(?=.*\bif=\/dev\/zero\b)/i.test(normalized)) return true;
  if (/(?:^|\s)(?:sudo\s+)?(?:shutdown|reboot|halt|poweroff)\b/i.test(normalized)) return true;
  if (/\b(?:stop-computer|restart-computer)\b/i.test(normalized)) return true;

  const productionDatabaseMutation =
    /\b(prod|production)\b/i.test(normalized) &&
    /\b(drop\s+database|drop\s+schema|truncate\s+table|delete\s+from|prisma\s+migrate\s+reset|db:reset|db:drop|rails\s+db:drop)\b/i.test(normalized);
  if (productionDatabaseMutation) return true;

  return lower === "shutdown" || lower === "reboot";
}

export function evaluateAgentAction(action: AgentAction): PolicyEvaluation {
  const command = shellCommand(action);
  const combined = text(action);

  if (action.actionType === "file_access" && isSecretPath(action.target ?? "")) {
    return {
      decision: "block",
      risk: "high",
      policy: "block-secret-file-access",
      feedback: "Secret-bearing files such as .env are blocked before contents can be exposed.",
    };
  }

  if (action.actionType === "shell_command" && /\b(cat|type|Get-Content)\s+.*\.env\b/i.test(command)) {
    return {
      decision: "block",
      risk: "high",
      policy: "block-secret-file-access",
      feedback: "Commands that print secret files are blocked. Use an example file or a scoped secret reference.",
    };
  }

  if (action.actionType === "shell_command" && isDestructiveShellCommand(action)) {
    return {
      decision: "block",
      risk: "critical",
      policy: "block-destructive-shell-command",
      feedback: "Destructive system-level shell commands are blocked before sandbox routing. Stop and re-plan with a safe, scoped alternative.",
    };
  }

  if (action.actionType === "shell_command" && /\bgit\s+push\b.*--force(?:\b|=)/i.test(command)) {
    return {
      decision: "block",
      risk: "high",
      policy: "block-force-push",
      feedback: "Force pushes are blocked. Create a branch and route the change through review.",
    };
  }

  if (isExternalMessage(action)) {
    return {
      decision: "approval_required",
      risk: "medium",
      policy: "approval-external-message",
      feedback: "External messages require human approval before delivery.",
    };
  }

  if (action.actionType === "payment_action") {
    return {
      decision: "approval_required",
      risk: "high",
      policy: "approval-payment-action",
      feedback: "Payment actions require explicit approval before execution.",
    };
  }

  if (action.actionType === "deploy_action") {
    return {
      decision: "approval_required",
      risk: "high",
      policy: "approval-deploy-action",
      feedback: "Deploy actions require human approval before execution.",
    };
  }

  if ((action.actionType === "database_query" || action.actionType === "database_operation") && /\b(drop|truncate)\b/i.test(command || combined)) {
    return {
      decision: "block",
      risk: "high",
      policy: "block-destructive-database-query",
      feedback: "DROP and TRUNCATE operations are blocked by the default database policy.",
    };
  }

  if ((action.actionType === "database_query" || action.actionType === "database_operation") && /\b(delete|update|alter)\b/i.test(command || combined)) {
    return {
      decision: "approval_required",
      risk: "high",
      policy: "approval-destructive-database-query",
      feedback: "Destructive database mutations require approval and a rollback plan.",
    };
  }

  if (isFileWrite(action)) {
    return {
      decision: "restore_point_required",
      risk: "medium",
      policy: "restore-point-file-write",
      feedback: "Create a restore point before the agent writes or modifies files.",
    };
  }

  if (action.actionType === "shell_command" && /^npm\s+(test|install)\b/i.test(command)) {
    return {
      decision: "sandbox_required",
      risk: "medium",
      policy: "sandbox-node-command",
      feedback: "Run npm commands in a sandbox before allowing effects in the working environment.",
      provider: "e2b-byok",
    };
  }

  if (action.actionType === "shell_command" && SAFE_READ_COMMANDS.some((pattern) => pattern.test(command))) {
    return {
      decision: "allow",
      risk: "low",
      policy: "allow-read-only-shell",
      feedback: "Read-only shell action allowed.",
    };
  }

  if (action.actionType === "shell_command") {
    return {
      decision: "sandbox_required",
      risk: "medium",
      policy: "sandbox-unknown-shell-command",
      feedback: "Unknown shell commands must run in a sandbox first.",
      provider: "e2b-byok",
    };
  }

  if ((action.actionType === "database_query" || action.actionType === "database_operation") && /^\s*select\b/i.test(command || (action.description ?? ""))) {
    return {
      decision: "allow",
      risk: "low",
      policy: "allow-read-only-database-query",
      feedback: "Read-only database query allowed.",
    };
  }

  if ((action.actionType === "database_query" || action.actionType === "database_operation") && /\b(drop|truncate)\b/i.test(command || combined)) {
    return {
      decision: "block",
      risk: "high",
      policy: "block-destructive-database-operation",
      feedback: "DROP and TRUNCATE operations are blocked by the default database policy.",
    };
  }

  if (action.actionType === "git_operation") {
    if (/\b(push\s+.*--force|force[_-]?push)\b/i.test(command || combined)) {
      return { decision: "block", risk: "high", policy: "block-force-push", feedback: "Force pushes are blocked. Use a PR." };
    }
    return { decision: "allow", risk: "low", policy: "allow-git-operation", feedback: "Git operation allowed." };
  }

  if (action.actionType === "package_install") {
    return {
      decision: "sandbox_required",
      risk: "medium",
      policy: "sandbox-package-install",
      feedback: "Package installs must run in a sandbox first to check for supply chain issues.",
      provider: "e2b-byok",
    };
  }

  if (action.actionType === "code_execution") {
    return {
      decision: "sandbox_required",
      risk: "medium",
      policy: "sandbox-code-execution",
      feedback: "Arbitrary code execution must run in a sandbox first.",
      provider: "e2b-byok",
    };
  }

  if (action.actionType === "config_change") {
    return {
      decision: "restore_point_required",
      risk: "medium",
      policy: "restore-point-config-change",
      feedback: "Create a restore point before modifying configuration files.",
    };
  }

  if (action.actionType === "agent_spawn") {
    return {
      decision: "approval_required",
      risk: "high",
      policy: "approval-agent-spawn",
      feedback: "Spawning sub-agents requires human approval.",
    };
  }

  if (action.actionType === "api_call" || action.actionType === "network_request") {
    if (/(^|\s)(get|head|options)(\s|$)/i.test(combined)) {
      return { decision: "allow", risk: "low", policy: "allow-read-only-api-call", feedback: "Read-only API call allowed." };
    }
    return { decision: "allow", risk: "low", policy: "allow-api-call", feedback: "API call allowed." };
  }

  if (action.actionType === "file_access") {
    return {
      decision: "allow",
      risk: "low",
      policy: "allow-read-only-file-access",
      feedback: "Read-only file access allowed.",
    };
  }

  return {
    decision: "allow",
    risk: "low",
    policy: "allow-default-low-risk",
    feedback: "No default policy blocked this action.",
  };
}
