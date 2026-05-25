import { cookies } from "next/headers";
import { UsagePanel } from "@/components/dashboard/ProductPanels";
import { getReceiptStats, getUsageForWorkspace } from "@/lib/agentwingStore";
import { getDashboardAuthFromCookieHeader } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function UsagePage() {
  const cookieStore = await cookies();
  const auth = await getDashboardAuthFromCookieHeader(
    cookieStore
      .getAll()
      .map((cookie) => `${cookie.name}=${encodeURIComponent(cookie.value)}`)
      .join("; "),
  );
  const [stats, usage] = await Promise.all([
    getReceiptStats(auth?.workspaceId),
    getUsageForWorkspace(auth?.workspaceId),
  ]);

  return <UsagePanel stats={stats} usage={usage} />;
}
