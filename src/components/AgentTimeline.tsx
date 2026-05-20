import type { TimelineEvent } from "@/lib/types";
import { Activity, Ban, CheckCircle2, GitBranch, RotateCcw, ShieldAlert } from "lucide-react";
import { motion } from "framer-motion";

const kindStyles: Record<string, string> = {
  allowed: "border-emerald-300/20 bg-emerald-400/10 text-emerald-200",
  sandbox: "border-indigo-300/20 bg-indigo-400/10 text-indigo-200",
  blocked: "border-red-300/25 bg-red-400/10 text-red-200",
  replan: "border-orange-300/25 bg-orange-400/10 text-orange-200",
  checkpoint: "border-yellow-300/25 bg-yellow-400/10 text-yellow-200",
  finish: "border-fuchsia-300/25 bg-fuchsia-400/10 text-fuchsia-200",
  failed: "border-red-300/25 bg-red-400/10 text-red-200",
  action: "border-slate-300/15 bg-white/[0.04] text-slate-300",
  committed: "border-emerald-300/30 bg-emerald-400/15 text-emerald-100",
  verified: "border-cyan-300/20 bg-cyan-400/10 text-cyan-200",
};

function iconFor(kind: TimelineEvent["kind"]) {
  if (kind === "blocked" || kind === "failed") return <Ban size={15} />;
  if (kind === "replan") return <RotateCcw size={15} />;
  if (kind === "checkpoint") return <ShieldAlert size={15} />;
  if (kind === "finish" || kind === "committed" || kind === "verified") return <CheckCircle2 size={15} />;
  if (kind === "sandbox") return <GitBranch size={15} />;
  return <Activity size={15} />;
}

export function AgentTimeline({ events }: { events: TimelineEvent[] }) {
  return (
    <section className="panel min-h-[420px]">
      <div className="panel-title">
        <Activity size={16} />
        Agent Activity Timeline
      </div>
      <div className="mt-4 max-h-[360px] space-y-3 overflow-auto pr-1">
        {events.length ? (
          events.map((event) => (
            <motion.div
              key={event.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className="relative rounded-lg border border-white/10 bg-white/[0.035] p-3"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex min-w-0 items-start gap-2">
                  <span className={`mt-0.5 grid size-7 shrink-0 place-items-center rounded-md border ${kindStyles[event.kind]}`}>
                    {iconFor(event.kind)}
                  </span>
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-xs font-semibold uppercase text-white">{event.kind}</span>
                      {event.decision ? (
                        <span className={`rounded px-1.5 py-0.5 text-[10px] font-bold uppercase ${kindStyles[event.kind]}`}>
                          {event.decision}
                        </span>
                      ) : null}
                      {event.risk ? <span className="text-[10px] uppercase text-slate-500">{event.risk} risk</span> : null}
                    </div>
                    <p className="mt-1 text-xs leading-5 text-slate-300">{event.reason}</p>
                    {event.policy_triggered ? (
                      <p className="mt-1 font-mono text-[11px] text-red-200">{event.policy_triggered}</p>
                    ) : null}
                    <p className="mt-1 truncate font-mono text-[11px] text-slate-500">
                      {event.target ?? event.command ?? event.action}
                    </p>
                  </div>
                </div>
                <span className="shrink-0 text-[10px] text-slate-600">{event.timestamp}</span>
              </div>
            </motion.div>
          ))
        ) : (
          <div className="rounded-lg border border-dashed border-white/10 p-4 text-sm text-slate-500">
            Timeline will populate as the controlled agent steps through reads, edits, sandbox replay, and blocked actions.
          </div>
        )}
      </div>
    </section>
  );
}
