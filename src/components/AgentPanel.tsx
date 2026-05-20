"use client";

import { useEffect, useRef } from "react";
import type {
  ChangeHistoryEntry,
  PlannerStatus,
  SessionSummary,
  TimelineEvent,
} from "@/lib/types";
import {
  CheckCircle2,
  History,
  KeyRound,
  Play,
  RotateCcw,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { TimelineEventCard } from "./TimelineEventCard";

type AgentPanelProps = {
  task: string;
  setTask: (t: string) => void;
  onRun: () => void;
  onReset: () => void;
  isRunning: boolean;
  plannerStatus: PlannerStatus;
  llmModel: string;
  events: TimelineEvent[];
  changeHistory: ChangeHistoryEntry[];
  summary: SessionSummary;
};

const CHIPS = [
  "Add button called Log",
  "Make primary button bigger",
  "Remove Active status pill",
  "Remove Tasks metric card",
  "Make Risk card red",
  "Add Agents metric card",
  "Change button text to Launch Workflow",
  "Make cards more rounded",
];

const PLANNER_BADGE: Record<PlannerStatus, { label: (m: string) => string; cls: string }> = {
  idle:     { label: (m) => `LLM Agent: ${m}`,   cls: "border-white/10 bg-white/[0.04] text-slate-400" },
  planning: { label: () => "Planning edit…",     cls: "border-indigo-400/20 bg-indigo-400/10 text-indigo-300" },
  llm:      { label: (m) => `LLM: ${m}`,         cls: "border-emerald-400/20 bg-emerald-400/10 text-emerald-300" },
  fallback: { label: () => "Rule fallback",       cls: "border-amber-400/20 bg-amber-400/10 text-amber-300" },
};

export function AgentPanel({
  task,
  setTask,
  onRun,
  onReset,
  isRunning,
  plannerStatus,
  llmModel,
  events,
  changeHistory,
  summary,
}: AgentPanelProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const pb = PLANNER_BADGE[plannerStatus];

  // Auto-scroll timeline to bottom when new events arrive during a run
  useEffect(() => {
    if (isRunning && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [events.length, isRunning]);

  return (
    <div className="flex flex-col h-full bg-[#0c0f1b] overflow-hidden">
      {/* ── Task Composer ────────────────────────────── */}
      <div className="flex-none px-4 pt-3 pb-3 border-b border-white/[0.07] space-y-2.5">
        <div className="text-[10px] font-bold uppercase tracking-widest text-slate-500">
          Agent Task
        </div>
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Sparkles
              size={14}
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-indigo-400/70"
            />
            <input
              value={task}
              onChange={(e) => setTask(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && !isRunning && onRun()}
              placeholder="Ask the mini agent to change the app…"
              disabled={isRunning}
              className="h-9 w-full rounded-lg border border-white/10 bg-white/[0.05] pl-9 pr-3 text-xs text-white placeholder:text-slate-600 outline-none transition focus:border-indigo-400/50 focus:bg-white/[0.08] disabled:opacity-50"
            />
          </div>
          <button
            onClick={onRun}
            disabled={isRunning}
            className="inline-flex h-9 min-w-[90px] items-center justify-center gap-1.5 rounded-lg bg-indigo-500 px-3 text-xs font-semibold text-white shadow-[0_0_20px_rgba(99,102,241,0.4)] transition hover:bg-indigo-400 active:scale-95 disabled:cursor-not-allowed disabled:bg-slate-700 disabled:text-slate-400 disabled:shadow-none"
          >
            <Play size={13} fill="currentColor" />
            {isRunning ? "Running…" : "Run Agent"}
          </button>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <span className={`inline-flex items-center rounded border px-2 py-0.5 text-[10px] font-semibold ${pb.cls}`}>
            {pb.label(llmModel)}
          </span>
          <span className="inline-flex items-center gap-1 rounded border border-emerald-400/20 bg-emerald-400/10 px-2 py-0.5 text-[10px] font-semibold text-emerald-300">
            <KeyRound size={10} />
            E2B Sandbox ready
          </span>
        </div>
      </div>

      {/* ── Quick Actions ─────────────────────────────── */}
      <div className="flex-none px-4 py-2.5 border-b border-white/[0.07]">
        <div className="text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-2">
          Quick Actions
        </div>
        <div className="flex flex-wrap gap-1">
          {CHIPS.map((chip) => (
            <button
              key={chip}
              onClick={() => setTask(chip)}
              disabled={isRunning}
              className="rounded-full border border-white/10 bg-white/[0.03] px-2.5 py-1 text-[10px] font-medium text-slate-400 transition hover:border-indigo-400/30 hover:bg-indigo-500/10 hover:text-indigo-200 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {chip}
            </button>
          ))}
        </div>
      </div>

      {/* ── Scrollable area: timeline + history + stats ─ */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-3 space-y-5">
        {/* AgentWing Decisions */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-slate-500">
              <ShieldCheck size={11} className="text-indigo-400" />
              AgentWing Decisions
            </div>
            <span className="text-[9px] text-slate-700">Every tool call is checked</span>
          </div>

          {events.length === 0 ? (
            <div className="rounded-lg border border-dashed border-white/[0.07] px-3 py-4 text-center text-[11px] text-slate-600">
              Timeline will populate as the agent reads files, applies edits, runs sandbox tests, and handles blocked actions.
            </div>
          ) : (
            <div className="space-y-1.5">
              {events.map((event) => (
                <TimelineEventCard key={event.id} event={event} />
              ))}
            </div>
          )}
        </div>

        {/* Committed Changes */}
        {changeHistory.length > 0 && (
          <div>
            <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-2">
              <History size={11} className="text-emerald-500" />
              Committed Changes
            </div>
            <div className="space-y-1.5">
              {[...changeHistory].reverse().map((entry) => (
                <div
                  key={entry.id}
                  className="flex items-start gap-2 rounded-lg border border-emerald-400/15 bg-emerald-400/5 px-2.5 py-2"
                >
                  <CheckCircle2 size={11} className="mt-px shrink-0 text-emerald-400" />
                  <div className="min-w-0">
                    <p className="truncate text-[11px] font-semibold text-emerald-200">
                      {entry.summary}
                    </p>
                    <p className="text-[9px] text-slate-600 mt-0.5">{entry.timestamp}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Session Summary */}
        <div className="border-t border-white/[0.06] pt-4">
          <div className="text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-2">
            Session Summary
          </div>
          <div className="grid grid-cols-3 gap-1.5 mb-3">
            {(
              [
                ["Allowed",  summary.allowed],
                ["Sandbox",  summary.sandboxed],
                ["Blocked",  summary.blocked],
                ["Replans",  summary.replans],
                ["Checks",   summary.checkpoints],
                ["Fidelity", summary.fidelityScore.toFixed(1)],
              ] as [string, string | number][]
            ).map(([label, value]) => (
              <div
                key={label}
                className="rounded-lg border border-white/[0.07] bg-white/[0.03] px-2 py-2 text-center"
              >
                <div className="text-sm font-semibold text-white">{value}</div>
                <div className="text-[9px] uppercase text-slate-600 mt-0.5">{label}</div>
              </div>
            ))}
          </div>
          <div className="flex items-center justify-between">
            <span className="text-[10px] text-slate-600">
              {summary.finished ? "Run complete ✓" : "Changes persist until reset"}
            </span>
            <button
              onClick={onReset}
              disabled={isRunning}
              className="flex items-center gap-1.5 rounded-lg border border-red-400/20 bg-red-400/10 px-3 py-1.5 text-[11px] font-semibold text-red-300 transition hover:bg-red-400/20 active:scale-95 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <RotateCcw size={11} />
              Reset Demo
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
