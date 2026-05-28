"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { AlertTriangle, CheckCircle2, XCircle } from "lucide-react";

export function RunApprovalControls({
  runId,
  summary,
  risk,
  policy,
  proposed,
}: {
  runId: string;
  summary?: string;
  risk?: string;
  policy?: string;
  proposed?: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState<"approve" | "reject" | null>(null);
  const [error, setError] = useState("");

  async function resolve(action: "approve" | "reject") {
    setBusy(action);
    setError("");
    try {
      const response = await fetch(`/api/v1/action-runs/${runId}/${action}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: action === "approve" ? "Approved from run detail." : "Rejected from run detail." }),
      });
      const data = (await response.json().catch(() => ({}))) as { error?: string };
      if (!response.ok) {
        setError(data.error ?? "Unable to update run.");
        return;
      }
      router.refresh();
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="rounded-md border border-amber-300/20 bg-amber-300/[0.04] p-4">
      <div className="flex items-start gap-3">
        <AlertTriangle className="mt-0.5 size-4 shrink-0 text-amber-200" />
        <div className="min-w-0">
          <p className="text-sm font-semibold text-amber-100">Human approval required</p>
          {summary && <p className="mt-1 break-words text-sm font-medium text-white">{summary}</p>}
        </div>
      </div>
      <p className="mt-1 text-xs leading-5 text-slate-400">
        This run is paused. Approving continues the guarded path inside this run; rejecting seals it without execution.
      </p>
      <div className="mt-4 grid gap-3 md:grid-cols-3">
        {risk && <ApprovalField label="Risk" value={risk} />}
        {policy && <ApprovalField label="Policy" value={policy} mono />}
        {proposed && <ApprovalField label="Target / command" value={proposed} mono />}
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => resolve("approve")}
          disabled={Boolean(busy)}
          className="inline-flex items-center gap-2 rounded-md border border-emerald-300/25 bg-emerald-300/[0.1] px-3 py-2 text-xs font-semibold text-emerald-100 transition hover:bg-emerald-300/[0.16] disabled:opacity-60"
        >
          <CheckCircle2 className="size-4" />
          {busy === "approve" ? "Approving..." : "Approve & Run"}
        </button>
        <button
          type="button"
          onClick={() => resolve("reject")}
          disabled={Boolean(busy)}
          className="inline-flex items-center gap-2 rounded-md border border-red-300/25 bg-red-400/[0.08] px-3 py-2 text-xs font-semibold text-red-100 transition hover:bg-red-400/[0.14] disabled:opacity-60"
        >
          <XCircle className="size-4" />
          {busy === "reject" ? "Rejecting..." : "Reject"}
        </button>
      </div>
      {error && <p className="mt-3 text-xs text-red-200">{error}</p>}
    </div>
  );
}

function ApprovalField({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="min-w-0 rounded border border-white/[0.06] bg-[#05070d] p-3">
      <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-500">{label}</p>
      <p className={mono ? "mt-1 break-all font-mono text-xs text-cyan-100" : "mt-1 text-sm font-semibold text-white"}>
        {value}
      </p>
    </div>
  );
}
