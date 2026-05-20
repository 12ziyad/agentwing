"use client";

import { useEffect, useMemo, useRef, useState, type RefObject } from "react";
import type { Dispatch } from "react";
import type { DemoEvent, DemoState, Transaction } from "@/lib/demoTypes";
import { Mascot } from "./Mascot";
import { FeedbackContract } from "./FeedbackContract";
import { GuideInput } from "./GuideInput";
import { TransactionCard } from "./TransactionCard";
import { PlanDiff } from "./PlanDiff";

type ConsoleTab = "without" | "with";

const DIRECT_STEPS = [
  {
    action: "agent -> read .env",
    result: "secret values leaked into transcript",
  },
  {
    action: "agent -> edit src/boxArenaConfig.ts",
    result: "47 lines changed, no restore point",
  },
  {
    action: "agent -> npm test on host",
    result: "ran outside sandbox, no replay evidence",
  },
  {
    action: "agent -> git push --force origin main",
    result: "main branch overwritten",
  },
  {
    action: "agent -> POST /deploy/staging",
    result: "staging deploy fired without approval",
  },
];

export function AgentWingConsole({
  state,
  dispatch,
  onUserTerminalLine,
}: {
  state: DemoState;
  dispatch: Dispatch<DemoEvent>;
  onUserTerminalLine?: (line: string) => void;
}) {
  const [activeTab, setActiveTab] = useState<ConsoleTab>("without");
  const [autoSwitched, setAutoSwitched] = useState(false);
  const [guideMessages, setGuideMessages] = useState<string[]>([]);
  const [latestInstruction, setLatestInstruction] = useState<string | null>(null);
  const runComplete = Boolean(state.summary);

  useEffect(() => {
    if (state.rollback !== "idle") setActiveTab("with");
  }, [state.rollback]);

  useEffect(() => {
    if (!state.withoutFrozen || autoSwitched) return;
    const id = setTimeout(() => {
      setActiveTab("with");
      setAutoSwitched(true);
    }, 2200);
    return () => clearTimeout(id);
  }, [autoSwitched, state.withoutFrozen]);

  function handleGuideMessage(message: string) {
    const normalized = message
      .replace("Runtime constraint added:", "Constraint active:")
      .replace("block deploy until tests pass", "block deploy until tests pass");
    setLatestInstruction(normalized);
    setGuideMessages((prev) => [
      ...prev,
      normalized,
      "User added runtime constraint",
    ]);
    onUserTerminalLine?.("Runtime constraint added");
  }

  const consoleMessage =
    state.rollback === "complete"
      ? "Rollback complete. Everything after RP-002 was reverted and logged."
      : state.wispMessage;

  return (
    <section className="flex h-full min-h-0 flex-col overflow-hidden rounded-lg border border-white/[0.08] bg-[#080b12]">
      <div className="shrink-0 border-b border-white/[0.08] bg-[#080b12]">
        <div className="flex items-center justify-between gap-2 px-3 py-2.5">
          <div className="flex min-w-0 items-center gap-2.5">
            <Mascot state={state.wispState} size={30} />
            <div className="min-w-0">
              <p className="text-sm font-semibold text-white">AgentWing Console</p>
              <p className="truncate text-[10.5px] text-slate-400">{consoleMessage}</p>
            </div>
          </div>
          {runComplete ? (
            <div className="shrink-0 rounded border border-emerald-400/20 bg-emerald-400/[0.07] px-2 py-1 text-[10px] font-medium text-emerald-200">
              Run complete &middot; audit receipt sealed
            </div>
          ) : (
            <div className="flex shrink-0 items-center gap-1.5">
              <button className="rounded border border-white/[0.08] px-2 py-1 text-[10px] text-slate-400 hover:text-slate-200">
                Pause
              </button>
              <button className="rounded border border-white/[0.08] px-2 py-1 text-[10px] text-slate-400 hover:text-slate-200">
                Stop
              </button>
            </div>
          )}
        </div>

        <div className="px-3 pb-3">
          <GuideInput onMessage={handleGuideMessage} />
          {latestInstruction && (
            <div className="mt-2 rounded border border-cyan-400/20 bg-cyan-400/[0.06] px-2.5 py-1.5">
              <p className="truncate text-[10.5px] text-cyan-100">{latestInstruction}</p>
            </div>
          )}
        </div>

        <div className="flex gap-1 px-3 pb-3">
          {(["without", "with"] as ConsoleTab[]).map((tab) => {
            const disabled = tab === "with" && !state.withoutFrozen && state.transactions.length === 0;
            return (
              <button
                key={tab}
                type="button"
                disabled={disabled}
                onClick={() => setActiveTab(tab)}
                className={`h-8 rounded border px-3 text-[11px] font-medium transition ${
                  activeTab === tab
                    ? "border-cyan-400/25 bg-cyan-400/[0.08] text-cyan-100"
                    : "border-white/[0.08] bg-white/[0.025] text-slate-400 hover:text-slate-200 disabled:cursor-not-allowed disabled:opacity-45"
                }`}
              >
                {tab === "without" ? "Without AgentWing" : "With AgentWing"}
              </button>
            );
          })}
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-3">
        {activeTab === "without" ? (
          <WithoutTab state={state} />
        ) : (
          <WithTab
            state={state}
            dispatch={dispatch}
            guideMessages={guideMessages}
          />
        )}
      </div>
    </section>
  );
}

function WithoutTab({ state }: { state: DemoState }) {
  const visibleCount = state.withoutFrozen
    ? DIRECT_STEPS.length
    : Math.min(state.withoutLines.length, DIRECT_STEPS.length);
  const nextStep = DIRECT_STEPS[visibleCount];
  const timelineRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    timelineRef.current?.scrollTo({ top: timelineRef.current.scrollHeight, behavior: "smooth" });
  }, [visibleCount]);

  return (
    <div className="space-y-3">
      <div className="rounded border border-red-400/20 bg-red-400/[0.04] px-3 py-2">
        <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-red-200">
          Direct agent execution
        </p>
        <p className="mt-1 text-[11px] leading-5 text-slate-400">
          Mini Code Agent is acting directly, no intercept layer.
        </p>
      </div>

      <div ref={timelineRef} className="max-h-[430px] space-y-2 overflow-y-auto pr-1">
        {DIRECT_STEPS.map((step, index) => {
          const visible = index < visibleCount;
          const live = index === visibleCount && !state.withoutFrozen;
          return (
            <div
              key={step.action}
              className={`rounded border px-3 py-2 transition ${
                visible
                  ? "incident-line border-red-400/20 bg-[#0b080a]"
                  : live
                    ? "border-amber-400/20 bg-amber-400/[0.04]"
                    : "border-white/[0.06] bg-white/[0.02] opacity-35"
              }`}
            >
              <div className="mb-1 flex items-center justify-between gap-3">
                <code className="font-mono text-[11px] text-slate-200">
                  {visible ? step.action : live ? nextStep?.action : "pending"}
                  {live && <span className="ml-1 inline-block h-3 w-1 bg-amber-200 cursor-blink" />}
                </code>
                <span className="font-mono text-[9px] text-slate-400">
                  10:31:{String(2 + index * 3).padStart(2, "0")}
                </span>
              </div>
              <p className={`text-[11px] leading-5 ${visible ? "text-red-100" : "text-slate-400"}`}>
                result - {visible ? step.result : live ? "executing..." : "waiting"}
              </p>
            </div>
          );
        })}
      </div>

      {state.withoutFrozen && (
        <div className="rounded border border-cyan-400/20 bg-cyan-400/[0.055] px-3 py-3">
          <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.14em] text-red-200">
            Unsafe run frozen.
          </p>
          <p className="mt-2 text-[11px] leading-5 text-cyan-100">
            Switching to AgentWing-controlled run...
          </p>
          <p className="text-[11px] leading-5 text-slate-300">
            Same Mini Code Agent. Same task. Control layer enabled.
          </p>
        </div>
      )}
    </div>
  );
}

function WithTab({
  state,
  dispatch,
  guideMessages,
}: {
  state: DemoState;
  dispatch: Dispatch<DemoEvent>;
  guideMessages: string[];
}) {
  const ledgerRef = useRef<HTMLDivElement>(null);
  const timelineRef = useRef<HTMLDivElement>(null);
  const timeline = useControlTimeline(state, guideMessages);

  useEffect(() => {
    ledgerRef.current?.scrollTo({ top: ledgerRef.current.scrollHeight, behavior: "smooth" });
  }, [state.transactions.length]);

  useEffect(() => {
    timelineRef.current?.scrollTo({ top: timelineRef.current.scrollHeight, behavior: "smooth" });
  }, [timeline.length]);

  return (
    <div className="space-y-3">
      {state.withoutFrozen && (
        <div className="rounded border border-cyan-400/18 bg-cyan-400/[0.045] px-3 py-2">
          <p className="text-[11px] leading-5 text-cyan-100">
            Same Mini Code Agent. Same task. AgentWing intercept layer enabled.
          </p>
        </div>
      )}

      <TransactionTimeline refEl={ledgerRef} transactions={state.transactions} dispatch={dispatch} />
      <ControlTimeline refEl={timelineRef} items={timeline} />
      <FeedbackContract contract={state.feedbackContract} />
      <PlanDiff lines={state.planLines} />
      <InfraCard state={state} />
    </div>
  );
}

function TransactionTimeline({
  refEl,
  transactions,
  dispatch,
}: {
  refEl: RefObject<HTMLDivElement | null>;
  transactions: Transaction[];
  dispatch: Dispatch<DemoEvent>;
}) {
  return (
    <section className="rounded border border-white/[0.08] bg-[#05070d]">
      <div className="border-b border-white/[0.08] px-3 py-2">
        <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-200">
          Transaction Ledger
        </p>
      </div>
      <div ref={refEl} className="max-h-[520px] overflow-y-auto p-3">
        {transactions.length === 0 ? (
          <p className="text-[11px] text-slate-400">Awaiting first AgentWing transaction...</p>
        ) : (
          <div className="space-y-0">
            {transactions.map((tx, index) => (
              <TimelineTransaction
                key={tx.id}
                tx={tx}
                dispatch={dispatch}
                isLast={index === transactions.length - 1}
              />
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

function TimelineTransaction({
  tx,
  dispatch,
  isLast,
}: {
  tx: Transaction;
  dispatch: Dispatch<DemoEvent>;
  isLast: boolean;
}) {
  const dotClass = {
    blocked: "border-red-400 bg-red-400",
    restore: "border-amber-300 bg-amber-300",
    sandboxed: "border-cyan-300 bg-cyan-300",
    approval: "border-amber-300 bg-amber-300",
    approved: "border-emerald-400 bg-emerald-400",
  }[tx.status];

  return (
    <div className="grid grid-cols-[18px_1fr] gap-3">
      <div className="relative flex justify-center">
        <span className={`mt-3 size-2.5 rounded-full border ${dotClass}`} />
        {!isLast && <span className="absolute bottom-0 top-7 w-px bg-cyan-300/18" />}
      </div>
      <div className="pb-3">
        <TransactionCard tx={tx} dispatch={dispatch} />
      </div>
    </div>
  );
}

function InfraCard({ state }: { state: DemoState }) {
  return (
    <section className="rounded border border-white/[0.08] bg-[#05070d] p-3">
      <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-300">
        Infra
      </p>
      <div className="mt-2 grid grid-cols-2 gap-2 text-[11px]">
        <span className="rounded border border-white/[0.07] bg-white/[0.025] px-2 py-1 text-slate-300">
          E2B sandbox active
        </span>
        <span className="rounded border border-white/[0.07] bg-white/[0.025] px-2 py-1 text-slate-300">
          Restore Points {state.restorePoints.length}
        </span>
        <span className="rounded border border-white/[0.07] bg-white/[0.025] px-2 py-1 text-slate-300">
          Replay {state.mode}
        </span>
        <span className="rounded border border-white/[0.07] bg-white/[0.025] px-2 py-1 text-slate-300">
          Audit {state.summary ? "sealed" : "pending"}
        </span>
      </div>
    </section>
  );
}

function useControlTimeline(state: DemoState, guideMessages: string[]) {
  return useMemo(() => {
    const items: Array<{ title: string; detail: string; tone: "red" | "green" | "amber" | "cyan" | "muted" }> = [];
    if (state.transactions.some((tx) => tx.id === "TX-001")) {
      items.push({
        title: "Mini Code Agent proposed reading .env",
        detail: "AgentWing blocked before file access",
        tone: "red",
      });
    }
    if (state.transactions.some((tx) => tx.id === "TX-002")) {
      items.push({
        title: "AgentWing redirected Mini Code Agent",
        detail: "Safer path: use .env.example",
        tone: "cyan",
      });
    }
    if (state.transactions.some((tx) => tx.id === "TX-003")) {
      items.push({
        title: "Mini Code Agent edited boxArenaConfig.ts",
        detail: "AgentWing captured Restore Point RP-002",
        tone: "amber",
      });
    }
    if (state.transactions.some((tx) => tx.id === "TX-004")) {
      items.push({
        title: "AgentWing replayed tests in E2B",
        detail: "Result: passed",
        tone: "green",
      });
    }
    if (state.transactions.some((tx) => tx.id === "TX-005")) {
      items.push({
        title: "Mini Code Agent attempted force push",
        detail: "AgentWing blocked and returned safer branch plan",
        tone: "red",
      });
    }
    if (state.transactions.some((tx) => tx.id === "TX-006")) {
      items.push({
        title: "Deploy requested",
        detail: "AgentWing held for approval",
        tone: "amber",
      });
    }
    if (state.rollback !== "idle") {
      items.push({
        title: "Rollback requested",
        detail: "Restore Point rewinds preview, diff, and files",
        tone: "amber",
      });
    }
    if (guideMessages.length > 0) {
      const latest = guideMessages[guideMessages.length - 2] ?? guideMessages[guideMessages.length - 1];
      items.push({
        title: "User added runtime constraint",
        detail: `${latest ?? "Constraint active"} - AgentWing updated approval policy`,
        tone: "cyan",
      });
    }
    return items;
  }, [guideMessages, state.rollback, state.transactions]);
}

function ControlTimeline({
  refEl,
  items,
}: {
  refEl: RefObject<HTMLDivElement | null>;
  items: Array<{ title: string; detail: string; tone: "red" | "green" | "amber" | "cyan" | "muted" }>;
}) {
  const toneClass = {
    red: "border-red-400/20 bg-red-400/[0.04] text-red-100",
    green: "border-emerald-400/20 bg-emerald-400/[0.04] text-emerald-100",
    amber: "border-amber-400/20 bg-amber-400/[0.04] text-amber-100",
    cyan: "border-cyan-400/20 bg-cyan-400/[0.04] text-cyan-100",
    muted: "border-white/[0.08] bg-white/[0.02] text-slate-300",
  };

  return (
    <section className="rounded border border-white/[0.08] bg-[#05070d]">
      <div className="border-b border-white/[0.08] px-3 py-2">
        <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-400">
          Control Timeline
        </p>
      </div>
      <div ref={refEl} className="max-h-[260px] space-y-1.5 overflow-y-auto p-2">
        {items.length === 0 ? (
          <p className="px-1 py-2 text-[11px] text-slate-400">Waiting for AgentWing decisions...</p>
        ) : (
          items.map((item, index) => (
            <div key={`${item.title}-${index}`} className={`rounded border px-2.5 py-2 ${toneClass[item.tone]}`}>
              <p className="text-[11px] font-medium">{item.title}</p>
              <p className="mt-0.5 text-[10.5px] text-slate-400">{item.detail}</p>
            </div>
          ))
        )}
      </div>
    </section>
  );
}
