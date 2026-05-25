import type { AgentAction } from "@/lib/agentwingTypes";

type CommandResultLike = {
  stdout?: string;
  stderr?: string;
  exitCode?: number;
  error?: string;
};

type E2BSandboxInstance = {
  sandboxId?: string;
  id?: string;
  commands: {
    run: (command: string, opts?: { cwd?: string; timeoutMs?: number }) => Promise<CommandResultLike>;
  };
  kill: () => Promise<void>;
};

type E2BSandboxCreateOptions = {
  apiKey?: string;
  timeoutMs?: number;
  metadata?: Record<string, string>;
};

type E2BModule = {
  Sandbox: {
    create: (opts?: E2BSandboxCreateOptions) => Promise<E2BSandboxInstance>;
  };
};

export type E2BSandboxRunInput = {
  apiKey: string;
  command: string;
  action: AgentAction;
  projectId?: string;
  sessionId?: string;
};

export type E2BSandboxRunResult = {
  stdout: string;
  stderr: string;
  exitCode: number;
  durationMs: number;
  sandboxId?: string;
  error?: string;
};

type E2BExecutionPhase = "sandbox creation" | "command execution";

type ErrorLike = {
  name?: unknown;
  message?: unknown;
  code?: unknown;
  errno?: unknown;
  syscall?: unknown;
  hostname?: unknown;
  cause?: unknown;
};

function normalizeE2BApiKey(apiKey: string) {
  let normalized = apiKey.trim().replace(/^['"]|['"]$/g, "");

  for (const pattern of [
    /^authorization\s*:\s*bearer\s+/i,
    /^authorization\s*=\s*bearer\s+/i,
    /^bearer\s+/i,
    /^x-api-key\s*:\s*/i,
    /^x-api-key\s*=\s*/i,
    /^e2b_api_key\s*=\s*/i,
  ]) {
    normalized = normalized.replace(pattern, "").trim().replace(/^['"]|['"]$/g, "");
  }

  if (!normalized || /\s/.test(normalized)) {
    throw new Error("E2B API key is malformed. Save the raw E2B API key without Authorization, Bearer, or header prefixes.");
  }

  return normalized;
}

function redactE2BSecret(message: string, rawApiKey: string, normalizedApiKey: string) {
  let redacted = message;
  for (const secret of [rawApiKey.trim(), normalizedApiKey]) {
    if (secret) redacted = redacted.split(secret).join("[redacted]");
  }
  return redacted.replace(/e2b_[A-Za-z0-9._-]+/g, "e2b_[redacted]");
}

function errorLike(error: unknown): ErrorLike | undefined {
  return error && typeof error === "object" ? (error as ErrorLike) : undefined;
}

function stringValue(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function errorCauseDetails(error: unknown) {
  const details: string[] = [];
  let current = errorLike(error)?.cause;
  const seen = new Set<unknown>();

  while (current && !seen.has(current)) {
    seen.add(current);
    const cause = errorLike(current);
    if (!cause) break;

    const code = stringValue(cause.code);
    const syscall = stringValue(cause.syscall);
    const hostname = stringValue(cause.hostname);
    const name = stringValue(cause.name);
    const message = stringValue(cause.message);

    if (code) details.push(`code=${code}`);
    if (syscall) details.push(`syscall=${syscall}`);
    if (hostname) details.push(`host=${hostname}`);
    if (!code && !syscall && !hostname && name && message) details.push(`${name}: ${message}`);

    current = cause.cause;
  }

  return details.length ? ` (${Array.from(new Set(details)).join(", ")})` : "";
}

function describeE2BError(
  error: Error,
  phase: E2BExecutionPhase,
  rawApiKey: string,
  normalizedApiKey: string,
) {
  const message = redactE2BSecret(error.message, rawApiKey, normalizedApiKey);
  const cause = redactE2BSecret(errorCauseDetails(error), rawApiKey, normalizedApiKey);
  const fetchHint =
    message.toLowerCase() === "fetch failed"
      ? "network fetch failed while contacting E2B"
      : message;

  return `E2B sandbox execution failed during ${phase}: ${fetchHint}${cause}`;
}

async function createSandboxWithApiKeyOnly(
  Sandbox: E2BModule["Sandbox"],
  opts: E2BSandboxCreateOptions,
): Promise<E2BSandboxInstance> {
  const hadAccessToken = Object.prototype.hasOwnProperty.call(process.env, "E2B_ACCESS_TOKEN");
  const previousAccessToken = process.env.E2B_ACCESS_TOKEN;

  process.env.E2B_ACCESS_TOKEN = "";
  try {
    return await Sandbox.create(opts);
  } finally {
    if (hadAccessToken) {
      process.env.E2B_ACCESS_TOKEN = previousAccessToken;
    } else {
      delete process.env.E2B_ACCESS_TOKEN;
    }
  }
}

function commandResultFromError(error: unknown): CommandResultLike | undefined {
  if (!error || typeof error !== "object") return undefined;
  const candidate = error as CommandResultLike;
  if (
    typeof candidate.exitCode === "number" ||
    typeof candidate.stdout === "string" ||
    typeof candidate.stderr === "string"
  ) {
    return candidate;
  }
  return undefined;
}

function normalizeResult(result: CommandResultLike, durationMs: number, sandboxId?: string): E2BSandboxRunResult {
  return {
    stdout: result.stdout ?? "",
    stderr: result.stderr ?? "",
    exitCode: typeof result.exitCode === "number" ? result.exitCode : result.error ? 1 : 0,
    durationMs,
    sandboxId,
    error: result.error,
  };
}

export async function runE2BSandbox({
  apiKey,
  command,
  action,
  projectId,
  sessionId,
}: E2BSandboxRunInput): Promise<E2BSandboxRunResult> {
  const startedAt = Date.now();
  let sandbox: E2BSandboxInstance | undefined;
  let phase: E2BExecutionPhase = "sandbox creation";
  const normalizedApiKey = normalizeE2BApiKey(apiKey);

  try {
    const { Sandbox } = (await import(/* webpackIgnore: true */ "@e2b/code-interpreter")) as E2BModule;
    sandbox = await createSandboxWithApiKeyOnly(Sandbox, {
      apiKey: normalizedApiKey,
      timeoutMs: 120_000,
      metadata: {
        app: "agentwing",
        projectId: projectId ?? action.projectId ?? "unknown",
        sessionId: sessionId ?? action.sessionId ?? "unknown",
        actionType: action.actionType,
      },
    });

    phase = "command execution";
    const result = await sandbox.commands.run(command, { timeoutMs: 60_000 });
    return normalizeResult(result, Date.now() - startedAt, sandbox.sandboxId ?? sandbox.id);
  } catch (error) {
    const commandResult = commandResultFromError(error);
    if (commandResult) {
      return normalizeResult(commandResult, Date.now() - startedAt, sandbox?.sandboxId ?? sandbox?.id);
    }

    if (error instanceof Error) {
      throw new Error(describeE2BError(error, phase, apiKey, normalizedApiKey));
    }
    throw new Error("E2B sandbox execution failed.");
  } finally {
    await sandbox?.kill().catch(() => undefined);
  }
}
