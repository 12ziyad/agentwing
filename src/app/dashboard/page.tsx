import { PageHeading, ReceiptsTable, StatsGrid } from "@/components/dashboard/ProductPanels";
import { getReceiptStats, listReceipts } from "@/lib/agentwingStore";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const stats = await getReceiptStats();
  const receipts = (await listReceipts()).slice(0, 6);

  return (
    <div className="space-y-6">
      <PageHeading
        title="Dashboard"
        copy="Universal runtime control for AI agent actions. Watch policy decisions, approval gates, sandbox routing, restore points, feedback, and audit receipts from one API-first console."
      />
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
