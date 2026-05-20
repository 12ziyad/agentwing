export type WispState = "idle" | "checking" | "blocked" | "sandboxing" | "approved" | "rollback";

export type TxStatus = "blocked" | "restore" | "sandboxed" | "approval" | "approved";

export type WithoutLine = {
  id: string;
  timestamp: string;
  kind: "info" | "warn" | "bad";
  text: string;
};

export type Transaction = {
  id: string;
  action: string;
  toolCall: object;
  status: TxStatus;
  policy: string;
  risk?: "low" | "medium" | "high";
  meta: string[];
  feedback?: string;
  receiptId?: string;
  terminalLines: string[];
  approvalState?: "pending" | "approved" | "denied";
};

export type PlanLine = {
  id: string;
  text: string;
  struck: boolean;
  isReplacement?: boolean;
};

export type RestorePoint = {
  id: string;
  desc: string;
  current: boolean;
};

export type FeedbackContractData = {
  tx_id: string;
  risk_score: number;
  policy_reason: string;
  sandbox_result: string;
  changed_files: string[];
  command_output: string | null;
  errors: string[];
  safer_alternative: string | null;
  feedback_to_agent: string;
  showFullJson: boolean;
};

export type SummaryData = {
  metrics: Record<string, string | number>;
  withoutOutcomes: string[];
  withOutcomes: string[];
};

export type DemoState = {
  screen: "hero" | "stage";
  mode: "live" | "replay";
  phase: number;
  totalPhases: number;
  phaseLabel: string;
  withoutLines: WithoutLine[];
  withoutFrozen: boolean;
  wispState: WispState;
  wispMessage: string;
  transactions: Transaction[];
  feedbackContract: FeedbackContractData | null;
  planLines: PlanLine[];
  restorePoints: RestorePoint[];
  summary: SummaryData | null;
  rollback: "idle" | "rolling" | "complete";
  rollbackLines: string[];
  rollbackTargetId: string | null;
  approvalPending: string | null;
  guideMessages: string[];
};

export type DemoEvent =
  | { type: "start" }
  | { type: "phase"; phase: number; total: number; label: string }
  | { type: "without_line"; timestamp: string; kind: "info" | "warn" | "bad"; text: string }
  | { type: "without_frozen" }
  | { type: "wisp_state"; state: WispState }
  | { type: "wisp_message"; text: string }
  | { type: "transaction"; id: string; action: string; tool_call: object; status: TxStatus; policy: string; risk?: "low" | "medium" | "high"; meta: string[]; feedback?: string; receipt_id?: string }
  | { type: "feedback_contract"; tx_id: string; risk_score: number; policy_reason: string; sandbox_result: string; changed_files: string[]; command_output: string | null; errors: string[]; safer_alternative: string | null; feedback_to_agent: string; show_full_json: boolean }
  | { type: "plan_strike"; line_id: string }
  | { type: "plan_add_after"; after_id: string; text: string }
  | { type: "restore_point"; id: string; desc: string; current?: boolean }
  | { type: "terminal_line"; tx_id: string; text: string }
  | { type: "summary"; metrics: Record<string, string | number>; without_outcomes: string[]; with_outcomes: string[] }
  | { type: "mode"; mode: "live" | "replay" }
  | { type: "rollback_start"; restore_point_id: string }
  | { type: "rollback_line"; text: string }
  | { type: "rollback_complete"; restore_point_id: string }
  | { type: "approval_action"; tx_id: string; action: "approve" | "deny" };
