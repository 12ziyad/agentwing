"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { CheckCircle2, XCircle } from "lucide-react";

export function RunListApprovalActions({ runId }: { runId: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState<"approve" | "reject" | null>(null);

  async function resolve(action: "approve" | "reject") {
    setBusy(action);
    try {
      await fetch(`/api/v1/action-runs/${runId}/${action}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: `${action} from runs list.` }),
      });
      router.refresh();
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="flex flex-wrap items-center justify-end gap-2">
      <button
        type="button"
        onClick={() => resolve("approve")}
        disabled={Boolean(busy)}
        className="inline-flex items-center gap-1.5 rounded border border-emerald-300/25 bg-emerald-300/[0.08] px-2 py-1.5 text-[11px] font-semibold text-emerald-100 transition hover:bg-emerald-300/[0.14] disabled:opacity-60"
        title="Approve and continue this run"
      >
        <CheckCircle2 className="size-3.5" />
        {busy === "approve" ? "Approving" : "Approve & Run"}
      </button>
      <button
        type="button"
        onClick={() => resolve("reject")}
        disabled={Boolean(busy)}
        className="inline-flex items-center gap-1.5 rounded border border-red-300/25 bg-red-400/[0.08] px-2 py-1.5 text-[11px] font-semibold text-red-100 transition hover:bg-red-400/[0.14] disabled:opacity-60"
        title="Reject this run"
      >
        <XCircle className="size-3.5" />
        {busy === "reject" ? "Rejecting" : "Reject"}
      </button>
      <Link href={`/dashboard/runs/${runId}`} className="rounded border border-white/[0.1] px-2 py-1.5 text-[11px] font-semibold text-cyan-100 transition hover:text-white">
        View
      </Link>
    </div>
  );
}
