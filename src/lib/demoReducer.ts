import type { DemoEvent, DemoState, PlanLine } from "./demoTypes";

export const INITIAL_PLAN_LINES: PlanLine[] = [
  { id: "L1", text: "Read .env for auth config", struck: false },
  { id: "L2", text: "Edit src/boxArenaConfig.ts for Box Arena", struck: false },
  { id: "L3", text: "Run npm test", struck: false },
  { id: "L4", text: "git push --force origin main", struck: false },
  { id: "L5", text: "Deploy directly to staging", struck: false },
];

export const initialState: DemoState = {
  screen: "hero",
  mode: "replay",
  phase: 0,
  totalPhases: 7,
  phaseLabel: "",
  withoutLines: [],
  withoutFrozen: false,
  wispState: "idle",
  wispMessage: "Waiting for test run to start...",
  transactions: [],
  feedbackContract: null,
  planLines: INITIAL_PLAN_LINES,
  restorePoints: [],
  summary: null,
  rollback: "idle",
  rollbackLines: [],
  rollbackTargetId: null,
  approvalPending: null,
  guideMessages: [],
};

export function demoReducer(state: DemoState, event: DemoEvent): DemoState {
  switch (event.type) {
    case "start":
      return { ...state, screen: "stage" };

    case "mode":
      return { ...state, mode: event.mode };

    case "phase":
      return { ...state, phase: event.phase, totalPhases: event.total, phaseLabel: event.label };

    case "without_line":
      return {
        ...state,
        withoutLines: [
          ...state.withoutLines,
          { id: crypto.randomUUID(), timestamp: event.timestamp, kind: event.kind, text: event.text },
        ],
      };

    case "without_frozen":
      return { ...state, withoutFrozen: true };

    case "wisp_state":
      return { ...state, wispState: event.state };

    case "wisp_message":
      return { ...state, wispMessage: event.text };

    case "transaction": {
      const isApproval = event.status === "approval";
      const newTx = {
        id: event.id,
        action: event.action,
        toolCall: event.tool_call,
        status: event.status,
        policy: event.policy,
        risk: event.risk,
        meta: event.meta,
        feedback: event.feedback,
        receiptId: event.receipt_id,
        terminalLines: [],
        approvalState: isApproval ? ("pending" as const) : undefined,
      };
      return {
        ...state,
        transactions: [...state.transactions, newTx],
        approvalPending: isApproval ? event.id : state.approvalPending,
      };
    }

    case "feedback_contract":
      return {
        ...state,
        feedbackContract: {
          tx_id: event.tx_id,
          risk_score: event.risk_score,
          policy_reason: event.policy_reason,
          sandbox_result: event.sandbox_result,
          changed_files: event.changed_files,
          command_output: event.command_output,
          errors: event.errors,
          safer_alternative: event.safer_alternative,
          feedback_to_agent: event.feedback_to_agent,
          showFullJson: event.show_full_json,
        },
      };

    case "plan_strike": {
      const lines = state.planLines.map((l) =>
        l.id === event.line_id ? { ...l, struck: true } : l,
      );
      return { ...state, planLines: lines };
    }

    case "plan_add_after": {
      const idx = state.planLines.findIndex((l) => l.id === event.after_id);
      if (idx === -1) return state;
      const newLine: PlanLine = {
        id: `${event.after_id}_R`,
        text: event.text,
        struck: false,
        isReplacement: true,
      };
      const lines = [
        ...state.planLines.slice(0, idx + 1),
        newLine,
        ...state.planLines.slice(idx + 1),
      ];
      return { ...state, planLines: lines };
    }

    case "restore_point": {
      const existing = state.restorePoints.map((rp) => ({ ...rp, current: false }));
      const already = existing.findIndex((rp) => rp.id === event.id);
      if (already !== -1) {
        existing[already] = { ...existing[already], current: event.current ?? false };
        return { ...state, restorePoints: existing };
      }
      return {
        ...state,
        restorePoints: [
          ...existing,
          { id: event.id, desc: event.desc, current: event.current ?? false },
        ],
      };
    }

    case "terminal_line": {
      const txIdx = state.transactions.findIndex((t) => t.id === event.tx_id);
      if (txIdx === -1) return state;
      const updated = [...state.transactions];
      updated[txIdx] = {
        ...updated[txIdx],
        terminalLines: [...updated[txIdx].terminalLines, event.text],
      };
      return { ...state, transactions: updated };
    }

    case "summary":
      return {
        ...state,
        summary: {
          metrics: event.metrics,
          withoutOutcomes: event.without_outcomes,
          withOutcomes: event.with_outcomes,
        },
      };

    case "approval_action": {
      const txIdx = state.transactions.findIndex((t) => t.id === event.tx_id);
      if (txIdx === -1) return state;
      const tx = state.transactions[txIdx];
      if (tx.approvalState !== "pending") return state;
      const updated = [...state.transactions];
      updated[txIdx] = {
        ...tx,
        approvalState: event.action === "approve" ? "approved" : "denied",
        status: event.action === "approve" ? "approved" : "blocked",
      };
      return {
        ...state,
        transactions: updated,
        approvalPending: null,
        wispState: event.action === "approve" ? "approved" : "idle",
        wispMessage:
          event.action === "approve"
            ? "Approved · immutable audit event created"
            : "Denied · deploy request rejected",
      };
    }

    case "rollback_start":
      return {
        ...state,
        rollback: "rolling",
        rollbackTargetId: event.restore_point_id,
        rollbackLines: [],
        wispState: "rollback",
        wispMessage: `Rolling back to ${event.restore_point_id}...`,
      };

    case "rollback_line":
      return { ...state, rollbackLines: [...state.rollbackLines, event.text] };

    case "rollback_complete": {
      const targetIdx = state.restorePoints.findIndex((rp) => rp.id === event.restore_point_id);
      const updatedRPs = state.restorePoints
        .slice(0, targetIdx + 1)
        .map((rp, i) => ({ ...rp, current: i === targetIdx }));
      return {
        ...state,
        rollback: "complete",
        rollbackTargetId: null,
        restorePoints: updatedRPs,
        wispState: "idle",
        wispMessage: "Rollback complete · audit event recorded",
      };
    }

    default:
      return state;
  }
}
