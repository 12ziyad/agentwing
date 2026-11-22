import { DashboardShell } from "@/components/dashboard/DashboardShell";
import { requireDashboardSession } from "@/lib/dashboardSession";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const auth = await requireDashboardSession();
  return <DashboardShell auth={auth}>{children}</DashboardShell>;
}
