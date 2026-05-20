"use client";

import { useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import type { PlannerStatus, TimelineEvent } from "@/lib/types";
import {
  Ban,
  Bot,
  CheckCircle2,
  Loader2,
  Shield,
  User,
} from "lucide-react";

type ActivityKind = "user" | "agent" | "success" | "blocked" | "system" | "thinking";

type ActivityItem = {
  id: string;
  text: string;
  kind: ActivityKind;
};

const KIND_STYLE: Record<ActivityKind, { bg: string; border: string; text: string; Icon: React.ElementType }> = {
  user:     { bg: "bg-blue-950/40",    border: "border-blue-400/20",    text: "text-blue-200",    Icon: User },
  agent:    { bg: "bg-slate-900/50",   border: "border-white/[0.06]",   text: "text-slate-300",   Icon: Bot },
  success:  { bg: "bg-emerald-950/30", border: "border-emerald-400/20", text: "text-emerald-200", Icon: CheckCircle2 },
  blocked:  { bg: "bg-red-950/30",     border: "border-red-400/20",     text: "text-red-300",     Icon: Ban },
  system:   { bg: "bg-slate-900/30",   border: "border-white/[0.05]",   text: "text-slate-500",   Icon: Shield },
  thinking: { bg: "bg-indigo-950/40",  border: "border-indigo-400/20",  text: "text-indigo-300",  Icon: Loader2 },
};

function eventToActivity(event: TimelineEvent): ActivityItem | null {
  const id = event.id;

  if (event.action === "readFile" && event.target === "task") {
    const task = event.reason.replace("User task received: ", "").slice(0, 70);
    return { id, text: `User: "${task}${task.length === 70 ? "…" : ""}"`, kind: "user" };
  }

  if (event.action === "readFile" && event.decision === "blocked") {
    return { id, text: `AgentWing blocked: cannot read ${event.target} — secret file`, kind: "blocked" };
  }

  if (event.action === "readFile" && event.decision === "allowed" && event.target !== "task") {
    return { id, text: `Reading ${event.target}`, kind: "agent" };
  }

  if (event.action === "plan" && event.kind === "action") {
    const s = event.reason.replace("LLM planned code edit: ", "").slice(0, 60);
    return { id, text: `LLM planned: ${s}`, kind: "agent" };
  }

  if (event.kind === "verified") {
    return { id, text: "Preview change verified — visible change confirmed ✓", kind: "success" };
  }

  if (event.kind === "checkpoint") {
    return { id, text: `Checkpoint before editing ${event.target}`, kind: "system" };
  }

  if (event.action === "writeFile" && event.decision === "allowed") {
    return { id, text: `Writing code edit to ${event.target}`, kind: "agent" };
  }

  if (event.kind === "committed") {
    const s = event.reason.replace("Committed: ", "").slice(0, 55);
    return { id, text: `Committed: ${s}`, kind: "success" };
  }

  if (event.kind === "sandbox" && event.action === "runCommand") {
    return { id, text: "Running npm test in isolated E2B sandbox…", kind: "agent" };
  }

  if (event.kind === "sandbox" && event.action === "sandboxResult" && event.reason.includes("passed")) {
    return { id, text: "Sandbox tests passed ✓", kind: "success" };
  }

  if (event.kind === "failed" && event.action === "sandboxResult") {
    return { id, text: `Sandbox test failed — ${event.reason.slice(0, 40)}`, kind: "blocked" };
  }

  if (event.action === "runCommand" && event.decision === "blocked") {
    return { id, text: `AgentWing blocked: ${event.command} (policy enforcement)`, kind: "blocked" };
  }

  if (event.kind === "replan") {
    const r = event.reason;
    if (r.includes("No visible change")) return { id, text: "No visible change — requesting LLM repair", kind: "agent" };
    if (r.includes("LLM failed") || r.includes("deterministic fallback")) return { id, text: "LLM unavailable — using rule-based fallback", kind: "agent" };
    if (r.includes(".env.example")) return { id, text: "Replanned: reading .env.example instead of .env", kind: "agent" };
    if (r.includes("safe") || r.includes("safe-ui-change")) return { id, text: "Replanned: creating safe-ui-change feature branch", kind: "agent" };
    return { id, text: `Replanned: ${r.slice(0, 55)}`, kind: "agent" };
  }

  if (event.action === "runCommand" && event.decision === "allowed") {
    return { id, text: `Running: ${event.command}`, kind: "agent" };
  }

  if (event.kind === "finish") {
    return { id, text: "Agent finished safely — all checks passed ✓", kind: "success" };
  }

  return null;
}

function iconFor(kind: ActivityKind, isThinking = false) {
  const cfg = KIND_STYLE[kind];
  const Icon = cfg.Icon;
  return (
    <span className={`mt-0.5 grid size-5 shrink-0 place-items-center rounded-full border ${cfg.border} ${cfg.bg}`}>
      <Icon size={11} className={`${cfg.text} ${isThinking ? "animate-spin" : ""}`} />
    </span>
  );
}

export function ActivityFeed({
  events,
  isRunning,
  plannerStatus,
}: {
  events: TimelineEvent[];
  isRunning: boolean;
  plannerStatus: PlannerStatus;
}) {
  const endRef = useRef<HTMLDivElement>(null);
  const items = events.map(eventToActivity).filter((x): x is ActivityItem => x !== null);

  useEffect(() => {
    if (isRunning) {
      endRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [items.length, isRunning]);

  const showThinking = isRunning && plannerStatus === "planning";

  return (
    <div className="flex-1 min-h-0 overflow-y-auto px-3 py-3 space-y-1.5">
      {items.length === 0 && !isRunning ? (
        <div className="mt-4 rounded-lg border border-dashed border-white/[0.07] px-3 py-5 text-center text-[11px] text-slate-600 leading-6">
          The agent activity stream will appear here when you run a task.
          <br />
          Each step is explained in plain language.
        </div>
      ) : (
        <AnimatePresence initial={false}>
          {items.map((item) => {
            const cfg = KIND_STYLE[item.kind];
            return (
              <motion.div
                key={item.id}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.18 }}
                className={`flex items-start gap-2 rounded-lg border px-2.5 py-2 ${cfg.border} ${cfg.bg}`}
              >
                {iconFor(item.kind)}
                <span className={`text-[11px] leading-[1.5] ${cfg.text}`}>{item.text}</span>
              </motion.div>
            );
          })}
          {showThinking && (
            <motion.div
              key="thinking"
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex items-start gap-2 rounded-lg border border-indigo-400/20 bg-indigo-950/40 px-2.5 py-2"
            >
              {iconFor("thinking", true)}
              <span className="text-[11px] text-indigo-300 animate-pulse">
                Asking LLM to plan UI edit…
              </span>
            </motion.div>
          )}
        </AnimatePresence>
      )}
      <div ref={endRef} />
    </div>
  );
}
