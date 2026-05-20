"use client";

import { useState } from "react";
import type { PlannerStatus, TimelineEvent } from "@/lib/types";
import { ArrowUp, Bot, ChevronDown } from "lucide-react";
import { ActivityFeed } from "./ActivityFeed";

type RightPanelProps = {
  task: string;
  setTask: (t: string) => void;
  onRun: () => void;
  isRunning: boolean;
  events: TimelineEvent[];
  plannerStatus: PlannerStatus;
};

const PRIMARY_CHIPS = ["Add button called Log", "Make Risk card red"];
const SECONDARY_CHIPS = [
  "Remove Active status pill",
  "Make primary button bigger",
  "Add Agents metric card",
  "Remove Tasks metric card",
  "Make cards more rounded",
  "Change button text to Launch Workflow",
];

export function RightPanel({ task, setTask, onRun, isRunning, events, plannerStatus }: RightPanelProps) {
  const [showMore, setShowMore] = useState(false);

  function handleChip(chip: string) {
    setTask(chip);
    setShowMore(false);
  }

  return (
    <div className="flex flex-col h-full bg-[#0b0e1a] overflow-hidden">
      {/* Header */}
      <div className="flex-none flex items-center gap-2 px-4 h-9 border-b border-white/[0.07]">
        <Bot size={13} className="text-indigo-400" />
        <span className="text-xs font-semibold text-slate-300">Agent</span>
        <span className="hidden text-[9px] text-slate-600 sm:block ml-1">
          Every tool call is checked before execution
        </span>
      </div>

      {/* Activity feed — grows and scrolls */}
      <ActivityFeed events={events} isRunning={isRunning} plannerStatus={plannerStatus} />

      {/* Composer — pinned to bottom */}
      <div className="flex-none border-t border-white/[0.07] px-3 py-3 space-y-2.5 bg-[#0b0e1a]">
        {/* Primary chips + more toggle */}
        <div className="flex flex-wrap gap-1.5 items-center">
          {PRIMARY_CHIPS.map((c) => (
            <button
              key={c}
              onClick={() => handleChip(c)}
              disabled={isRunning}
              className="rounded-full border border-white/[0.08] bg-white/[0.03] px-2.5 py-1 text-[10px] font-medium text-slate-400 transition hover:border-indigo-400/30 hover:text-indigo-200 hover:bg-indigo-500/10 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {c}
            </button>
          ))}
          <button
            onClick={() => setShowMore((v) => !v)}
            disabled={isRunning}
            className="flex items-center gap-0.5 text-[10px] text-slate-600 hover:text-slate-400 transition disabled:opacity-40"
          >
            More <ChevronDown size={10} className={`transition-transform ${showMore ? "rotate-180" : ""}`} />
          </button>
        </div>

        {/* Secondary chips (expanded) */}
        {showMore && (
          <div className="flex flex-wrap gap-1.5">
            {SECONDARY_CHIPS.map((c) => (
              <button
                key={c}
                onClick={() => handleChip(c)}
                disabled={isRunning}
                className="rounded-full border border-white/[0.08] bg-white/[0.03] px-2.5 py-1 text-[10px] font-medium text-slate-400 transition hover:border-indigo-400/30 hover:text-indigo-200 hover:bg-indigo-500/10 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {c}
              </button>
            ))}
          </div>
        )}

        {/* Input row */}
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <input
              value={task}
              onChange={(e) => setTask(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && !isRunning && onRun()}
              placeholder="Ask the mini agent to change the app…"
              disabled={isRunning}
              className="h-9 w-full rounded-xl border border-white/[0.1] bg-white/[0.05] px-3 pr-10 text-xs text-white placeholder:text-slate-600 outline-none transition focus:border-indigo-400/50 focus:bg-white/[0.08] disabled:opacity-50"
            />
          </div>
          <button
            onClick={onRun}
            disabled={isRunning}
            className="grid size-9 shrink-0 place-items-center rounded-xl bg-indigo-500 text-white shadow-[0_0_18px_rgba(99,102,241,0.45)] transition hover:bg-indigo-400 active:scale-95 disabled:cursor-not-allowed disabled:bg-slate-700 disabled:shadow-none"
          >
            {isRunning ? (
              <span className="size-3.5 rounded-full border-2 border-white/30 border-t-white animate-spin" />
            ) : (
              <ArrowUp size={15} strokeWidth={2.5} />
            )}
          </button>
        </div>
        <p className="text-[9px] text-slate-700 text-center">
          Press Enter or click ↑ to run · Changes persist until Reset Demo
        </p>
      </div>
    </div>
  );
}
