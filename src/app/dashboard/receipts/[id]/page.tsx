import { cookies } from "next/headers";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getDashboardAuthFromCookieHeader } from "@/lib/auth";
import { getReceipt } from "@/lib/agentwingStore";

export const dynamic = "force-dynamic";

const decisionClass: Record<string, string> = {
  allow: "border-emerald-300/25 bg-emerald-300/[0.08] text-emerald-100",
  block: "border-red-300/25 bg-red-400/[0.08] text-red-100",
  approval_required: "border-amber-300/25 bg-amber-300/[0.08] text-amber-100",
  sandbox_required: "border-cyan-300/25 bg-cyan-300/[0.08] text-cyan-100",
  restore_point_required: "border-violet-300/25 bg-violet-300/[0.08] text-violet-100",
};

const riskClass: Record<string, string> = {
  low: "text-emerald-100",
  medium: "text-amber-100",
  high: "text-red-100",
  critical: "text-red-300",
};

function maskedProjectId(projectId?: string) {
  if (!projectId) return "Workspace scoped";
  return projectId.length > 10 ? `${projectId.slice(0, 6)}...${projectId.slice(-4)}` : "Project scoped";
}

export default async function ReceiptDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const cookieStore = await cookies();
  const cookieHeader = cookieStore
    .getAll()
    .map((c) => `${c.name}=${encodeURIComponent(c.value)}`)
    .join("; ");
  const auth = await getDashboardAuthFromCookieHeader(cookieHeader);
  const receipt = await getReceipt(id, auth?.workspaceId);

  if (!receipt) notFound();

  const safeAction = { ...receipt.rawAction };
  const safeMetadata = safeAction.metadata;
  delete safeAction.metadata;

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <Link
          href="/dashboard/receipts"
          className="text-xs font-semibold text-slate-400 transition hover:text-white"
        >
          ← Receipts
        </Link>
        <span className="text-slate-600">/</span>
        <p className="font-mono text-xs text-slate-400">{receipt.receiptId}</p>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <span className={`rounded border px-3 py-1.5 text-sm font-semibold ${decisionClass[receipt.decision] ?? ""}`}>
          {receipt.decision}
        </span>
        <span className={`text-sm font-semibold ${riskClass[receipt.risk] ?? "text-slate-300"}`}>
          {receipt.risk} risk
        </span>
        <span className="text-xs text-slate-500">{new Date(receipt.createdAt).toLocaleString()}</span>
      </div>

      <section className="grid gap-4 md:grid-cols-2">
        <div className="rounded-md border border-white/[0.08] bg-[#080b12] p-5">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">Decision</p>
          <div className="mt-4 space-y-3">
            <Field label="Policy" value={receipt.policy} mono />
            <Field label="Decision" value={receipt.decision} />
            <Field label="Risk" value={receipt.risk} />
            <Field label="Feedback" value={receipt.feedback} />
            {receipt.provider && <Field label="Provider" value={receipt.provider} />}
          </div>
        </div>
        <div className="rounded-md border border-white/[0.08] bg-[#080b12] p-5">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">Action</p>
          <div className="mt-4 space-y-3">
            <Field label="Action type" value={receipt.actionType} mono />
            {receipt.tool && <Field label="Tool" value={receipt.tool} mono />}
            {receipt.target && <Field label="Target" value={receipt.target.slice(0, 200)} mono />}
            {receipt.sessionId && <Field label="Session" value={receipt.sessionId} mono />}
            {receipt.agentId && <Field label="Agent" value={receipt.agentId} mono />}
            {receipt.projectId && <Field label="Project" value={maskedProjectId(receipt.projectId)} mono />}
          </div>
        </div>
      </section>

      {(receipt.stdout || receipt.stderr || receipt.exitCode !== undefined || receipt.durationMs !== undefined) && (
        <section className="rounded-md border border-white/[0.08] bg-[#080b12] p-5">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">Sandbox result</p>
          <div className="mt-4 space-y-3">
            {receipt.exitCode !== undefined && <Field label="Exit code" value={String(receipt.exitCode)} mono />}
            {receipt.durationMs !== undefined && <Field label="Duration" value={`${receipt.durationMs}ms`} />}
            {receipt.error && <Field label="Error" value={receipt.error.slice(0, 500)} />}
            {receipt.stdout && (
              <div>
                <p className="text-xs font-medium uppercase tracking-[0.1em] text-slate-500">stdout</p>
                <pre className="mt-2 max-h-48 overflow-y-auto rounded border border-white/[0.08] bg-[#05070d] p-3 text-xs leading-5 text-slate-300">
                  {receipt.stdout.slice(0, 2000)}
                </pre>
              </div>
            )}
            {receipt.stderr && (
              <div>
                <p className="text-xs font-medium uppercase tracking-[0.1em] text-slate-500">stderr</p>
                <pre className="mt-2 max-h-48 overflow-y-auto rounded border border-white/[0.08] bg-[#05070d] p-3 text-xs leading-5 text-amber-100">
                  {receipt.stderr.slice(0, 2000)}
                </pre>
              </div>
            )}
          </div>
        </section>
      )}

      {safeMetadata && Object.keys(safeMetadata).length > 0 && (
        <section className="rounded-md border border-white/[0.08] bg-[#080b12] p-5">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">Metadata</p>
          <pre className="mt-4 overflow-x-auto rounded border border-white/[0.08] bg-[#05070d] p-3 text-xs leading-5 text-slate-300">
            {JSON.stringify(safeMetadata, null, 2).slice(0, 2000)}
          </pre>
        </section>
      )}
    </div>
  );
}

function Field({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex flex-col gap-1">
      <p className="text-[11px] font-medium uppercase tracking-[0.1em] text-slate-500">{label}</p>
      <p className={mono ? "break-all font-mono text-xs text-cyan-100" : "text-sm text-slate-200"}>{value}</p>
    </div>
  );
}
