import { cookies } from "next/headers";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CheckCircle2, Circle, Clock, Terminal, XCircle } from "lucide-react";
import { RunApprovalControls } from "@/components/dashboard/RunApprovalControls";
import { getDashboardAuthFromCookieHeader } from "@/lib/auth";
import { getActionRun, listExecutionEvents } from "@/lib/agentwingStore";
import type { ActionRun, ExecutionEvent } from "@/lib/agentwingTypes";

export const dynamic = "force-dynamic";

type TimelineState = "done" | "wait" | "fail" | "idle";

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

export default async function RunDetailPage({ params }: { params: Promise<{ runId: string }> }) {
  const { runId } = await params;
  const cookieStore = await cookies();
  const auth = await getDashboardAuthFromCookieHeader(
    cookieStore.getAll().map((cookie) => `${cookie.name}=${encodeURIComponent(cookie.value)}`).join("; "),
  );
  const run = await getActionRun(runId, auth?.workspaceId);
  if (!run) notFound();

  const events = await listExecutionEvents(run.runId);
  const summary = run.action.command || run.action.target || run.action.description || run.action.actionType;

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <Link href="/dashboard/runs" className="text-xs font-semibold text-slate-400 transition hover:text-white">
          Back to runs
        </Link>
        <span className="text-slate-600">/</span>
        <p className="font-mono text-xs text-slate-500">{run.runId}</p>
      </div>

      <section className="rounded-md border border-white/[0.08] bg-[#080b12] p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-cyan-200">Action run</p>
            <h1 className="mt-2 break-words text-2xl font-semibold tracking-tight text-white">{summary}</h1>
            <p className="mt-2 text-sm text-slate-400">
              Proposed by {run.action.agentId ?? "agent"} on {new Date(run.createdAt).toLocaleString()}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Chip className={decisionClass[run.decision]}>{run.decision}</Chip>
            <Chip className={statusClass[run.status] ?? statusClass.checked}>{run.status}</Chip>
            <span className={`px-2 py-1 text-xs font-semibold ${riskClass[run.risk] ?? "text-slate-300"}`}>
              {run.risk} risk
            </span>
          </div>
        </div>
        <div className="mt-5 grid gap-3 md:grid-cols-4">
          <Field label="Policy" value={run.policy} mono />
          <Field label="Execution target" value={run.executionTarget} />
          <Field label="Receipt" value={run.receiptId ?? "-"} mono />
          <Field label="Updated" value={new Date(run.updatedAt).toLocaleString()} />
        </div>
      </section>

      {run.status === "waiting_approval" && (
        <RunApprovalControls
          runId={run.runId}
          summary={summary}
          risk={run.risk}
          policy={run.policy}
          proposed={run.action.command || run.action.target || "-"}
        />
      )}

      <div className="grid gap-5 xl:grid-cols-[0.9fr_1.1fr]">
        <div className="space-y-5">
          <section className="rounded-md border border-white/[0.08] bg-[#080b12] p-5">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">Proposed action JSON</p>
            <pre className="mt-4 max-h-96 overflow-auto rounded border border-white/[0.08] bg-[#05070d] p-3 text-xs leading-5 text-slate-300">
              {JSON.stringify(run.action, null, 2)}
            </pre>
          </section>

          <section className="rounded-md border border-white/[0.08] bg-[#080b12] p-5">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">Policy evaluation</p>
            <div className="mt-4 space-y-3">
              <Field label="Decision" value={run.decision} />
              <Field label="Risk" value={run.risk} />
              <Field label="Feedback" value={run.feedback ?? "-"} />
              <Field label="Next step" value={run.nextStep ?? "-"} />
            </div>
          </section>
        </div>

        <div className="space-y-5">
          <section className="rounded-md border border-white/[0.08] bg-[#080b12] p-5">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">Lifecycle timeline</p>
            <div className="mt-4 space-y-3">
              {timeline(run, events).map((item, index) => (
                <div key={`${item.label}-${index}`} className="flex gap-3 rounded border border-white/[0.06] bg-[#05070d] p-3">
                  <TimelineIcon state={item.state} />
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-white">{item.label}</p>
                    <p className="mt-1 text-xs leading-5 text-slate-400">{item.message}</p>
                    {item.time && <p className="mt-1 text-[10px] text-slate-600">{new Date(item.time).toLocaleString()}</p>}
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section className="rounded-md border border-white/[0.08] bg-[#080b12] p-5">
            <div className="flex items-center gap-2">
              <Terminal className="size-4 text-cyan-200" />
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">Execution logs</p>
            </div>
            <div className="mt-4 grid gap-3 sm:grid-cols-3">
              <Field label="Exit code" value={run.exitCode === undefined ? "-" : String(run.exitCode)} mono />
              <Field label="Duration" value={run.durationMs === undefined ? "-" : `${run.durationMs}ms`} />
              <Field label="Sandbox" value={run.sandboxProvider ?? "-"} />
            </div>
            <LogBlock label="stdout" value={run.stdout} tone="default" />
            <LogBlock label="stderr" value={run.stderr} tone="warn" />
            {run.errorMessage && <LogBlock label="error" value={run.errorMessage} tone="error" />}
          </section>
        </div>
      </div>
    </div>
  );
}

function Chip({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <span className={`rounded border px-2 py-1 text-xs font-semibold ${className}`}>{children}</span>;
}

function Field({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="min-w-0">
      <p className="text-[11px] font-medium uppercase tracking-[0.1em] text-slate-500">{label}</p>
      <p className={mono ? "mt-1 break-all font-mono text-xs text-cyan-100" : "mt-1 break-words text-sm text-slate-200"}>
        {value}
      </p>
    </div>
  );
}

function LogBlock({ label, value, tone }: { label: string; value?: string; tone: "default" | "warn" | "error" }) {
  const color = tone === "error" ? "text-red-100" : tone === "warn" ? "text-amber-100" : "text-slate-300";
  return (
    <div className="mt-4">
      <p className="text-[11px] font-medium uppercase tracking-[0.1em] text-slate-500">{label}</p>
      <pre className={`mt-2 max-h-64 overflow-auto rounded border border-white/[0.08] bg-[#05070d] p-3 text-xs leading-5 ${color}`}>
        {value?.trim() ? value : "No output captured."}
      </pre>
    </div>
  );
}

function TimelineIcon({ state }: { state: TimelineState }) {
  if (state === "done") return <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-emerald-200" />;
  if (state === "wait") return <Clock className="mt-0.5 size-4 shrink-0 text-amber-200" />;
  if (state === "fail") return <XCircle className="mt-0.5 size-4 shrink-0 text-red-200" />;
  return <Circle className="mt-0.5 size-4 shrink-0 text-slate-600" />;
}

function findEvent(events: ExecutionEvent[], type: string) {
  return events.find((event) => event.eventType === type);
}

function timeline(run: ActionRun, events: ExecutionEvent[]) {
  const branch =
    run.decision === "approval_required"
      ? "Approval requested inline for this run."
      : run.decision === "sandbox_required"
        ? run.status === "waiting_sandbox"
          ? "Sandbox required; waiting for E2B BYOK connection or capacity."
          : "Sandbox selected for execution."
        : run.decision === "restore_point_required"
          ? "Restore point required before an external runner continues."
          : run.decision === "block"
            ? "Action blocked. Execution skipped."
            : "Action cleared by policy.";

  const started = findEvent(events, "execution_started");
  const completed = findEvent(events, "execution_completed") ?? findEvent(events, "execution_failed");
  const rejected = findEvent(events, "approval_rejected");
  const finalState: TimelineState = run.status === "failed" || run.status === "rejected" ? "fail" : completed || run.completedAt ? "done" : "wait";

  return [
    { label: "Agent proposed action", message: "The agent submitted a proposed tool action to AgentWing.", state: "done" as const, time: run.createdAt },
    { label: "AgentWing checked policy", message: run.policy, state: "done" as const, time: findEvent(events, "policy_checked")?.createdAt },
    { label: "Decision returned", message: `${run.decision} with ${run.risk} risk.`, state: "done" as const, time: findEvent(events, "decision_returned")?.createdAt },
    { label: "Guard selected", message: branch, state: run.status === "waiting_approval" || run.status === "waiting_sandbox" || run.status === "restore_point_required" ? "wait" as const : "done" as const, time: findEvent(events, "approval_requested")?.createdAt ?? findEvent(events, "waiting_sandbox")?.createdAt },
    { label: "Execution started or skipped", message: started ? "Execution started in the selected target." : run.executionTarget === "skipped" ? "Execution skipped by policy/lifecycle." : "Execution has not started in AgentWing.", state: started || run.executionTarget === "skipped" ? "done" as const : "idle" as const, time: started?.createdAt },
    { label: "Execution result", message: rejected ? "Rejected by human reviewer." : completed?.message ?? run.nextStep ?? "Awaiting the next safe continuation step.", state: finalState, time: completed?.createdAt ?? run.completedAt },
    { label: "Receipt sealed", message: run.receiptId ? "Receipt is available for audit." : "Receipt pending.", state: run.receiptId ? "done" as const : "idle" as const, time: run.completedAt ?? run.updatedAt },
  ];
}
