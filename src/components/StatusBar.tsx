import type { ChangeHistoryEntry, SessionSummary } from "@/lib/types";
import { RotateCcw } from "lucide-react";

type StatusBarProps = {
  summary: SessionSummary;
  changeHistory: ChangeHistoryEntry[];
  onReset: () => void;
  isRunning: boolean;
};

export function StatusBar({ summary, changeHistory, onReset, isRunning }: StatusBarProps) {
  return (
    <footer className="flex-none flex items-center gap-0 h-[26px] border-t border-white/[0.07] bg-indigo-950/60 px-3 text-[10.5px] font-medium select-none overflow-hidden">
      <Stat label="Allowed" value={summary.allowed} color="text-emerald-400" />
      <Sep />
      <Stat label="Sandboxed" value={summary.sandboxed} color="text-indigo-400" />
      <Sep />
      <Stat label="Blocked" value={summary.blocked} color="text-red-400" />
      <Sep />
      <Stat label="Replans" value={summary.replans} color="text-orange-400" />
      <Sep />
      <Stat label="Checkpoints" value={summary.checkpoints} color="text-yellow-400" />
      {summary.fidelityScore > 0 && (
        <>
          <Sep />
          <Stat label="Fidelity" value={summary.fidelityScore.toFixed(2)} color="text-cyan-400" />
        </>
      )}
      {changeHistory.length > 0 && (
        <>
          <Sep />
          <span className="text-emerald-300/80">
            {changeHistory.length} committed change{changeHistory.length !== 1 ? "s" : ""}
          </span>
        </>
      )}
      <span className="mx-3 text-slate-700">|</span>
      <span className="text-slate-600 mr-auto">Changes persist until Reset Demo</span>
      {summary.finished && (
        <span className="mr-3 text-emerald-400">✓ Run complete</span>
      )}
      <button
        onClick={onReset}
        disabled={isRunning}
        className="flex items-center gap-1 text-red-400/70 hover:text-red-300 transition disabled:opacity-30 disabled:cursor-not-allowed"
      >
        <RotateCcw size={10} />
        Reset Demo
      </button>
    </footer>
  );
}

function Stat({ label, value, color }: { label: string; value: number | string; color: string }) {
  return (
    <span className="flex items-center gap-1">
      <span className="text-slate-600">{label}:</span>
      <span className={color}>{value}</span>
    </span>
  );
}

function Sep() {
  return <span className="mx-2.5 text-slate-700">│</span>;
}
