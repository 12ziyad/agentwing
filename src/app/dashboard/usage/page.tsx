import { UsagePanel } from "@/components/dashboard/ProductPanels";
import { getReceiptStats, getUsageForWorkspace } from "@/lib/agentwingStore";
import { requireDashboardSession } from "@/lib/dashboardSession";

export const dynamic = "force-dynamic";

export default async function UsagePage() {
  const { workspaceId } = await requireDashboardSession();
  const [stats, usage] = await Promise.all([
    getReceiptStats(workspaceId),
    getUsageForWorkspace(workspaceId),
  ]);

  return <UsagePanel stats={stats} usage={usage} />;
}
