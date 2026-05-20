import type { FeedbackContractData } from "@/lib/demoTypes";

export function FeedbackContract({ contract }: { contract: FeedbackContractData | null }) {
  if (!contract) {
    return (
      <div className="rounded border border-white/[0.06] bg-white/[0.02] px-3 py-3">
        <p className="mb-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-300">
          Latest Feedback Contract
        </p>
        <p className="text-[11px] text-slate-400">Awaiting first transaction...</p>
      </div>
    );
  }

  return (
    <div className="rounded border border-cyan-400/15 bg-cyan-400/[0.04] px-3 py-3">
      <div className="mb-2 flex items-center justify-between gap-2">
        <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-cyan-200">
          Latest Feedback Contract
        </p>
        <span className="rounded border border-cyan-400/20 bg-cyan-400/10 px-1.5 py-0.5 font-mono text-[9px] text-cyan-200">
          {contract.tx_id}
        </span>
      </div>
      <div className="space-y-1.5 text-[11px] leading-5">
        <p className="text-slate-300">
          <span className="text-slate-400">reason: </span>
          {contract.policy_reason}
        </p>
        <p className="text-slate-300">
          <span className="text-slate-400">sandbox: </span>
          {contract.sandbox_result}
        </p>
        {contract.safer_alternative && (
          <p className="text-cyan-100">
            <span className="text-slate-400">safer route: </span>
            {contract.safer_alternative}
          </p>
        )}
        <p className="text-cyan-100">
          <span className="text-slate-400">feedback: </span>
          {contract.feedback_to_agent}
        </p>
      </div>
    </div>
  );
}
