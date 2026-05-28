import Link from "next/link";
import { cookies } from "next/headers";
import { ReceiptsTable, StatsGrid } from "@/components/dashboard/ProductPanels";
import { getActionRunStats, getReceiptStats, listActionRuns, listReceipts, getSandboxConfigForWorkspace, listCustomPolicies, listApprovals } from "@/lib/agentwingStore";
import { getDashboardAuthFromCookieHeader } from "@/lib/auth";
import type { ActionRunStats } from "@/lib/agentwingTypes";

export const dynamic = "force-dynamic";

const onboarding = [
  { step: 1, label: "Create project", href: "/dashboard/projects", copy: "Scope your API keys, policies, and receipts." },
  { step: 2, label: "Generate API key", href: "/dashboard/api-keys", copy: "Get a key to authenticate check-action calls." },
  { step: 3, label: "Add policies", href: "/dashboard/policies", copy: "Create custom rules before the default set." },
  { step: 4, label: "Connect sandbox", href: "/dashboard/sandboxes", copy: "Route sandbox_required decisions to E2B." },
  { step: 5, label: "View receipts", href: "/dashboard/receipts", copy: "Audit every check-action call." },
  { step: 6, label: "Integration guide", href: "/dashboard/integrations", copy: "cURL, JS, Python examples for your agent." },
];

export default async function DashboardPage() {
  const cookieStore = await cookies();
  const auth = await getDashboardAuthFromCookieHeader(
    cookieStore.getAll().map((cookie) => `${cookie.name}=${encodeURIComponent(cookie.value)}`).join("; "),
  );
  const workspaceId = auth?.workspaceId;
  const workspace = auth?.mode === "user" ? auth.workspace : undefined;

  const [stats, receipts, sandboxConfig, customPolicies, pendingApprovals, recentRuns, runStats] = await Promise.all([
    getReceiptStats(workspaceId),
    listReceipts(workspaceId),
    workspaceId ? getSandboxConfigForWorkspace(workspaceId) : Promise.resolve(null),
    workspaceId ? listCustomPolicies(workspaceId) : Promise.resolve([]),
    workspaceId ? listApprovals(workspaceId, "pending") : Promise.resolve([]),
    listActionRuns(workspaceId, undefined, 5),
    getActionRunStats(workspaceId),
  ]);

  const recentReceipts = receipts.slice(0, 8);
  const latestRun = recentRuns[0];

  return (
    <div className="space-y-6">
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">Overview</p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight text-white">
          {workspace ? workspace.name : "Control plane"}
        </h1>
        <p className="mt-1 text-sm text-slate-400">
          AgentWing is controlling live action runs: policy checks, approval gates, sandbox routing, restore points, logs, and receipts.
        </p>
      </div>

      <RunStatsGrid stats={runStats} actionsChecked={stats.total} receiptsCreated={stats.receiptsCreated} />

      <section className="rounded-md border border-white/[0.08] bg-[#080b12] p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-sm font-semibold text-white">Latest execution run</p>
            <p className="mt-1 max-w-3xl text-sm leading-6 text-slate-400">
              AgentWing is the execution gate between agents and tools. It blocks dangerous actions, routes risky actions to sandbox, requests approval when needed, requires restore points for sensitive changes, and records the full receipt.
            </p>
          </div>
          <Link href="/dashboard/runs" className="rounded border border-white/[0.1] px-3 py-2 text-xs font-semibold text-slate-200 transition hover:text-white">
            View runs
          </Link>
        </div>
        {latestRun ? (
          <Link href={`/dashboard/runs/${latestRun.runId}`} className="mt-5 grid gap-3 rounded border border-white/[0.06] bg-[#05070d] p-4 transition hover:border-white/[0.12] md:grid-cols-[1fr_auto]">
            <div className="min-w-0">
              <p className="truncate font-mono text-sm text-cyan-100">
                {latestRun.action.command || latestRun.action.target || latestRun.action.description || latestRun.action.actionType}
              </p>
              <p className="mt-2 text-xs text-slate-400">
                {latestRun.decision} / {latestRun.status} / {latestRun.executionTarget}
              </p>
            </div>
            <span className="text-xs font-semibold text-cyan-100">View run</span>
          </Link>
        ) : (
          <div className="mt-5 rounded border border-white/[0.06] bg-[#05070d] p-4 text-sm text-slate-400">
            No runs yet. Call <code className="font-mono text-cyan-100">POST /api/v1/execute-action</code> to create the first guarded lifecycle.
          </div>
        )}
      </section>

      {/* Status cards */}
      <div className="grid gap-4 sm:grid-cols-3">
        <StatusCard
          label="Pending approvals"
          value={pendingApprovals.length}
          href="/dashboard/runs"
          status={pendingApprovals.length > 0 ? "warn" : "ok"}
          suffix={pendingApprovals.length === 1 ? "action awaiting review" : "actions awaiting review"}
        />
        <StatusCard
          label="Sandbox"
          value={sandboxConfig?.connected ? "Connected" : "Not connected"}
          href="/dashboard/sandboxes"
          status={sandboxConfig?.connected ? "ok" : "empty"}
          suffix={sandboxConfig?.connected ? `Last test: ${sandboxConfig.lastTestStatus ?? "untested"}` : "Connect E2B BYOK key"}
        />
        <StatusCard
          label="Custom policies"
          value={customPolicies.length}
          href="/dashboard/policies"
          status="ok"
          suffix={customPolicies.length === 1 ? "custom policy active" : "custom policies active"}
        />
      </div>

      {/* Onboarding */}
      <section className="rounded-md border border-white/[0.08] bg-[#080b12] p-5">
        <p className="text-sm font-semibold text-white">Getting started</p>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {onboarding.map(({ step, label, href, copy }) => (
            <Link
              key={step}
              href={href}
              className="flex items-start gap-3 rounded border border-white/[0.06] bg-[#05070d] p-3 transition hover:border-white/[0.12]"
            >
              <span className="flex size-6 shrink-0 items-center justify-center rounded border border-cyan-300/20 bg-cyan-300/[0.08] font-mono text-xs text-cyan-100">
                {step}
              </span>
              <div>
                <p className="text-sm font-semibold text-white">{label}</p>
                <p className="mt-0.5 text-xs leading-5 text-slate-500">{copy}</p>
              </div>
            </Link>
          ))}
        </div>
      </section>

      <div className="grid gap-4 lg:grid-cols-[1.3fr_0.7fr]">
        <section className="rounded-md border border-white/[0.08] bg-[#080b12] p-5">
          <p className="text-sm font-semibold text-white">Execution flow</p>
          <div className="mt-4 space-y-2">
            {[
              "Agent proposes action",
              "AgentWing checks custom policies first, then defaults",
              "Decision: allow / block / approval_required / sandbox_required / restore_point_required",
              "Approval, sandbox, checkpoint, or external runner path selected",
              "Execution result, logs, and receipt sealed",
            ].map((step, index) => (
              <div key={step} className="flex items-start gap-3 rounded border border-white/[0.06] bg-[#05070d] p-3">
                <span className="flex size-6 shrink-0 items-center justify-center rounded border border-cyan-300/20 bg-cyan-300/[0.08] font-mono text-xs text-cyan-100">
                  {index + 1}
                </span>
                <span className="text-sm text-slate-300">{step}</span>
              </div>
            ))}
          </div>
        </section>
        <section className="rounded-md border border-white/[0.08] bg-[#080b12] p-5">
          <p className="text-sm font-semibold text-white">Quick API test</p>
          <pre className="mt-4 overflow-x-auto rounded border border-white/[0.08] bg-[#05070d] p-3 text-xs leading-6 text-slate-300">
{`POST /api/v1/check-action
Authorization: Bearer YOUR_KEY

{
  "actionType": "file_access",
  "tool": "filesystem",
  "target": ".env"
}

→ { "decision": "block",
    "risk": "high",
    "nextStep": "Re-plan." }`}
          </pre>
          <Link href="/dashboard/integrations" className="mt-4 inline-block text-xs font-semibold text-cyan-200 hover:text-cyan-100">
            Full integration guide →
          </Link>
        </section>
      </div>

      <StatsGrid stats={stats} />
      <ReceiptsTable receipts={recentReceipts} />
    </div>
  );
}

function RunStatsGrid({
  stats,
  actionsChecked,
  receiptsCreated,
}: {
  stats: ActionRunStats;
  actionsChecked: number;
  receiptsCreated: number;
}) {
  const items = [
    ["Actions checked", actionsChecked],
    ["Runs created", stats.total],
    ["Runs executed", stats.completed],
    ["Blocked", stats.blocked],
    ["Sandbox runs", stats.sandboxRuns],
    ["Waiting approval", stats.waitingApproval],
    ["Receipts created", receiptsCreated],
  ] as const;

  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-7">
      {items.map(([label, value]) => (
        <article key={label} className="rounded-md border border-white/[0.08] bg-[#080b12] p-4">
          <p className="text-xs font-medium text-slate-400">{label}</p>
          <p className="mt-3 text-2xl font-semibold tracking-tight text-white">{value}</p>
        </article>
      ))}
    </div>
  );
}

function StatusCard({
  label, value, href, status, suffix
}: {
  label: string;
  value: string | number;
  href: string;
  status: "ok" | "warn" | "empty";
  suffix?: string;
}) {
  const border = status === "warn" ? "border-amber-300/20 bg-amber-300/[0.04]" : "border-white/[0.08] bg-[#080b12]";
  return (
    <Link href={href} className={`rounded-md border p-5 transition hover:border-white/[0.14] ${border}`}>
      <p className="text-xs font-medium text-slate-400">{label}</p>
      <p className={`mt-2 text-2xl font-semibold ${status === "warn" ? "text-amber-200" : "text-white"}`}>
        {value}
      </p>
      {suffix && <p className="mt-1 text-xs text-slate-500">{suffix}</p>}
    </Link>
  );
}
