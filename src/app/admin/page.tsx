import { getAdminStats } from "@/lib/agentwingStore";

export const dynamic = "force-dynamic";

const eventTypeColor: Record<string, string> = {
  user_signed_in: "text-emerald-200",
  user_signed_out: "text-muted",
  project_created: "text-brand",
  api_key_created: "text-brand",
  api_key_revoked: "text-amber-200",
  custom_policy_created: "text-violet-200",
  custom_policy_updated: "text-violet-200",
  custom_policy_deleted: "text-amber-200",
  custom_policy_matched: "text-violet-200",
  check_action_called: "text-secondary",
  receipt_created: "text-secondary",
  approval_created: "text-amber-200",
  approval_resolved: "text-emerald-200",
  sandbox_key_saved: "text-brand",
  sandbox_key_removed: "text-amber-200",
  sandbox_test_success: "text-emerald-200",
  sandbox_test_failed: "text-red-200",
  sandbox_run_success: "text-emerald-200",
  sandbox_run_failed: "text-red-200",
  account_deletion_requested: "text-red-200",
  api_401: "text-red-300",
  api_403: "text-red-300",
  api_500: "text-red-300",
};

export default async function AdminPage() {
  const stats = await getAdminStats();

  if (!stats) {
    return (
      <div className="rounded-md border border-divider bg-surface p-6">
        <p className="text-sm text-muted">
          Admin stats require D1 database. Ensure AGENTWING_DB is bound and migrations are applied.
        </p>
      </div>
    );
  }

  const platformCards = [
    { label: "Total users", value: stats.totalUsers },
    { label: "Active users", value: stats.activeUsers },
    { label: "Deletion requested users", value: stats.deletionRequestedUsers, alert: stats.deletionRequestedUsers > 0 },
    { label: "Deleted users", value: stats.deletedUsers },
    { label: "Total workspaces", value: stats.totalWorkspaces },
    { label: "Active workspaces", value: stats.activeWorkspaces },
    { label: "Deletion requested workspaces", value: stats.deletionRequestedWorkspaces, alert: stats.deletionRequestedWorkspaces > 0 },
    { label: "Deleted workspaces", value: stats.deletedWorkspaces },
    { label: "Projects", value: stats.totalProjects },
    { label: "Active API keys", value: stats.activeApiKeys },
    { label: "Revoked keys", value: stats.revokedApiKeys },
  ];

  const todayCards = [
    { label: "Events today", value: stats.eventsToday },
    { label: "Logins today", value: stats.loginsToday },
    { label: "API calls today", value: stats.apiCallsToday },
    { label: "Blocked today", value: stats.blockedToday },
    { label: "Approval req today", value: stats.approvalRequiredToday },
    { label: "Sandbox req today", value: stats.sandboxRequiredToday },
    { label: "Sandbox runs today", value: stats.sandboxRunsToday },
    { label: "Sandbox fails today", value: stats.sandboxFailsToday },
    { label: "Errors today", value: stats.errorsToday, alert: stats.errorsToday > 0 },
  ];

  return (
    <div className="space-y-8">
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-red-300">Admin</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-foreground">Platform overview</h1>
        <p className="mt-2 text-sm text-muted">
          Platform-wide stats and recent events. Visible only to admin accounts.
        </p>
      </div>

      <div>
        <p className="mb-3 text-xs font-semibold uppercase tracking-[0.12em] text-subdued">Platform totals</p>
        <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-5">
          {platformCards.map(({ label, value, alert }) => (
            <StatCard key={label} label={label} value={value} alert={alert} />
          ))}
        </div>
      </div>

      <div>
        <p className="mb-3 text-xs font-semibold uppercase tracking-[0.12em] text-subdued">Today (UTC)</p>
        <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-5">
          {todayCards.map(({ label, value, alert }) => (
            <StatCard key={label} label={label} value={value} alert={alert} />
          ))}
        </div>
      </div>

      <section className="overflow-hidden rounded-md border border-divider bg-surface">
        <SectionHeader title="Latest signups (10)" />
        {stats.latestUsers.length === 0 ? (
          <EmptyState text="No users yet." />
        ) : (
          <div className="divide-y divide-white/[0.05]">
            {stats.latestUsers.map((user) => (
              <div key={user.userId} className="grid gap-3 px-4 py-3 text-xs md:grid-cols-[2fr_1fr_1fr] md:items-center">
                <div>
                  <p className="font-medium text-foreground">{user.name ?? user.email}</p>
                  <p className="text-subdued">{user.email}</p>
                </div>
                <span className="truncate font-mono text-[10px] text-subdued">{user.userId}</span>
                <span className="text-right text-subdued">{formatDate(user.createdAt)}</span>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="overflow-hidden rounded-md border border-red-300/15 bg-surface">
        <div className="border-b border-red-300/15 bg-red-400/[0.04] px-4 py-3">
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-red-200">Latest deletion requests</p>
        </div>
        {stats.latestDeletionRequests.length === 0 ? (
          <EmptyState text="No account deletion requests yet." />
        ) : (
          <div className="divide-y divide-white/[0.05]">
            {stats.latestDeletionRequests.map((user) => (
              <div key={user.userId} className="grid gap-3 px-4 py-3 text-xs md:grid-cols-[1.6fr_1fr_1fr_1fr] md:items-center">
                <div>
                  <p className="font-medium text-foreground">{user.name ?? user.email}</p>
                  <p className="text-subdued">{user.email}</p>
                </div>
                <span className="truncate font-mono text-[10px] text-subdued">{user.userId}</span>
                <span className="text-muted">{user.status ?? "deletion_requested"}</span>
                <span className="text-right text-subdued">{formatDate(user.deleteRequestedAt)}</span>
              </div>
            ))}
          </div>
        )}
      </section>

      <EventsSection title="Account deletion request events" events={stats.deletionRequestEvents} empty="No deletion request events yet." />

      <section className="overflow-hidden rounded-md border border-divider bg-surface">
        <SectionHeader title="Latest receipts" />
        {stats.latestReceipts.length === 0 ? (
          <EmptyState text="No receipts yet." />
        ) : (
          <div className="divide-y divide-white/[0.05]">
            {stats.latestReceipts.map((receipt) => (
              <div key={receipt.receiptId} className="grid gap-3 px-4 py-3 text-xs md:grid-cols-[1.4fr_0.7fr_0.7fr_1.5fr_1fr] md:items-center">
                <span className="truncate font-mono text-[10px] text-subdued">{receipt.receiptId}</span>
                <span className={receipt.decision === "block" ? "font-semibold text-red-200" : "font-semibold text-secondary"}>
                  {receipt.decision}
                </span>
                <span className={receipt.risk === "critical" || receipt.risk === "high" ? "text-red-200" : "text-muted"}>
                  {receipt.risk}
                </span>
                <span className="truncate font-mono text-[10px] text-subdued">{receipt.policy}</span>
                <span className="text-right text-subdued">{formatDate(receipt.createdAt)}</span>
              </div>
            ))}
          </div>
        )}
      </section>

      <EventsSection title="Recent events (latest 50)" events={stats.recentEvents} empty="No events yet." />
    </div>
  );
}

function EventsSection({
  title,
  events,
  empty,
}: {
  title: string;
  events: Array<{ eventId: string; eventType: string; status: string; workspaceId?: string; userId?: string; createdAt: string }>;
  empty: string;
}) {
  return (
    <section className="overflow-hidden rounded-md border border-divider bg-surface">
      <SectionHeader title={title} />
      {events.length === 0 ? (
        <EmptyState text={empty} />
      ) : (
        <div className="divide-y divide-white/[0.05]">
          {events.map((event) => (
            <EventRow key={event.eventId} event={event} />
          ))}
        </div>
      )}
    </section>
  );
}

function EventRow({
  event,
}: {
  event: { eventType: string; status: string; workspaceId?: string; userId?: string; createdAt: string };
}) {
  return (
    <div className="grid gap-3 px-4 py-3 text-xs md:grid-cols-[1.4fr_0.6fr_1fr_1.2fr] md:items-center">
      <span className={`truncate font-mono font-semibold ${eventTypeColor[event.eventType] ?? "text-secondary"}`}>
        {event.eventType}
      </span>
      <span className={`w-fit rounded border px-1.5 py-0.5 text-[10px] font-semibold ${event.status === "ok" ? "border-emerald-300/20 text-emerald-200" : "border-red-300/20 text-red-200"}`}>
        {event.status}
      </span>
      <span className="truncate font-mono text-[10px] text-subdued">
        {event.workspaceId ?? event.userId ?? "Not available"}
      </span>
      <span className="text-right text-subdued">{formatDate(event.createdAt)}</span>
    </div>
  );
}

function SectionHeader({ title }: { title: string }) {
  return (
    <div className="border-b border-divider bg-raised px-4 py-3">
      <p className="text-xs font-semibold uppercase tracking-[0.12em] text-muted">{title}</p>
    </div>
  );
}

function EmptyState({ text }: { text: string }) {
  return <p className="px-4 py-6 text-sm text-subdued">{text}</p>;
}

function StatCard({ label, value, alert }: { label: string; value: number; alert?: boolean }) {
  return (
    <article className={`rounded-md border p-5 ${alert ? "border-red-300/25 bg-red-300/[0.04]" : "border-divider bg-surface"}`}>
      <p className="text-xs font-medium text-muted">{label}</p>
      <p className={`mt-3 text-3xl font-semibold tracking-tight ${alert ? "text-red-200" : "text-foreground"}`}>{value}</p>
    </article>
  );
}

function formatDate(value?: string) {
  if (!value) return "Not available";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "Not available" : date.toLocaleString();
}
