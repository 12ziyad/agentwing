import { cookies } from "next/headers";
import Link from "next/link";
import { ArrowUpRight, Route } from "lucide-react";
import { RunListApprovalActions } from "@/components/dashboard/RunListApprovalActions";
import { getDashboardAuthFromCookieHeader } from "@/lib/auth";
import { listActionRuns } from "@/lib/agentwingStore";
import type { ActionRun } from "@/lib/agentwingTypes";

export const dynamic = "force-dynamic";

const decisionClass: Record<string, string> = {
  allow: "border-emerald-300/25 bg-emerald-300/[0.08] text-emerald-100",
  block: "border-red-300/25 bg-red-400/[0.08] text-red-100",
  approval_required: "border-amber-300/25 bg-amber-300/[0.08] text-amber-100",
  sandbox_required: "border-cyan-300/25 bg-cyan-300/[0.08] text-cyan-100",
  restore_point_required: "border-violet-300/25 bg-violet-300/[0.08] text-violet-100",
};

const statusClass: Record<string, string> = {
  completed: "border-emerald-300/25 bg-emerald-300/[0.08] text-emerald-100",
  execution_skipped: "border-slate-300/15 bg-slate-300/[0.06] text-slate-300",
  blocked: "border-red-300/25 bg-red-400/[0.08] text-red-100",
  failed: "border-red-300/25 bg-red-400/[0.08] text-red-100",
  waiting_approval: "border-amber-300/25 bg-amber-300/[0.08] text-amber-100",
  approved: "border-emerald-300/25 bg-emerald-300/[0.08] text-emerald-100",
  rejected: "border-red-300/25 bg-red-400/[0.08] text-red-100",
  waiting_sandbox: "border-cyan-300/25 bg-cyan-300/[0.08] text-cyan-100",
  running: "border-cyan-300/25 bg-cyan-300/[0.08] text-cyan-100",
  restore_point_required: "border-violet-300/25 bg-violet-300/[0.08] text-violet-100",
  checkpoint_created: "border-violet-300/25 bg-violet-300/[0.08] text-violet-100",
  external_runner_required: "border-slate-300/15 bg-slate-300/[0.06] text-slate-300",
  checked: "border-slate-300/15 bg-slate-300/[0.06] text-slate-300",
  proposed: "border-slate-300/15 bg-slate-300/[0.06] text-slate-300",
};

const riskClass: Record<string, string> = {
  low: "text-emerald-100",
  medium: "text-amber-100",
  high: "text-red-100",
  critical: "text-red-300",
};

const filters = [
  { key: "all", label: "All" },
  { key: "waiting_approval", label: "Waiting approval" },
  { key: "sandbox_required", label: "Sandbox required" },
  { key: "blocked", label: "Blocked" },
  { key: "failed", label: "Failed" },
  { key: "completed", label: "Completed" },
  { key: "restore_point_required", label: "Restore point required" },
];

function filterRuns(runs: ActionRun[], status: string) {
  if (!status || status === "all") return runs;
  if (status === "sandbox_required") return runs.filter((run) => run.decision === "sandbox_required");
  return runs.filter((run) => run.status === status);
}

export default async function RunsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const { status = "all" } = await searchParams;
  const cookieStore = await cookies();
  const auth = await getDashboardAuthFromCookieHeader(
    cookieStore.getAll().map((cookie) => `${cookie.name}=${encodeURIComponent(cookie.value)}`).join("; "),
  );
  const allRuns = await listActionRuns(auth?.workspaceId, undefined, 100);
  const runs = filterRuns(allRuns, status);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-cyan-200">Runs</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight text-white">Execution runs</h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-400">
            AgentWing tracks the full guarded lifecycle: proposed action, policy decision, approval/sandbox/checkpoint, execution state, logs, and receipt.
          </p>
        </div>
        <Link
          href="/dashboard/integrations"
          className="inline-flex items-center gap-2 rounded-md border border-white/[0.1] bg-white/[0.04] px-3 py-2 text-xs font-semibold text-slate-200 transition hover:text-white"
        >
          API guide
          <ArrowUpRight className="size-3.5" />
        </Link>
      </div>

      <div className="flex flex-wrap gap-2">
        {filters.map((filter) => {
          const active = status === filter.key || (!status && filter.key === "all");
          return (
            <Link
              key={filter.key}
              href={filter.key === "all" ? "/dashboard/runs" : `/dashboard/runs?status=${filter.key}`}
              className={`rounded-md border px-3 py-1.5 text-xs font-semibold transition ${
                active
                  ? "border-cyan-300/25 bg-cyan-300/[0.1] text-cyan-100"
                  : "border-white/[0.08] bg-white/[0.03] text-slate-400 hover:text-white"
              }`}
            >
              {filter.label}
            </Link>
          );
        })}
      </div>

      <section className="overflow-x-auto rounded-md border border-white/[0.08] bg-[#080b12]">
        <div className="grid min-w-[1280px] grid-cols-[0.95fr_0.95fr_0.85fr_1.2fr_1fr_0.55fr_0.85fr_0.85fr_0.9fr_1.35fr] gap-3 border-b border-white/[0.08] bg-[#0c1019] px-4 py-3 text-[11px] font-semibold uppercase tracking-[0.1em] text-slate-500">
          <span>Status</span>
          <span>Decision</span>
          <span>Type</span>
          <span>Command / target</span>
          <span>Policy</span>
          <span>Risk</span>
          <span>Target</span>
          <span>Receipt</span>
          <span>Created</span>
          <span>Actions</span>
        </div>
        {runs.length === 0 ? (
          <div className="px-4 py-12 text-center">
            <Route className="mx-auto size-10 text-slate-600" />
            <p className="mt-4 text-sm font-semibold text-slate-300">No matching action runs</p>
            <p className="mt-2 text-xs text-slate-500">
              Call <code className="font-mono text-cyan-100">POST /api/v1/execute-action</code> to create a guarded execution run.
            </p>
          </div>
        ) : (
          runs.map((run) => <RunRow key={run.runId} run={run} />)
        )}
      </section>
    </div>
  );
}

function RunRow({ run }: { run: ActionRun }) {
  const command = run.action.command || run.action.target || run.action.description || "-";
  return (
    <div className="grid min-w-[1280px] grid-cols-[0.95fr_0.95fr_0.85fr_1.2fr_1fr_0.55fr_0.85fr_0.85fr_0.9fr_1.35fr] items-center gap-3 border-b border-white/[0.06] px-4 py-3 text-sm transition last:border-b-0 hover:bg-white/[0.02]">
      <span className={`w-fit rounded border px-2 py-1 text-[11px] font-semibold ${statusClass[run.status] ?? statusClass.checked}`}>
        {run.status}
      </span>
      <span className={`w-fit rounded border px-2 py-1 text-[11px] font-semibold ${decisionClass[run.decision] ?? ""}`}>
        {run.decision}
      </span>
      <span className="font-mono text-xs text-cyan-100">{run.action.actionType}</span>
      <span className="min-w-0 truncate font-mono text-xs text-slate-300">{command}</span>
      <span className="min-w-0 truncate font-mono text-xs text-slate-400">{run.policy}</span>
      <span className={`text-xs font-semibold ${riskClass[run.risk] ?? "text-slate-300"}`}>{run.risk}</span>
      <span className="text-xs text-slate-400">{run.executionTarget}</span>
      <span className="font-mono text-xs text-slate-500">{run.receiptId ? `${run.receiptId.slice(0, 14)}...` : "-"}</span>
      <span className="text-xs text-slate-500">{new Date(run.createdAt).toLocaleString()}</span>
      {run.status === "waiting_approval" ? (
        <RunListApprovalActions runId={run.runId} />
      ) : (
        <Link href={`/dashboard/runs/${run.runId}`} className="justify-self-end rounded border border-white/[0.1] px-2 py-1.5 text-[11px] font-semibold text-cyan-100 transition hover:text-white">
          View run
        </Link>
      )}
    </div>
  );
}
