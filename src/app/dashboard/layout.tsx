import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { DashboardShell } from "@/components/dashboard/DashboardShell";
import { getDashboardAuthFromCookieHeader } from "@/lib/auth";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const cookieStore = await cookies();
  const cookieHeader = cookieStore
    .getAll()
    .map((cookie) => `${cookie.name}=${encodeURIComponent(cookie.value)}`)
    .join("; ");
  const auth = await getDashboardAuthFromCookieHeader(cookieHeader);

  if (!auth) {
    redirect("/api/auth/signin/google");
  }

  return <DashboardShell auth={auth}>{children}</DashboardShell>;
}
