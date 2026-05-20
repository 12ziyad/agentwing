"use client";

import { useState } from "react";
import type { TimelineEvent } from "@/lib/types";
import {
  Activity,
  Ban,
  CheckCircle2,
  ChevronDown,
  GitBranch,
  RotateCcw,
  ShieldAlert,
} from "lucide-react";

const KIND_CFG: Record<
  string,
  { border: string; bg: string; badge: string; iconCls: string }
> = {
  allowed:    { border: "border-emerald-400/20", bg: "",                  badge: "border-emerald-400/20 bg-emerald-400/10 text-emerald-300",  iconCls: "text-emerald-300" },
  sandbox:    { border: "border-indigo-400/20",  bg: "",                  badge: "border-indigo-400/20 bg-indigo-400/10 text-indigo-300",    iconCls: "text-indigo-300" },
  blocked:    { border: "border-red-400/30",     bg: "bg-red-950/20",     badge: "border-red-400/20 bg-red-400/10 text-red-300",             iconCls: "text-red-300" },
  replan:     { border: "border-orange-400/20",  bg: "",                  badge: "border-orange-400/20 bg-orange-400/10 text-orange-300",    iconCls: "text-orange-300" },
  checkpoint: { border: "border-yellow-400/20",  bg: "",                  badge: "border-yellow-400/20 bg-yellow-400/10 text-yellow-300",    iconCls: "text-yellow-300" },
  finish:     { border: "border-fuchsia-400/20", bg: "",                  badge: "border-fuchsia-400/20 bg-fuchsia-400/10 text-fuchsia-300", iconCls: "text-fuchsia-300" },
  failed:     { border: "border-red-400/30",     bg: "bg-red-950/20",     badge: "border-red-400/20 bg-red-400/10 text-red-300",             iconCls: "text-red-300" },
  action:     { border: "border-white/[0.08]",   bg: "",                  badge: "border-white/10 bg-white/[0.04] text-slate-400",           iconCls: "text-slate-400" },
  committed:  { border: "border-emerald-400/25", bg: "bg-emerald-950/20", badge: "border-emerald-400/25 bg-emerald-400/10 text-emerald-200", iconCls: "text-emerald-300" },
  verified:   { border: "border-cyan-400/20",    bg: "",                  badge: "border-cyan-400/20 bg-cyan-400/10 text-cyan-300",          iconCls: "text-cyan-300" },
};

function KindIcon({ kind }: { kind: TimelineEvent["kind"] }) {
  const cls = "size-3.5";
  if (kind === "blocked" || kind === "failed") return <Ban className={cls} />;
  if (kind === "replan") return <RotateCcw className={cls} />;
  if (kind === "checkpoint") return <ShieldAlert className={cls} />;
  if (kind === "finish" || kind === "committed" || kind === "verified") return <CheckCircle2 className={cls} />;
  if (kind === "sandbox") return <GitBranch className={cls} />;
  return <Activity className={cls} />;
}

export function TimelineEventCard({ event }: { event: TimelineEvent }) {
  const [open, setOpen] = useState(false);
  const cfg = KIND_CFG[event.kind] ?? KIND_CFG.action;
  const isBlocked = event.kind === "blocked" || event.kind === "failed";
  const hasDetail = !!(
    event.policy_triggered ||
    event.feedback?.suggested_next_action ||
    event.feedback
  );

  return (
    <div className={`rounded-lg border ${cfg.border} ${cfg.bg} overflow-hidden`}>
      <button
        onClick={() => hasDetail && setOpen((v) => !v)}
        className={`w-full text-left px-3 py-2 ${hasDetail ? "hover:bg-white/[0.025] cursor-pointer" : "cursor-default"}`}
      >
        <div className="flex items-start gap-2">
          {/* Icon badge */}
          <span className={`mt-px grid size-[22px] shrink-0 place-items-center rounded border ${cfg.badge}`}>
            <KindIcon kind={event.kind} />
          </span>

          {/* Text */}
          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-1">
              <span className="text-[10px] font-bold uppercase text-slate-300 tracking-wide">
                {event.kind}
              </span>
              {event.decision && (
                <span className={`rounded border px-1 py-px text-[9px] font-bold uppercase ${cfg.badge}`}>
                  {event.decision}
                </span>
              )}
              {event.risk && (
                <span className="text-[9px] text-slate-600 uppercase">{event.risk}</span>
              )}
            </div>
            <p className="mt-0.5 text-[11px] leading-[1.45] text-slate-300 line-clamp-2">
              {event.reason}
            </p>
            {isBlocked && event.policy_triggered && !open && (
              <p className="mt-0.5 font-mono text-[10px] text-red-300/80 truncate">
                {event.policy_triggered}
              </p>
            )}
          </div>

          {/* Meta */}
          <div className="flex shrink-0 flex-col items-end gap-1 ml-1">
            <span className="text-[9px] text-slate-600">{event.timestamp}</span>
            {hasDetail && (
              <ChevronDown
                size={11}
                className={`text-slate-600 transition-transform ${open ? "rotate-180" : ""}`}
              />
            )}
          </div>
        </div>
      </button>

      {/* Expanded detail */}
      {open && (
        <div className="border-t border-white/[0.05] bg-black/25 px-3 pb-3 pt-2 space-y-2.5">
          {isBlocked && (
            <div className="rounded border border-red-400/20 bg-red-900/20 px-2.5 py-2">
              <p className="text-[10px] font-bold uppercase text-red-400 mb-1">
                Blocked before execution
              </p>
              {event.policy_triggered && (
                <p className="font-mono text-[10.5px] text-red-200">
                  Policy: {event.policy_triggered}
                </p>
              )}
            </div>
          )}

          {event.feedback?.suggested_next_action && (
            <div>
              <p className="text-[9px] font-bold uppercase text-slate-600 mb-1">
                Feedback sent to agent
              </p>
              <p className="rounded bg-indigo-900/20 border border-indigo-400/15 px-2 py-1.5 text-[11px] text-indigo-200">
                {event.feedback.suggested_next_action}
              </p>
            </div>
          )}

          {event.policy_triggered && !isBlocked && (
            <div>
              <p className="text-[9px] font-bold uppercase text-slate-600 mb-1">
                Policy triggered
              </p>
              <code className="font-mono text-[10.5px] text-yellow-200">
                {event.policy_triggered}
              </code>
            </div>
          )}

          {event.feedback && (
            <div>
              <p className="text-[9px] font-bold uppercase text-slate-600 mb-1">
                AgentWing decision JSON
              </p>
              <pre className="max-h-28 overflow-auto rounded border border-white/[0.07] bg-black/40 p-2 text-[9.5px] leading-[1.6] text-cyan-200/80">
                {JSON.stringify(event.feedback, null, 2)}
              </pre>
            </div>
          )}

          {(event.target ?? event.command) && (
            <div>
              <p className="text-[9px] font-bold uppercase text-slate-600 mb-1">Target</p>
              <code className="font-mono text-[10.5px] text-slate-400">
                {event.target ?? event.command}
              </code>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
