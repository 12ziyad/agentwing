import type { Dispatch, ReactNode } from "react";
import type { DemoEvent, Transaction } from "@/lib/demoTypes";
import { ApprovalBlock } from "./ApprovalBlock";

const STATUS_CFG = {
  blocked: {
    label: "BLOCKED",
    border: "border-red-400/25",
    badge: "bg-red-400/10 text-red-300 border-red-400/25",
  },
  restore: {
    label: "RESTORE POINT",
    border: "border-amber-400/25",
    badge: "bg-amber-400/10 text-amber-200 border-amber-400/25",
  },
  sandboxed: {
    label: "SANDBOXED",
    border: "border-cyan-400/20",
    badge: "bg-cyan-400/10 text-cyan-200 border-cyan-400/25",
  },
  approval: {
    label: "APPROVAL",
    border: "border-amber-400/25",
    badge: "bg-amber-400/10 text-amber-200 border-amber-400/25",
  },
  approved: {
    label: "APPROVED",
    border: "border-emerald-400/25",
    badge: "bg-emerald-400/10 text-emerald-300 border-emerald-400/25",
  },
};

const RISK_COLOR = { high: "text-red-300", medium: "text-amber-300", low: "text-emerald-300" };

export function TransactionCard({ tx, dispatch }: { tx: Transaction; dispatch: Dispatch<DemoEvent> }) {
  const cfg = STATUS_CFG[tx.status] ?? STATUS_CFG.approved;

  return (
    <article className={`tx-card rounded-md border ${cfg.border} bg-[#070a11] p-3`}>
      <header className="mb-3 flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="flex flex-wrap items-center gap-1.5 font-mono text-[12px] font-semibold text-slate-100">
            <span>{tx.id}</span>
            <span className="text-slate-500">&middot;</span>
            <span className="truncate">{tx.action}</span>
          </p>
        </div>
        <span className={`shrink-0 rounded border px-2 py-0.5 text-[9px] font-semibold uppercase ${cfg.badge}`}>
          {cfg.label}
        </span>
      </header>

      <div className="space-y-2">
        <TransactionSection kind="agent" title="Mini Code Agent proposed">
          <pre className="max-h-28 overflow-auto rounded border border-white/[0.06] bg-black/40 px-2 py-1.5 font-mono text-[10px] leading-4 text-slate-300">
            {JSON.stringify(tx.toolCall, null, 2)}
          </pre>
        </TransactionSection>

        <TransactionSection kind="agentwing" title="AgentWing decision">
          <p className="text-[11px] font-medium text-slate-100">{decisionText(tx)}</p>
          <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1">
            <span className="text-[10px] text-slate-400">policy:</span>
            <code className="font-mono text-[10px] text-slate-200">{tx.policy}</code>
            {tx.risk && (
              <span className={`text-[10px] font-semibold uppercase ${RISK_COLOR[tx.risk]}`}>
                risk: {tx.risk}
              </span>
            )}
          </div>
          {tx.status === "sandboxed" && (
            <p className="mt-1 text-[10.5px] text-emerald-200">
              E2B replayed the command in an isolated sandbox.
            </p>
          )}
        </TransactionSection>

          {tx.feedback && (
          <TransactionSection kind="feedback" title="Feedback returned">
            <p className="text-[11px] leading-5 text-cyan-100">{tx.feedback}</p>
          </TransactionSection>
        )}

        {tx.receiptId && (
          <div className="rounded border border-white/[0.06] bg-white/[0.02] px-2 py-1.5">
            <span className="text-[10px] text-slate-400">receipt:</span>{" "}
            <code className="font-mono text-[10px] text-cyan-100">{tx.receiptId}</code>
          </div>
        )}

        {tx.meta.length > 0 && (
          <div className="flex flex-wrap gap-x-3 gap-y-0.5">
            {tx.meta.map((m) => (
              <span key={m} className="text-[9.5px] text-slate-400">{m}</span>
            ))}
          </div>
        )}
      </div>

      {tx.status === "approval" && tx.approvalState && (
        <ApprovalBlock txId={tx.id} approvalState={tx.approvalState} dispatch={dispatch} />
      )}
      {tx.status === "approved" && tx.approvalState === "approved" && (
        <div className="mt-2 text-[11px] text-emerald-300">
          Approved. Audit event immutably recorded.
        </div>
      )}
    </article>
  );
}

function decisionText(tx: Transaction) {
  if (tx.status === "blocked" && tx.policy.includes("force")) return "blocked before shell execution";
  if (tx.status === "blocked") return "blocked before file access";
  if (tx.status === "restore") return "Restore Point captured before write";
  if (tx.status === "sandboxed") return "replayed in E2B before continuing";
  if (tx.status === "approval") return "held for human approval";
  if (tx.status === "approved") return "approved and audit receipt sealed";
  return tx.status;
}

function TransactionSection({
  kind,
  title,
  children,
}: {
  kind: "agent" | "agentwing" | "feedback";
  title: string;
  children: ReactNode;
}) {
  return (
    <section className="rounded border border-white/[0.06] bg-white/[0.02] px-2 py-2">
      <div className="mb-1.5 flex items-center gap-1.5">
        <ActorBadge kind={kind} label={title} />
      </div>
      {children}
    </section>
  );
}

function ActorBadge({ kind, label }: { kind: "agent" | "agentwing" | "feedback"; label: string }) {
  const cls = {
    agent: "border-slate-400/25 bg-slate-300/[0.08] text-slate-100",
    agentwing: "border-cyan-300/25 bg-cyan-300/[0.08] text-cyan-100",
    feedback: "border-amber-300/25 bg-amber-300/[0.08] text-amber-100",
  }[kind];

  return (
    <span className={`inline-flex items-center gap-1 rounded border px-1.5 py-0.5 text-[9.5px] font-semibold uppercase tracking-[0.08em] ${cls}`}>
      <ActorIcon kind={kind} />
      {label}
    </span>
  );
}

function ActorIcon({ kind }: { kind: "agent" | "agentwing" | "feedback" }) {
  if (kind === "agent") {
    return (
      <svg aria-hidden="true" viewBox="0 0 16 16" className="size-3" fill="none">
        <rect x="4" y="5" width="8" height="6" rx="1.5" stroke="currentColor" strokeWidth="1.4" />
        <path d="M8 5V2.8M6 8h.01M10 8h.01M5 13h6" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
      </svg>
    );
  }

  if (kind === "agentwing") {
    return (
      <svg aria-hidden="true" viewBox="0 0 16 16" className="size-3" fill="none">
        <path d="M8 2.5 12.5 4v3.4c0 2.8-1.8 4.8-4.5 6.1-2.7-1.3-4.5-3.3-4.5-6.1V4L8 2.5Z" stroke="currentColor" strokeWidth="1.3" />
        <path d="M5.2 8.2c1.4-.1 2.3-.8 2.8-2.1.5 1.3 1.4 2 2.8 2.1" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
      </svg>
    );
  }

  return (
    <svg aria-hidden="true" viewBox="0 0 16 16" className="size-3" fill="none">
      <path d="M3 4.5h10v7H3z" stroke="currentColor" strokeWidth="1.3" />
      <path d="M5 7h4M5 9.5h6" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
    </svg>
  );
}
