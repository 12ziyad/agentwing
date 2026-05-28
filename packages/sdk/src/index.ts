export type UniversalActionType =
  | "file_access"
  | "shell_command"
  | "api_call"
  | "network_request"
  | "browser_action"
  | "database_query"
  | "database_operation"
  | "message_send"
  | "payment_action"
  | "deploy_action"
  | "git_operation"
  | "package_install"
  | "code_execution"
  | "config_change"
  | "agent_spawn"
  | "custom_action";

export type AgentWingDecision =
  | "allow"
  | "block"
  | "approval_required"
  | "sandbox_required"
  | "restore_point_required";

export type AgentAction = {
  projectId?: string;
  sessionId?: string;
  agentId?: string;
  actionType: UniversalActionType;
  tool?: string;
  target?: string;
  command?: string;
  description?: string;
  metadata?: Record<string, unknown>;
};

export type CheckActionResult = {
  decision: AgentWingDecision;
  risk: "low" | "medium" | "high" | "critical";
  policy: string;
  feedback: string;
  receiptId: string;
  nextStep?: string;
  approvalId?: string;
};

export type ActionRunStatus =
  | "proposed"
  | "checked"
  | "blocked"
  | "waiting_approval"
  | "approved"
  | "rejected"
  | "waiting_sandbox"
  | "running"
  | "completed"
  | "failed"
  | "restore_point_required"
  | "checkpoint_created"
  | "execution_skipped"
  | "external_runner_required";

export type ExecutionTarget = "none" | "sandbox" | "local_runner" | "external_runner" | "skipped";

export type ActionRun = {
  runId: string;
  receiptId?: string;
  approvalId?: string;
  action: AgentAction;
  decision: AgentWingDecision;
  risk: "low" | "medium" | "high" | "critical";
  policy: string;
  feedback?: string;
  nextStep?: string;
  status: ActionRunStatus;
  executionTarget: ExecutionTarget;
  stdout?: string;
  stderr?: string;
  exitCode?: number;
  errorMessage?: string;
  durationMs?: number;
};

export type RuntimeApprovalSurface = "cli" | "ide" | "web" | "webhook";

export type RunnerApproval = {
  approvalId?: string;
  approvalUrl: string;
  surface: "dashboard_and_runner";
  runnerApprovalToken: string;
  expiresAt: string;
  approveEndpoint: string;
  rejectEndpoint: string;
};

export type ApprovalDecision = "approve" | "reject";

export type ApprovalDecisionResult =
  | ApprovalDecision
  | { decision: ApprovalDecision; reason?: string };

export type AgentWingOptions = {
  apiKey: string;
  baseUrl?: string;
  fetch?: typeof fetch;
};

export type GuardActionOptions<T> = {
  action: AgentAction;
  execute: () => Promise<T> | T;
};

export type ExecuteActionOptions<T = unknown> = {
  pollIntervalMs?: number;
  maxWaitMs?: number;
  createRestorePoint?: (run: ActionRun) => Promise<void> | void;
  localRunner?: (run: ActionRun) => Promise<T> | T;
  serializeLocalResult?: (result: T) => {
    stdout?: string;
    stderr?: string;
    exitCode?: number;
    durationMs?: number;
    error?: string;
  };
  runtime?: {
    surface: RuntimeApprovalSurface;
    interactiveApproval?: boolean;
    runnerId?: string;
    approvalTimeoutMs?: number;
    onApprovalRequired?: (ctx: {
      run: ActionRun;
      approval: RunnerApproval;
    }) =>
      | Promise<ApprovalDecisionResult>
      | ApprovalDecisionResult;
  };
};

export type ExecuteActionResult<T = unknown> = {
  run: ActionRun;
  localResult?: T;
  timedOut?: boolean;
};

export class AgentWingError extends Error {
  readonly code: string;

  constructor(message: string, code: string) {
    super(message);
    this.name = "AgentWingError";
    this.code = code;
  }
}

export class AgentWing {
  private readonly apiKey: string;
  private readonly baseUrl: string;
  private readonly fetcher: typeof fetch;

  constructor(options: AgentWingOptions) {
    if (!options.apiKey) {
      throw new Error("AgentWing requires an apiKey.");
    }

    this.apiKey = options.apiKey;
    this.baseUrl = (options.baseUrl ?? "https://agentwing.gpmai.dev").replace(/\/$/, "");
    this.fetcher = options.fetch ?? fetch;
  }

  async checkAction(action: AgentAction): Promise<CheckActionResult> {
    const response = await this.fetcher(`${this.baseUrl}/api/v1/check-action`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify(action),
    });

    if (!response.ok) {
      const data = await response.json().catch(() => ({})) as { error?: string; code?: string };
      throw new AgentWingError(
        data.error ?? `AgentWing checkAction failed with ${response.status}`,
        data.code ?? "request_failed",
      );
    }

    return response.json() as Promise<CheckActionResult>;
  }

  async getActionRun(runId: string): Promise<ActionRun> {
    const response = await this.fetcher(`${this.baseUrl}/api/v1/action-runs/${runId}`, {
      headers: { Authorization: `Bearer ${this.apiKey}` },
    });

    if (!response.ok) {
      const data = await response.json().catch(() => ({})) as { error?: string; code?: string };
      throw new AgentWingError(
        data.error ?? `AgentWing getActionRun failed with ${response.status}`,
        data.code ?? "request_failed",
      );
    }

    const data = (await response.json()) as { run: ActionRun };
    return data.run;
  }

  async continueActionRun(
    runId: string,
    body: Record<string, unknown>,
  ): Promise<ActionRun> {
    const response = await this.fetcher(`${this.baseUrl}/api/v1/action-runs/${runId}/continue`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const data = await response.json().catch(() => ({})) as { error?: string; code?: string };
      throw new AgentWingError(
        data.error ?? `AgentWing continueActionRun failed with ${response.status}`,
        data.code ?? "request_failed",
      );
    }

    const data = (await response.json()) as { run: ActionRun };
    return data.run;
  }

  private async postRunnerDecision(
    endpoint: string,
    runnerApprovalToken: string,
    reason?: string,
  ): Promise<ActionRun> {
    const response = await this.fetcher(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${runnerApprovalToken}`,
      },
      body: JSON.stringify(reason ? { reason } : {}),
    });

    if (!response.ok) {
      const data = await response.json().catch(() => ({})) as { error?: string; code?: string };
      throw new AgentWingError(
        data.error ?? `Runner decision failed with ${response.status}`,
        data.code ?? "runner_decision_failed",
      );
    }

    const data = (await response.json()) as { run: ActionRun };
    return data.run;
  }

  async executeAction<T = unknown>(
    action: AgentAction,
    options: ExecuteActionOptions<T> = {},
  ): Promise<ExecuteActionResult<T>> {
    const runtimeOpts = options.runtime;

    // Build the request body — include runtime block only when configured
    const requestBody: Record<string, unknown> = { ...action };
    if (runtimeOpts) {
      requestBody.runtime = {
        surface: runtimeOpts.surface,
        interactiveApproval: true,
        ...(runtimeOpts.runnerId ? { runnerId: runtimeOpts.runnerId } : {}),
      };
    }

    const response = await this.fetcher(`${this.baseUrl}/api/v1/execute-action`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      const data = await response.json().catch(() => ({})) as { error?: string; code?: string };
      throw new AgentWingError(
        data.error ?? `AgentWing executeAction failed with ${response.status}`,
        data.code ?? "request_failed",
      );
    }

    const data = (await response.json()) as {
      run: ActionRun;
      approval?: RunnerApproval;
    };
    let run = data.run;

    // Interactive approval path: onApprovalRequired callback provided
    if (
      run.status === "waiting_approval" &&
      data.approval &&
      runtimeOpts?.onApprovalRequired
    ) {
      const approvalTimeoutMs = runtimeOpts.approvalTimeoutMs ?? 5 * 60 * 1000;
      const approvalDeadline = Date.now() + approvalTimeoutMs;

      let decisionResult: ApprovalDecisionResult;
      try {
        const callbackPromise = Promise.resolve(
          runtimeOpts.onApprovalRequired({ run, approval: data.approval }),
        );
        const timeoutPromise = new Promise<never>((_, reject) =>
          setTimeout(() => reject(new AgentWingError("Approval timed out.", "approval_timeout")), approvalTimeoutMs),
        );
        decisionResult = await Promise.race([callbackPromise, timeoutPromise]);
      } catch (err) {
        if (err instanceof AgentWingError && err.code === "approval_timeout") {
          return { run, timedOut: true };
        }
        throw err;
      }

      void approvalDeadline;

      const decision =
        typeof decisionResult === "string" ? decisionResult : decisionResult.decision;
      const reason =
        typeof decisionResult === "object" ? decisionResult.reason : undefined;

      const endpoint =
        decision === "approve"
          ? data.approval.approveEndpoint
          : data.approval.rejectEndpoint;

      run = await this.postRunnerDecision(endpoint, data.approval.runnerApprovalToken, reason);
      return { run };
    }

    // Legacy polling path: waiting_approval but no onApprovalRequired
    if (run.status === "waiting_approval") {
      run = await this.pollRun(
        run.runId,
        options.pollIntervalMs,
        options.maxWaitMs,
      );
      if (run.status === "rejected") return { run };
    }

    if (run.status === "waiting_sandbox") {
      return { run };
    }

    if (run.status === "restore_point_required") {
      if (!options.createRestorePoint) return { run };
      await options.createRestorePoint(run);
      run = await this.continueActionRun(run.runId, { restorePointCreated: true });
    }

    if (run.status === "external_runner_required" || run.status === "checkpoint_created") {
      if (!options.localRunner) return { run };
      const startedAt = Date.now();
      try {
        const localResult = await options.localRunner(run);
        const serialized = options.serializeLocalResult
          ? options.serializeLocalResult(localResult)
          : { stdout: "", stderr: "", exitCode: 0, durationMs: Date.now() - startedAt };
        run = await this.continueActionRun(run.runId, {
          executionTarget: "local_runner",
          executionResult: serialized,
        });
        return { run, localResult };
      } catch (error) {
        run = await this.continueActionRun(run.runId, {
          executionTarget: "local_runner",
          executionResult: {
            stdout: "",
            stderr: "",
            exitCode: 1,
            durationMs: Date.now() - startedAt,
            error: error instanceof Error ? error.message : "Local runner failed.",
          },
        });
        return { run };
      }
    }

    return { run };
  }

  private async pollRun(runId: string, pollIntervalMs = 3000, maxWaitMs = 10 * 60 * 1000): Promise<ActionRun> {
    const deadline = Date.now() + maxWaitMs;
    let run = await this.getActionRun(runId);

    while (run.status === "waiting_approval" || run.status === "approved" || run.status === "running") {
      if (Date.now() > deadline) return run;
      await new Promise((resolve) => setTimeout(resolve, pollIntervalMs));
      run = await this.getActionRun(runId);
    }

    return run;
  }

  async guardAction<T>({ action, execute }: GuardActionOptions<T>): Promise<T> {
    const result = await this.checkAction(action);

    if (result.decision !== "allow") {
      throw new AgentWingGuardError(result);
    }

    return execute();
  }
}

export class AgentWingGuardError extends Error {
  readonly result: CheckActionResult;

  constructor(result: CheckActionResult) {
    super(`AgentWing blocked execution: ${result.decision}`);
    this.name = "AgentWingGuardError";
    this.result = result;
  }
}
