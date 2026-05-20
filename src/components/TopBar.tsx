import type { PlannerStatus } from "@/lib/types";
import { FlaskConical, KeyRound, RotateCcw, ShieldCheck } from "lucide-react";

type TopBarProps = {
  llmModel: string;
  plannerStatus: PlannerStatus;
  onReset: () => void;
  isRunning: boolean;
};

const PLANNER: Record<PlannerStatus, { label: (m: string) => string; cls: string }> = {
  idle:     { label: (m) => `LLM Agent: ${m}`,  cls: "border-white/[0.09] bg-white/[0.04] text-slate-400" },
  planning: { label: () => "Planning…",          cls: "border-indigo-400/25 bg-indigo-400/10 text-indigo-300" },
  llm:      { label: (m) => `LLM: ${m}`,        cls: "border-emerald-400/25 bg-emerald-400/10 text-emerald-300" },
  fallback: { label: () => "Rule fallback",      cls: "border-amber-400/25 bg-amber-400/10 text-amber-300" },
};

export function TopBar({ llmModel, plannerStatus, onReset, isRunning }: TopBarProps) {
  const p = PLANNER[plannerStatus];

  return (
    <header className="flex-none flex items-center gap-3 px-4 h-11 border-b border-white/[0.07] bg-[#070a16] z-20 overflow-hidden">
      {/* Logo */}
      <div className="flex items-center gap-2 shrink-0">
        <div className="grid size-7 place-items-center rounded border border-indigo-400/30 bg-indigo-500/15 text-indigo-300">
          <ShieldCheck size={14} />
        </div>
        <span className="text-sm font-semibold text-white">AgentWing</span>
        <span className="inline-flex items-center gap-1 rounded border border-cyan-400/25 bg-cyan-400/10 px-1.5 py-0.5 text-[10px] font-bold uppercase text-cyan-300">
          <FlaskConical size={9} />
          Live Agent Lab
        </span>
      </div>

      {/* Subtitle — hidden on narrow screens */}
      <span className="hidden text-[11px] text-slate-600 xl:block">
        Runtime control layer for autonomous coding agents
      </span>

      {/* Badges */}
      <div className="ml-auto flex items-center gap-2 shrink-0">
        <span
          className={`inline-flex items-center rounded border px-2 py-0.5 text-[10px] font-semibold ${p.cls}`}
        >
          {p.label(llmModel)}
        </span>
        <span className="inline-flex items-center gap-1 rounded border border-emerald-400/20 bg-emerald-400/10 px-2 py-0.5 text-[10px] font-semibold text-emerald-300">
          <KeyRound size={10} />
          E2B Sandbox: Ready
        </span>
        <button
          onClick={onReset}
          disabled={isRunning}
          className="flex items-center gap-1.5 rounded border border-red-400/20 bg-red-400/10 px-2.5 py-1 text-[10px] font-semibold text-red-300 transition hover:bg-red-400/20 disabled:cursor-not-allowed disabled:opacity-40"
        >
          <RotateCcw size={10} />
          Reset Demo
        </button>
      </div>
    </header>
  );
}
