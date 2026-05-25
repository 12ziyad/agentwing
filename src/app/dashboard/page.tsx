import { cookies } from "next/headers";
import { PageHeading, ReceiptsTable, StatsGrid } from "@/components/dashboard/ProductPanels";
import { getReceiptStats, listReceipts } from "@/lib/agentwingStore";
import { getDashboardAuthFromCookieHeader } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const cookieStore = await cookies();
  const auth = await getDashboardAuthFromCookieHeader(
    cookieStore
      .getAll()
      .map((cookie) => `${cookie.name}=${encodeURIComponent(cookie.value)}`)
      .join("; "),
  );
  const stats = await getReceiptStats(auth?.workspaceId);
  const receipts = (await listReceipts(auth?.workspaceId)).slice(0, 6);

  return (
    <div className="space-y-6">
      <PageHeading
        title="Dashboard"
        copy="Universal runtime control for AI agent actions. Create a project, generate an API key, connect BYOK sandboxes, and review usage and receipts from your workspace."
      />
      {auth?.mode === "user" && (
        <section className="grid gap-3 md:grid-cols-5">
          {["Create project", "Generate API key", "Connect E2B BYOK", "Copy API example", "View usage and receipts"].map((step, index) => (
            <div key={step} className="rounded-md border border-white/[0.08] bg-[#080b12] p-4">
              <span className="flex size-7 items-center justify-center rounded border border-cyan-300/20 bg-cyan-300/[0.08] font-mono text-xs text-cyan-100">
                {index + 1}
              </span>
              <p className="mt-3 text-sm font-semibold text-white">{step}</p>
            </div>
          ))}
        </section>
      )}
      <StatsGrid stats={stats} />
      <div className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
        <section className="rounded-md border border-white/[0.08] bg-[#080b12] p-5">
          <p className="text-sm font-semibold text-white">Control flow</p>
          <div className="mt-4 grid gap-3">
            {["Agent proposes action", "AgentWing checks policy", "Approval, sandbox, restore point, or allow", "Receipt recorded"].map(
              (step, index) => (
                <div key={step} className="flex items-center gap-3 rounded-md border border-white/[0.08] bg-[#05070d] p-3">
                  <span className="flex size-7 items-center justify-center rounded border border-cyan-300/20 bg-cyan-300/[0.08] font-mono text-xs text-cyan-100">
                    {index + 1}
                  </span>
                  <span className="text-sm text-slate-200">{step}</span>
                </div>
              ),
            )}
          </div>
        </section>
        <section className="rounded-md border border-white/[0.08] bg-[#080b12] p-5">
          <p className="text-sm font-semibold text-white">SDK quick path</p>
          <pre className="mt-4 overflow-x-auto rounded-md border border-white/[0.08] bg-[#05070d] p-4 text-xs leading-6 text-slate-300">
{`const agentwing = new AgentWing({
  apiKey: process.env.AGENTWING_API_KEY
});

await agentwing.guardAction({
  action,
  execute: () => tool.run(action)
});`}
          </pre>
        </section>
      </div>
      <ReceiptsTable receipts={receipts} />
    </div>
  );
}
