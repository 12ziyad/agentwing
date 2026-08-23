"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { CheckCircle2, XCircle } from "lucide-react";

/**
 * Approve or reject a held action.
 *
 * Reports failures rather than swallowing them. The previous version of this
 * control fired the request and refreshed regardless of the response, so a
 * rejected approval that failed server-side looked identical to one that
 * succeeded — the row simply reappeared and the operator had no idea why.
 */
export function ApprovalDecisionButtons({ runId }: { runId: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState<"approve" | "reject" | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function resolve(action: "approve" | "reject") {
    setBusy(action);
    setError(null);
    try {
      const response = await fetch(`/api/v1/action-runs/${runId}/${action}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: `${action === "approve" ? "Approved" : "Rejected"} from the approvals queue.` }),
      });

      if (!response.ok) {
        const body = (await response.json().catch(() => ({}))) as { error?: string };
        setError(body.error ?? `Could not ${action} this action (${response.status}).`);
        return;
      }

      router.refresh();
    } catch {
      setError("The request could not be sent. Check your connection and try again.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="flex flex-col items-stretch gap-2">
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => resolve("approve")}
          disabled={busy !== null}
          className="inline-flex flex-1 items-center justify-center gap-1.5 rounded border border-emerald-300/25 bg-emerald-300/[0.08] px-3 py-1.5 text-xs font-semibold text-emerald-200 transition hover:bg-emerald-300/[0.14] disabled:cursor-not-allowed disabled:opacity-50"
        >
          <CheckCircle2 className="size-3.5" aria-hidden />
          {busy === "approve" ? "Approving…" : "Approve"}
        </button>
        <button
          type="button"
          onClick={() => resolve("reject")}
          disabled={busy !== null}
          className="inline-flex flex-1 items-center justify-center gap-1.5 rounded border border-rose-300/25 bg-rose-300/[0.08] px-3 py-1.5 text-xs font-semibold text-rose-200 transition hover:bg-rose-300/[0.14] disabled:cursor-not-allowed disabled:opacity-50"
        >
          <XCircle className="size-3.5" aria-hidden />
          {busy === "reject" ? "Rejecting…" : "Reject"}
        </button>
      </div>
      {error ? (
        <p role="alert" className="max-w-[18rem] text-[11px] leading-5 text-rose-300">
          {error}
        </p>
      ) : null}
    </div>
  );
}
