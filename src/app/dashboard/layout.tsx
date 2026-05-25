import { cookies } from "next/headers";
import { DashboardShell } from "@/components/dashboard/DashboardShell";
import { AdminAccessScreen } from "@/components/dashboard/AdminAccessScreen";
import { ADMIN_COOKIE_NAME, getAdminAccessCode, hashAdminAccessCode } from "@/lib/adminAccess";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const accessCode = getAdminAccessCode();
  const cookieStore = await cookies();
  const cookieValue = cookieStore.get(ADMIN_COOKIE_NAME)?.value;
  const authenticated = accessCode ? cookieValue === (await hashAdminAccessCode(accessCode)) : false;

  if (!authenticated) {
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

  return <DashboardShell>{children}</DashboardShell>;
}
