import { UsagePanel } from "@/components/dashboard/ProductPanels";
import { DEMO_API_KEY, getReceiptStats, getUsageForApiKey } from "@/lib/agentwingStore";

export const dynamic = "force-dynamic";

export default async function UsagePage() {
  return <UsagePanel stats={await getReceiptStats()} usage={await getUsageForApiKey(DEMO_API_KEY)} />;
}
