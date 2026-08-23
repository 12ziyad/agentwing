import Link from "next/link";
import { listActionRuns, listApprovals } from "@/lib/agentwingStore";
import { requireDashboardSession } from "@/lib/dashboardSession";
import { ApprovalDecisionButtons } from "@/components/dashboard/ApprovalDecisionButtons";
import type { ActionRun } from "@/lib/agentwingTypes";

export const dynamic = "force-dynamic";

/**
 * The approvals queue.
 *
 * This page was a bare redirect to the runs list, so the entire approvals
 * subsystem — its table, its store functions and its two API routes — was
 * rendered by nothing. Approval is the product's most consequential control;
 * it deserves a screen that shows what is waiting and what was decided.
 *
 * Approvals are shown with the run they gate, because a decision needs the
 * action in front of it. An approver who cannot see what they are approving is
 * not providing oversight.
 */

const STATUS_STYLE: Record<string, string> = {
  pending: "border-amber-300/25 bg-amber-300/[0.07] text-amber-200",
  approved: "border-emerald-300/25 bg-emerald-300/[0.07] text-emerald-200",
  rejected: "border-rose-300/25 bg-rose-300/[0.07] text-rose-200",
  expired: "border-slate-400/20 bg-slate-400/[0.06] text-slate-400",
};

const RISK_STYLE: Record<string, string> = {
  critical: "text-rose-300",
  high: "text-orange-300",
  medium: "text-amber-300",
  low: "text-slate-400",
};

function actionSummary(actionJson: Record<string, unknown>): string {
  const pick = (key: string) => (typeof actionJson[key] === "string" ? (actionJson[key] as string) : undefined);
  return pick("command") || pick("target") || pick("description") || pick("actionType") || "Unknown action";
}

function relative(iso: string): string {
  const seconds = Math.max(0, Math.round((Date.now() - Date.parse(iso)) / 1000));
  if (seconds < 60) return `${seconds}s ago`;
  if (seconds < 3600) return `${Math.round(seconds / 60)}m ago`;
  if (seconds < 86_400) return `${Math.round(seconds / 3600)}h ago`;
  return `${Math.round(seconds / 86_400)}d ago`;
}

export default async function ApprovalsPage() {
  const { workspaceId } = await requireDashboardSession();

  const [approvals, runs] = await Promise.all([
    listApprovals(workspaceId),
    listActionRuns(workspaceId, undefined, 200),
  ]);

  // Index once rather than scanning the run list per approval.
  const runByApprovalId = new Map<string, ActionRun>();
  for (const run of runs) {
    if (run.approvalId) runByApprovalId.set(run.approvalId, run);
  }

  const pending = approvals.filter((a) => a.status === "pending");
  const resolved = approvals.filter((a) => a.status !== "pending").slice(0, 50);

  return (
    <div className="space-y-6">
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">Approvals</p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight text-white">
          {pending.length > 0 ? `${pending.length} awaiting review` : "Nothing awaiting review"}
        </h1>
        <p className="mt-1 max-w-2xl text-sm text-slate-400">
          Actions AgentWing held because they need a human. The agent that proposed an action cannot approve it — that
          separation is why this queue exists.
        </p>
      </div>

      {pending.length === 0 ? (
        <div className="rounded-md border border-white/[0.08] bg-[#080b12] p-8 text-center">
          <p className="text-sm text-slate-300">No actions are waiting for approval.</p>
          <p className="mx-auto mt-2 max-w-md text-xs leading-6 text-slate-500">
            Deploys, payments, external messages and any action no policy classifies will appear here when an agent
            proposes one.
          </p>
          <Link
            href="/dashboard/policies"
            className="mt-5 inline-block rounded border border-white/[0.12] px-4 py-2 text-xs font-semibold text-slate-200 transition hover:text-white"
          >
            Review policies
          </Link>
        </div>
      ) : (
        <div className="space-y-3">
          {pending.map((approval) => {
            const run = runByApprovalId.get(approval.approvalId);
            const summary = actionSummary(approval.actionJson);
            return (
              <section
                key={approval.approvalId}
                className="rounded-md border border-amber-300/20 bg-[#080b12] p-5"
              >
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className={`rounded border px-2 py-0.5 font-mono text-[10px] ${STATUS_STYLE.pending}`}>
                        pending
                      </span>
                      <span className={`font-mono text-[11px] ${RISK_STYLE[approval.risk] ?? "text-slate-400"}`}>
                        risk: {approval.risk}
                      </span>
                      <span className="font-mono text-[11px] text-slate-600">{relative(approval.createdAt)}</span>
                    </div>

                    <p className="mt-3 break-all font-mono text-sm text-cyan-100">{summary}</p>

                    {approval.reason ? (
                      <p className="mt-2 max-w-2xl text-[13px] leading-6 text-slate-400">{approval.reason}</p>
                    ) : null}

                    <p className="mt-3 font-mono text-[11px] text-slate-600">
                      {approval.policy ? `${approval.policy} · ` : ""}
                      {approval.requestedByAgent ? `agent: ${approval.requestedByAgent} · ` : ""}
                      {approval.approvalId}
                    </p>
                  </div>

                  <div className="flex shrink-0 flex-col items-stretch gap-2">
                    {run ? (
                      <ApprovalDecisionButtons runId={run.runId} />
                    ) : (
                      <p className="max-w-[16rem] text-xs leading-5 text-slate-500">
                        No run is linked to this approval, so it cannot be resolved from here.
                      </p>
                    )}
                    {run ? (
                      <Link
                        href={`/dashboard/runs/${run.runId}`}
                        className="rounded border border-white/[0.1] px-3 py-1.5 text-center text-xs font-semibold text-slate-300 transition hover:text-white"
                      >
                        Inspect run
                      </Link>
                    ) : null}
                  </div>
                </div>
              </section>
            );
          })}
        </div>
      )}

      {resolved.length > 0 ? (
        <section className="rounded-md border border-white/[0.08] bg-[#080b12]">
          <div className="border-b border-white/[0.06] px-5 py-3">
            <p className="text-sm font-semibold text-white">Recently decided</p>
          </div>
          <div className="divide-y divide-white/[0.05]">
            {resolved.map((approval) => {
              const run = runByApprovalId.get(approval.approvalId);
              return (
                <div key={approval.approvalId} className="flex flex-wrap items-center gap-x-4 gap-y-2 px-5 py-3">
                  <span
                    className={`rounded border px-2 py-0.5 font-mono text-[10px] ${
                      STATUS_STYLE[approval.status] ?? STATUS_STYLE.expired
                    }`}
                  >
                    {approval.status}
                  </span>
                  <span className="min-w-0 flex-1 truncate font-mono text-[13px] text-slate-300">
                    {actionSummary(approval.actionJson)}
                  </span>
                  {approval.resolvedBy ? (
                    <span className="font-mono text-[11px] text-slate-500">by {approval.resolvedBy}</span>
                  ) : null}
                  <span className="font-mono text-[11px] text-slate-600">
                    {relative(approval.resolvedAt ?? approval.updatedAt)}
                  </span>
                  {run ? (
                    <Link
                      href={`/dashboard/runs/${run.runId}`}
                      className="font-mono text-[11px] text-cyan-200 transition hover:text-cyan-100"
                    >
                      run →
                    </Link>
                  ) : null}
                </div>
              );
            })}
          </div>
        </section>
      ) : null}
    </div>
  );
}
