import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getDashboardAuthFromCookieHeader } from "@/lib/auth";
import { isAdminEmail } from "@/lib/adminEmails";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const cookieStore = await cookies();
  const cookieHeader = cookieStore
    .getAll()
    .map((c) => `${c.name}=${encodeURIComponent(c.value)}`)
    .join("; ");
  const auth = await getDashboardAuthFromCookieHeader(cookieHeader);

  if (!auth) {
    redirect("/api/auth/signin/google");
  }

  if (auth.mode !== "user" || !isAdminEmail(auth.user.email)) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#05070d] px-4 text-slate-100">
        <div className="w-full max-w-sm rounded-md border border-red-300/20 bg-[#080b12] p-6 text-center">
          <p className="text-sm font-semibold text-red-200">403 — Access denied</p>
          <p className="mt-2 text-xs text-slate-400">
            Your account is not authorized to access the admin console.
          </p>
          <a
            href="/dashboard"
            className="mt-4 inline-block rounded border border-white/[0.1] px-4 py-2 text-xs font-semibold text-slate-200"
          >
            Back to dashboard
          </a>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#05070d] text-slate-100">
      <header className="sticky top-0 z-20 border-b border-red-300/15 bg-[#05070d]/95 px-4 py-3 backdrop-blur sm:px-6">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className="text-sm font-semibold text-white">AgentWing Admin</span>
            <span className="rounded border border-red-300/25 bg-red-400/[0.08] px-2 py-0.5 text-[10px] font-semibold text-red-200">
              Protected admin console
            </span>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs text-slate-400">{auth.user.email}</span>
            <a
              href="/dashboard"
              className="rounded border border-white/[0.1] px-3 py-1.5 text-xs font-semibold text-slate-300 transition hover:text-white"
            >
              Dashboard
            </a>
            <form action="/api/auth/signout" method="post">
              <button type="submit" className="rounded border border-white/[0.1] px-3 py-1.5 text-xs font-semibold text-slate-300 transition hover:text-white">
                Sign out
              </button>
            </form>
          </div>
        </div>
      </header>
      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6">{children}</div>
    </main>
  );
}
