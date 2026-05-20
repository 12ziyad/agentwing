import type { Dispatch } from "react";
import type { DemoEvent } from "@/lib/demoTypes";

type ApprovalBlockProps = {
  txId: string;
  approvalState: "pending" | "approved" | "denied";
  dispatch: Dispatch<DemoEvent>;
};

export function ApprovalBlock({ txId, approvalState, dispatch }: ApprovalBlockProps) {
  if (approvalState !== "pending") {
    return (
      <div className={`mt-2 rounded border px-3 py-2 text-xs font-semibold ${
        approvalState === "approved"
          ? "border-emerald-400/25 bg-emerald-400/10 text-emerald-300"
          : "border-red-400/25 bg-red-400/10 text-red-300"
      }`}>
        {approvalState === "approved"
          ? "Approved. Audit event immutably recorded."
          : "Denied. Deploy request rejected."}
      </div>
    );
  }

  return (
    <div className="mt-2 rounded border border-amber-400/20 bg-amber-400/[0.06] p-3">
      <p className="text-[11px] leading-5 text-amber-100/85">
        External API calls cannot be rolled back. Approval creates an immutable audit record.
        Restore Points cover files and code.
      </p>
      <div className="mt-2 flex gap-2">
        <button
          onClick={() => dispatch({ type: "approval_action", tx_id: txId, action: "approve" })}
          className="flex-1 rounded border border-emerald-400/30 bg-emerald-400/10 py-1.5 text-xs font-semibold text-emerald-300 transition hover:bg-emerald-400/15 active:scale-95"
        >
          Approve
        </button>
        <button
          onClick={() => dispatch({ type: "approval_action", tx_id: txId, action: "deny" })}
          className="flex-1 rounded border border-red-400/25 bg-red-400/10 py-1.5 text-xs font-semibold text-red-300 transition hover:bg-red-400/15 active:scale-95"
        >
          Deny
        </button>
      </div>
    </div>
  );
}
