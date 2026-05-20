"use client";

import { useState } from "react";
import type { SummaryData, Transaction } from "@/lib/demoTypes";

type SummaryProps = {
  summary: SummaryData;
  transactions: Transaction[];
  onRollback: (() => void) | null;
};

const TX_STATUS_BADGE: Record<string, string> = {
  blocked: "border-red-400/25 bg-red-400/10 text-red-300",
  restore: "border-amber-400/25 bg-amber-400/10 text-amber-200",
  sandboxed: "border-cyan-400/25 bg-cyan-400/10 text-cyan-200",
  approval: "border-amber-400/25 bg-amber-400/10 text-amber-200",
  approved: "border-emerald-400/25 bg-emerald-400/10 text-emerald-300",
};

export function Summary({ summary, transactions, onRollback }: SummaryProps) {
  const [copied, setCopied] = useState(false);
  const [showReport, setShowReport] = useState(false);

  function copyAudit() {
    const payload = {
      run_id: `aw_${Date.now()}`,
      timestamp: new Date().toISOString(),
      task: "Add an extra box, run tests, and prepare staging deploy",
      transactions: transactions.map((tx) => ({
        id: tx.id,
        action: tx.action,
        status: tx.status,
        policy: tx.policy,
        risk: tx.risk,
        approval: tx.approvalState,
      })),
      metrics: summary.metrics,
    };
    navigator.clipboard
      .writeText(JSON.stringify(payload, null, 2))
      .then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 2200);
      })
      .catch(() => {});
  }

  return (
    <section className="fade-in mt-3 rounded-lg border border-white/[0.08] bg-[#080b12] p-4">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-white/[0.08] pb-4">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-300">
            Test run complete
          </p>
          <h2 className="mt-1 text-xl font-semibold tracking-tight text-white">
            Same agent. Same task. Controlled outcome.
          </h2>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={copyAudit}
            className="rounded border border-cyan-400/25 bg-cyan-400/10 px-3 py-1.5 text-xs font-semibold text-cyan-200 transition hover:bg-cyan-400/15"
          >
            {copied ? "Copied" : "Copy audit JSON"}
          </button>
          {onRollback && (
            <button
              onClick={onRollback}
              className="rounded border border-amber-400/25 bg-amber-400/10 px-3 py-1.5 text-xs font-semibold text-amber-200 transition hover:bg-amber-400/15"
            >
              Rollback last change
            </button>
          )}
          <button
            onClick={() => setShowReport((open) => !open)}
            className="rounded border border-white/[0.1] bg-white/[0.04] px-3 py-1.5 text-xs font-semibold text-slate-300 transition hover:bg-white/[0.07]"
          >
            Read report
          </button>
        </div>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-[1fr_1fr]">
        <OutcomeList title="Without AgentWing" tone="red" items={summary.withoutOutcomes} />
        <OutcomeList title="With AgentWing" tone="green" items={summary.withOutcomes} />
      </div>

      <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
        {Object.entries(summary.metrics).map(([k, v]) => (
          <div key={k} className="rounded border border-white/[0.08] bg-[#05070d] px-3 py-2">
            <div className="font-mono text-sm font-semibold text-slate-100">{v}</div>
            <div className="mt-0.5 text-[10px] uppercase tracking-[0.12em] text-slate-400">{k}</div>
          </div>
        ))}
      </div>

      <div className="mt-4 rounded border border-white/[0.08] bg-[#05070d] p-3">
        <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-300">
          Seven-value proof
        </p>
        <div className="flex flex-wrap gap-2">
          {[
            "Control",
            "Observable",
            "Reversible",
            "Auditable",
            "Sandboxed",
            "Feedback-driven",
            "Human-guided",
          ].map((value) => (
            <span key={value} className="rounded border border-white/[0.08] bg-white/[0.03] px-2.5 py-1 text-[11px] text-slate-300">
              {value}
            </span>
          ))}
        </div>
      </div>

      <div className="mt-4 overflow-hidden rounded border border-white/[0.08]">
        <div className="border-b border-white/[0.08] bg-[#0c1019] px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-300">
          Transaction audit log
        </div>
        <div className="divide-y divide-white/[0.06]">
          {transactions.map((tx) => (
            <div key={tx.id} className="grid gap-2 px-3 py-2 text-[11px] sm:grid-cols-[4.5rem_1fr_auto]">
              <span className="font-mono text-slate-400">{tx.id}</span>
              <span className="text-slate-300">{tx.action}</span>
              <span className={`w-fit rounded border px-2 py-0.5 text-[9px] font-semibold uppercase ${TX_STATUS_BADGE[tx.status] ?? TX_STATUS_BADGE.approved}`}>
                {tx.status}
              </span>
            </div>
          ))}
        </div>
      </div>

      <p className="mt-4 max-w-3xl text-[11px] leading-5 text-slate-400">
        External side effects such as deploys and API calls cannot be rolled back. AgentWing
        approval-gates them and records signed audit events. Restore Points cover files and code.
      </p>

      {showReport && <RunReport transactions={transactions} />}
    </section>
  );
}

function OutcomeList({ title, tone, items }: { title: string; tone: "red" | "green"; items: string[] }) {
  const dot = tone === "red" ? "bg-red-400" : "bg-emerald-400";
  const border = tone === "red" ? "border-red-400/20" : "border-emerald-400/20";

  return (
    <div className={`rounded border ${border} bg-[#05070d] p-3`}>
      <p className="mb-3 text-sm font-semibold text-slate-100">{title}</p>
      <ul className="space-y-2">
        {items.map((item) => (
          <li key={item} className="flex items-start gap-2 text-[12px] leading-5 text-slate-300">
            <span className={`mt-2 size-1.5 shrink-0 rounded-full ${dot}`} />
            {item}
          </li>
        ))}
      </ul>
    </div>
  );
}

function RunReport({ transactions }: { transactions: Transaction[] }) {
  return (
    <section className="mt-5 rounded-lg border border-cyan-400/15 bg-[#05070d] p-4">
      <div className="border-b border-white/[0.08] pb-3">
        <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-cyan-200">
          AgentWing Run Report
        </p>
        <h3 className="mt-1 text-lg font-semibold text-white">Full control and audit record</h3>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <ReportList
          title="1. What the Mini Code Agent tried"
          items={[
            "read .env",
            "edit boxArenaConfig.ts",
            "run npm test",
            "git push --force",
            "POST /deploy/staging",
          ]}
        />
        <ReportList
          title="2. What AgentWing controlled"
          items={[
            "blocked .env access",
            "redirected to .env.example",
            "captured Restore Point RP-002",
            "replayed tests in E2B",
            "blocked force push",
            "held deploy for approval",
            "sealed audit receipt",
          ]}
        />
      </div>

      <div className="mt-4 rounded border border-white/[0.08] bg-[#080b12] p-3">
        <p className="mb-3 text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-300">
          3. Diagram
        </p>
        <div className="grid gap-2 font-mono text-[12px] text-slate-200 sm:grid-cols-[1fr_auto_1fr_auto_1fr_auto_1fr] sm:items-center">
          <span className="rounded border border-white/[0.08] bg-white/[0.03] px-3 py-2">Mini Code Agent</span>
          <span className="text-cyan-200">proposes action</span>
          <span className="rounded border border-cyan-400/20 bg-cyan-400/[0.06] px-3 py-2 text-cyan-100">AgentWing</span>
          <span className="text-cyan-200">policy / Restore Point / feedback</span>
          <span className="rounded border border-white/[0.08] bg-white/[0.03] px-3 py-2">E2B Sandbox</span>
          <span className="text-cyan-200">test replay</span>
          <span className="rounded border border-emerald-400/20 bg-emerald-400/[0.06] px-3 py-2 text-emerald-100">Audit Receipt</span>
        </div>
      </div>

      <div className="mt-4 overflow-hidden rounded border border-white/[0.08]">
        <div className="border-b border-white/[0.08] bg-[#0c1019] px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-300">
          4. Transaction receipt
        </div>
        <div className="divide-y divide-white/[0.06]">
          {transactions.map((tx) => (
            <div key={tx.id} className="grid gap-2 px-3 py-2 text-[11px] sm:grid-cols-[4.5rem_1fr_1fr_auto]">
              <span className="font-mono text-slate-400">{tx.id}</span>
              <span className="text-slate-200">{tx.action}</span>
              <span className="font-mono text-slate-300">{tx.policy}</span>
              <span className={`w-fit rounded border px-2 py-0.5 text-[9px] font-semibold uppercase ${TX_STATUS_BADGE[tx.status] ?? TX_STATUS_BADGE.approved}`}>
                {tx.status}
              </span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function ReportList({ title, items }: { title: string; items: string[] }) {
  return (
    <div className="rounded border border-white/[0.08] bg-[#080b12] p-3">
      <p className="mb-3 text-sm font-semibold text-slate-100">{title}</p>
      <ul className="space-y-2">
        {items.map((item) => (
          <li key={item} className="flex items-start gap-2 text-[12px] leading-5 text-slate-300">
            <span className="mt-2 size-1.5 shrink-0 rounded-full bg-cyan-300" />
            {item}
          </li>
        ))}
      </ul>
    </div>
  );
}
