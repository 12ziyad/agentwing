export type ProjectFiles = Record<string, string>;

export type ActionType = "readFile" | "writeFile" | "runCommand" | "finish";

export type AgentAction = {
  type: ActionType;
  target?: string;
  command?: string;
  content?: string;
};

export type AgentWingDecision = {
  decision: "allowed" | "blocked" | "sandbox_required" | "needs_approval";
  risk: "low" | "medium" | "high";
  reason: string;
  policy_triggered?: string;
  suggested_next_action?: string;
  checkpoint?: boolean;
  fidelity?: {
    score: number;
    reason: string;
  };
};

export type TimelineKind =
  | "action"
  | "allowed"
  | "blocked"
  | "sandbox"
  | "checkpoint"
  | "replan"
  | "finish"
  | "failed"
  | "committed"
  | "verified";

export type TimelineEvent = {
  id: string;
  timestamp: string;
  kind: TimelineKind;
  action: ActionType | "plan" | "replan" | "sandboxResult";
  target?: string;
  command?: string;
  decision?: AgentWingDecision["decision"];
  risk?: AgentWingDecision["risk"];
  reason: string;
  policy_triggered?: string;
  feedback?: AgentWingDecision;
};

export type DiffLine = {
  type: "added" | "removed" | "context";
  value: string;
  oldLine?: number;
  newLine?: number;
};

export type LatestDiff = {
  path: string;
  before: string;
  after: string;
  lines: DiffLine[];
};

export type SandboxResult = {
  ok: boolean;
  stdout: string;
  stderr: string;
  exitCode: number;
  durationMs?: number;
  fidelity?: {
    score: number;
    reason: string;
  };
  error?: string;
};

export type MetricTone = "default" | "success" | "warning" | "danger";
export type StatusColor = "green" | "blue" | "red" | "yellow";
export type ButtonSize = "sm" | "md" | "lg";
export type CardsRounded = "md" | "lg" | "xl" | "2xl";

export type PreviewMetric = {
  label: string;
  value: string;
  tone?: MetricTone;
  badge?: string;
};

export type SecondaryButton = {
  text: string;
  visible: boolean;
};

export type PreviewModel = {
  title: string;
  subtitle: string;
  eyebrow: string;
  showStatusPill: boolean;
  statusText: string;
  statusColor: StatusColor;
  metrics: PreviewMetric[];
  primaryButton: {
    text: string;
    size: ButtonSize;
    visible: boolean;
  };
  secondaryButtons: SecondaryButton[];
  cardsRounded: CardsRounded;
  activityItems: string[];
};

export type ChangeHistoryEntry = {
  id: string;
  timestamp: string;
  summary: string;
};

export type RepairContext = {
  verifierReason: string;
  previousModel: PreviewModel;
  failedModel: PreviewModel;
  task: string;
  instruction: string;
};

export type AgentPlan = {
  ok: true;
  mode: "llm";
  updatedModel: PreviewModel;
  changedFiles: { "src/App.jsx": string; "src/styles.css": string };
  explanation: string;
  summary: string;
  affectedElements?: string[];
  modelUsed?: string;
};

export type AgentPlanFailure = {
  ok: false;
  mode: "fallback";
  error: string;
};

export type PlannerStatus = "idle" | "planning" | "llm" | "fallback";

export type SessionSummary = {
  allowed: number;
  sandboxed: number;
  blocked: number;
  replans: number;
  checkpoints: number;
  fidelityScore: number;
  finished: boolean;
};

export type AgentCallbacks = {
  getFiles: () => ProjectFiles;
  setFiles: (updater: (files: ProjectFiles) => ProjectFiles) => void;
  getPreviewModel: () => PreviewModel;
  setPreviewModel: (model: PreviewModel) => void;
  getCommittedModel: () => PreviewModel;
  commitChange: (model: PreviewModel, files: ProjectFiles, summary: string) => void;
  getChangeHistory: () => ChangeHistoryEntry[];
  addEvent: (event: Omit<TimelineEvent, "id" | "timestamp">) => void;
  setFeedback: (decision: AgentWingDecision) => void;
  setLatestDiff: (diff: LatestDiff) => void;
  addTerminalLine: (line: string) => void;
  setSelectedFile: (path: string) => void;
  runSandbox: (command: string, files: ProjectFiles) => Promise<SandboxResult>;
  planEdit: (
    task: string,
    files: ProjectFiles,
    previewModel: PreviewModel,
    changeHistory?: ChangeHistoryEntry[],
    repairContext?: RepairContext,
  ) => Promise<AgentPlan>;
};
