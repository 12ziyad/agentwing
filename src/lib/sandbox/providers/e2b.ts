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

    const result = await sandbox.commands.run(command, { timeoutMs: 60_000 });
    return normalizeResult(result, Date.now() - startedAt, sandbox.sandboxId ?? sandbox.id);
  } catch (error) {
    const commandResult = commandResultFromError(error);
    if (commandResult) {
      return normalizeResult(commandResult, Date.now() - startedAt, sandbox?.sandboxId ?? sandbox?.id);
    }

    if (error instanceof Error) {
      throw new Error(`E2B sandbox execution failed: ${redactE2BSecret(error.message, apiKey, normalizedApiKey)}`);
    }
    throw new Error("E2B sandbox execution failed.");
  } finally {
    await sandbox?.kill().catch(() => undefined);
  }
}
