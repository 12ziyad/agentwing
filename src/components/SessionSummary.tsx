import type { SessionSummary as SessionSummaryType } from "@/lib/types";
import { BarChart3 } from "lucide-react";

const cards = [
  ["allowed", "Allowed"],
  ["sandboxed", "Sandboxed"],
  ["blocked", "Blocked"],
  ["replans", "Replans"],
  ["checkpoints", "Checkpoints"],
] as const;

export function SessionSummary({ summary }: { summary: SessionSummaryType }) {
  return (
    <section className="panel">
      <div className="panel-title">
        <BarChart3 size={16} />
        Session Summary
      </div>
      <div className="mt-4 grid grid-cols-2 gap-2">
        {cards.map(([key, label]) => (
          <div key={key} className="rounded-lg border border-white/10 bg-white/[0.04] p-3">
            <div className="text-2xl font-semibold text-white">{summary[key]}</div>
            <div className="mt-1 text-[11px] uppercase text-slate-500">{label}</div>
          </div>
        ))}
        <div className="col-span-2 rounded-lg border border-indigo-300/20 bg-indigo-400/10 p-3">
          <div className="flex items-end justify-between">
            <div>
              <div className="text-2xl font-semibold text-white">{summary.fidelityScore.toFixed(2)}</div>
              <div className="mt-1 text-[11px] uppercase text-indigo-200">Fidelity score</div>
            </div>
            <span className="rounded-md bg-white/[0.07] px-2 py-1 text-xs font-semibold text-slate-300">
              {summary.finished ? "Finished" : "Live"}
            </span>
          </div>
        </div>
      </div>
    </section>
  );
}
