import { cookies } from "next/headers";
import { DashboardShell } from "@/components/dashboard/DashboardShell";
import { AdminAccessScreen } from "@/components/dashboard/AdminAccessScreen";
import { getAdminAccessCode } from "@/lib/adminAccess";
import { getDashboardAuthFromCookieHeader } from "@/lib/auth";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const accessCode = getAdminAccessCode();
  const cookieStore = await cookies();
  const cookieHeader = cookieStore
    .getAll()
    .map((cookie) => `${cookie.name}=${encodeURIComponent(cookie.value)}`)
    .join("; ");
  const auth = await getDashboardAuthFromCookieHeader(cookieHeader);

  if (!auth) {
    return (
      <AdminAccessScreen
        error={
          !accessCode
            ? "Set ADMIN_ACCESS_CODE or DEMO_ACCESS_CODE on the server to enable dashboard access."
            : undefined
        }
      />
    );
  }

  return <DashboardShell auth={auth}>{children}</DashboardShell>;
}
