"use client";

import { useEffect, useState } from "react";
import { CheckCircle2, Clock, XCircle } from "lucide-react";
import type { ApprovalRecord } from "@/lib/agentwingStore";

const statusConfig = {
  pending: { label: "Pending", cls: "border-amber-300/25 bg-amber-300/[0.06] text-amber-200", Icon: Clock },
  approved: { label: "Approved", cls: "border-emerald-300/25 bg-emerald-300/[0.06] text-emerald-200", Icon: CheckCircle2 },
  rejected: { label: "Rejected", cls: "border-red-300/25 bg-red-300/[0.06] text-red-200", Icon: XCircle },
  expired: { label: "Expired", cls: "border-slate-300/15 bg-slate-300/[0.04] text-slate-400", Icon: Clock },
};

const riskCls: Record<string, string> = {
  low: "text-emerald-200",
  medium: "text-amber-200",
  high: "text-red-200",
  critical: "text-red-300 font-semibold",
};

export default function ApprovalsPage() {
  const [approvals, setApprovals] = useState<ApprovalRecord[]>([]);
  const [tab, setTab] = useState<string>("pending");
  const [loading, setLoading] = useState(true);
  const [resolving, setResolving] = useState<string | null>(null);

  async function load(status?: string) {
    setLoading(true);
    try {
      const res = await fetch(`/api/v1/approvals${status ? `?status=${status}` : ""}`);
      if (res.ok) {
        const data = (await res.json()) as { approvals: ApprovalRecord[] };
        setApprovals(data.approvals);
      }
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void load(tab === "all" ? undefined : tab); }, [tab]);

  async function resolve(approvalId: string, status: "approved" | "rejected") {
    setResolving(approvalId);
    try {
      const res = await fetch(`/api/v1/approvals/${approvalId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      if (res.ok) await load(tab === "all" ? undefined : tab);
    } finally {
      setResolving(null);
    }
  }

  const tabs = [
    { key: "pending", label: "Pending" },
    { key: "approved", label: "Approved" },
    { key: "rejected", label: "Rejected" },
    { key: "all", label: "All" },
  ];

  return (
    <div className="space-y-6">
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-amber-200">Approvals</p>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight text-white">Agent action approvals</h1>
        <p className="mt-1 text-sm text-slate-400">
          When a policy returns <span className="font-mono text-amber-200">approval_required</span>, the proposed action appears here for human review.
        </p>
      </div>

      <div className="flex gap-1 border-b border-white/[0.08] pb-0">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`px-4 py-2 text-sm font-medium transition ${tab === t.key ? "border-b-2 border-cyan-300 text-white" : "text-slate-400 hover:text-slate-200"}`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="py-12 text-center text-sm text-slate-400">Loading…</div>
      ) : approvals.length === 0 ? (
        <div className="rounded-md border border-white/[0.08] bg-[#080b12] p-10 text-center">
          <CheckCircle2 className="mx-auto size-10 text-slate-600" />
          <p className="mt-4 text-sm font-semibold text-slate-300">No {tab === "all" ? "" : tab} approvals</p>
          <p className="mt-2 text-xs text-slate-500">
            Approvals appear when a policy returns <span className="font-mono">approval_required</span>.
            Create a custom policy with that decision to test the flow.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {approvals.map((a) => {
            const cfg = statusConfig[a.status] ?? statusConfig.pending;
            const Icon = cfg.Icon;
            const action = a.actionJson as Record<string, unknown>;
            return (
              <div key={a.approvalId} className="rounded-md border border-white/[0.08] bg-[#080b12] p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className={`inline-flex items-center gap-1 rounded border px-2 py-0.5 text-xs font-semibold ${cfg.cls}`}>
                        <Icon className="size-3" />
                        {cfg.label}
                      </span>
                      <span className={`text-xs font-semibold ${riskCls[a.risk] ?? "text-slate-300"}`}>
                        {a.risk}
                      </span>
                      {a.policy && (
                        <span className="rounded border border-white/[0.08] px-2 py-0.5 font-mono text-xs text-slate-400">
                          {a.policy.length > 40 ? `${a.policy.slice(0, 40)}…` : a.policy}
                        </span>
                      )}
                    </div>
                    <div className="mt-3 grid gap-1 text-xs text-slate-400 sm:grid-cols-2 lg:grid-cols-4">
                      <span><span className="text-slate-500">Action:</span> {String(action.actionType ?? "—")}</span>
                      <span><span className="text-slate-500">Tool:</span> {String(action.tool ?? "—")}</span>
                      <span><span className="text-slate-500">Target:</span> {String(action.target ?? "—").slice(0, 40) || "—"}</span>
                      <span><span className="text-slate-500">Agent:</span> {a.requestedByAgent ?? "—"}</span>
                    </div>
                    {a.reason && (
                      <p className="mt-2 text-xs leading-5 text-slate-400">{a.reason}</p>
                    )}
                    <p className="mt-2 font-mono text-[10px] text-slate-600">{a.approvalId} · {new Date(a.createdAt).toLocaleString()}</p>
                  </div>
                  {a.status === "pending" && (
                    <div className="flex shrink-0 gap-2">
                      <button
                        onClick={() => resolve(a.approvalId, "approved")}
                        disabled={resolving === a.approvalId}
                        className="rounded border border-emerald-300/25 bg-emerald-300/[0.08] px-3 py-1.5 text-xs font-semibold text-emerald-200 transition hover:bg-emerald-300/[0.14] disabled:opacity-50"
                      >
                        Approve
                      </button>
                      <button
                        onClick={() => resolve(a.approvalId, "rejected")}
                        disabled={resolving === a.approvalId}
                        className="rounded border border-red-300/25 bg-red-300/[0.06] px-3 py-1.5 text-xs font-semibold text-red-200 transition hover:bg-red-300/[0.12] disabled:opacity-50"
                      >
                        Reject
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
