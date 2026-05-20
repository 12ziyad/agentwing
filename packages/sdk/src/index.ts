export type UniversalActionType =
  | "file_access"
  | "shell_command"
  | "api_call"
  | "browser_action"
  | "database_query"
  | "message_send"
  | "payment_action"
  | "deploy_action"
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
  risk: "low" | "medium" | "high";
  policy: string;
  feedback: string;
  receiptId: string;
};

export type AgentWingOptions = {
  apiKey: string;
  baseUrl?: string;
  fetch?: typeof fetch;
};

export type GuardActionOptions<T> = {
  action: AgentAction;
  execute: () => Promise<T> | T;
};

export class AgentWing {
  private readonly apiKey: string;
  private readonly baseUrl: string;
  private readonly fetcher: typeof fetch;

  constructor(options: AgentWingOptions) {
    if (!options.apiKey) {
      throw new Error("AgentWing requires an apiKey.");
    }

    this.apiKey = options.apiKey;
    this.baseUrl = (options.baseUrl ?? "https://api.agentwing.dev").replace(/\/$/, "");
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
      throw new Error(`AgentWing checkAction failed with ${response.status}`);
    }

    return response.json() as Promise<CheckActionResult>;
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
