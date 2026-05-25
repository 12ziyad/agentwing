"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Activity,
  BookOpen,
  Boxes,
  Gauge,
  KeyRound,
  LayoutDashboard,
  ReceiptText,
  ShieldCheck,
} from "lucide-react";
import type { DashboardAuthContext } from "@/lib/agentwingTypes";

const navItems = [
  { href: "/dashboard", label: "Overview", icon: LayoutDashboard },
  { href: "/dashboard/projects", label: "Projects", icon: Boxes },
  { href: "/dashboard/api-keys", label: "API Keys", icon: KeyRound },
  { href: "/dashboard/policies", label: "Policies", icon: ShieldCheck },
  { href: "/dashboard/sandboxes", label: "Sandboxes", icon: Activity },
  { href: "/dashboard/receipts", label: "Receipts", icon: ReceiptText },
  { href: "/dashboard/usage", label: "Usage", icon: Gauge },
];

export function DashboardShell({ children, auth }: { children: React.ReactNode; auth: DashboardAuthContext }) {
  const pathname = usePathname();
  const user = auth.mode === "user" ? auth.user : undefined;
  const workspace = auth.mode === "user" ? auth.workspace : undefined;

  return (
    <main className="min-h-screen bg-[#05070d] text-slate-100">
      <div className="flex min-h-screen">
        <aside className="hidden w-64 border-r border-white/[0.08] bg-[#080b12] lg:block">
          <div className="border-b border-white/[0.08] px-5 py-5">
            <Link href="/" className="text-lg font-semibold text-white">
              AgentWing
            </Link>
            <p className="mt-1 text-xs leading-5 text-slate-400">
              Universal runtime control for AI agent actions
            </p>
          </div>
          <nav className="space-y-1 px-3 py-4">
            {navItems.map((item) => {
              const Icon = item.icon;
              const active = pathname === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition ${
                    active
                      ? "border border-cyan-300/20 bg-cyan-300/[0.08] text-cyan-100"
                      : "text-slate-300 hover:bg-white/[0.04] hover:text-white"
                  }`}
                >
                  <Icon className="size-4" />
                  {item.label}
                </Link>
              );
            })}
          </nav>
          <div className="mx-3 mt-4 rounded-md border border-white/[0.08] bg-[#05070d] p-3">
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400">
              V1 control plane
            </p>
            <p className="mt-2 text-xs leading-5 text-slate-300">
              Policy, approval, sandbox routing, restore points, feedback, audit receipts.
            </p>
          </div>
        </aside>
        <section className="min-w-0 flex-1">
          <header className="sticky top-0 z-20 border-b border-white/[0.08] bg-[#05070d]/92 px-4 py-3 backdrop-blur sm:px-6 lg:px-8">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-sm font-semibold text-white">AgentWing Console</p>
                <p className="text-xs text-slate-400">
                  {workspace ? workspace.name : "Admin mode"} - API-first control plane for agent tool execution
                </p>
              </div>
              <div className="flex items-center gap-2">
                <div className="hidden items-center gap-2 rounded-md border border-white/[0.08] bg-white/[0.04] px-2 py-1.5 sm:flex">
                  {user?.image ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={user.image} alt="" className="size-6 rounded-full" referrerPolicy="no-referrer" />
                  ) : (
                    <span className="flex size-6 items-center justify-center rounded-full bg-cyan-300 text-xs font-semibold text-[#031018]">
                      {user?.email?.[0]?.toUpperCase() ?? "A"}
                    </span>
                  )}
                  <span className="max-w-44 truncate text-xs font-medium text-slate-200">
                    {user?.email ?? "Admin fallback"}
                  </span>
                </div>
                <Link
                  href="/docs"
                  className="inline-flex items-center gap-2 rounded-md border border-white/[0.1] bg-white/[0.04] px-3 py-2 text-xs font-semibold text-slate-100 transition hover:bg-white/[0.07]"
                >
                  <BookOpen className="size-4" />
                  Docs
                </Link>
                <Link
                  href="/runtime-lab"
                  className="rounded-md border border-cyan-300/25 bg-cyan-300 px-3 py-2 text-xs font-semibold text-[#031018] transition hover:bg-cyan-200"
                >
                  Runtime Lab
                </Link>
                <form action="/api/auth/signout" method="post">
                  <button
                    type="submit"
                    className="rounded-md border border-white/[0.1] bg-white/[0.04] px-3 py-2 text-xs font-semibold text-slate-100 transition hover:bg-white/[0.07]"
                  >
                    Sign out
                  </button>
                </form>
              </div>
            </div>
          </header>
          <div className="px-4 py-6 sm:px-6 lg:px-8">{children}</div>
        </section>
      </div>
    </main>
  );
}
