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
  LogOut,
  Menu,
  PlugZap,
  ReceiptText,
  Route,
  Settings,
  ShieldCheck,
} from "lucide-react";
import { AgentWingBrand } from "@/components/AgentWingBrand";
import type { DashboardAuthContext } from "@/lib/agentwingTypes";

const navItems = [
  { href: "/dashboard", label: "Overview", icon: LayoutDashboard },
  { href: "/dashboard/runs", label: "Runs", icon: Route },
  { href: "/dashboard/projects", label: "Projects", icon: Boxes },
  { href: "/dashboard/api-keys", label: "API Keys", icon: KeyRound },
  { href: "/dashboard/policies", label: "Policies", icon: ShieldCheck },
  { href: "/dashboard/sandboxes", label: "Sandboxes", icon: Activity },
  { href: "/dashboard/receipts", label: "Receipts", icon: ReceiptText },
  { href: "/dashboard/usage", label: "Usage", icon: Gauge },
  { href: "/dashboard/integrations", label: "Integrations", icon: PlugZap },
  { href: "/dashboard/settings", label: "Settings", icon: Settings },
];

function DashboardNav({ mobile = false }: { mobile?: boolean }) {
  const pathname = usePathname();

  return (
    <nav aria-label="Dashboard" className="space-y-1 p-2">
      {navItems.map(({ href, label, icon: Icon }) => {
        const current = pathname === href;
        const active = current || (href !== "/dashboard" && pathname.startsWith(href + "/"));
        return (
          <Link
            key={href}
            href={href}
            aria-current={current ? "page" : active ? "location" : undefined}
            onClick={mobile ? (event) => event.currentTarget.closest("details")?.removeAttribute("open") : undefined}
            className={`flex min-h-10 items-center gap-2.5 rounded-md border px-3 py-2 text-sm font-medium transition ${
              active
                ? "border-brand-outline bg-brand-surface text-brand"
                : "border-transparent text-muted hover:bg-raised hover:text-foreground"
            }`}
          >
            <Icon className="size-4 shrink-0" aria-hidden />
            {label}
          </Link>
        );
      })}
    </nav>
  );
}

export function DashboardShell({ children, auth }: { children: React.ReactNode; auth: DashboardAuthContext }) {
  const user = auth.user;
  const workspace = auth.workspace;
  const maskedUser = user?.email ? "Signed in" : "Admin";

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="flex min-h-screen">
        <aside className="sticky top-0 hidden h-dvh w-60 shrink-0 overflow-y-auto border-r border-divider bg-surface lg:block">
          <div className="border-b border-divider px-5 py-5">
            <AgentWingBrand />
            {workspace && (
              <div className="mt-4 rounded-md border border-divider bg-background px-3 py-2">
                <p className="font-mono text-[10px] uppercase tracking-[0.1em] text-subdued">Workspace</p>
                <p className="mt-1 truncate text-sm font-medium">{workspace.name}</p>
                <p className="mt-1 text-xs capitalize text-muted">{auth.role}</p>
              </div>
            )}
          </div>
          <div className="px-2 py-3"><DashboardNav /></div>
        </aside>
        <div className="min-w-0 flex-1">
          <header className="sticky top-0 z-20 border-b border-divider bg-background/95 px-4 py-3 backdrop-blur sm:px-6 lg:px-8">
            <div className="flex items-center justify-between gap-2">
              <div className="min-w-0">
                <div className="lg:hidden"><AgentWingBrand /></div>
                <p className="hidden text-sm font-semibold lg:block">AgentWing Console</p>
                <p className="hidden truncate text-xs text-subdued lg:block">
                  {workspace ? workspace.name : "Admin mode"}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
                <div className="hidden items-center gap-2 rounded-md border border-divider bg-surface px-2 py-1.5 sm:flex">
                  {user?.image ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={user.image} alt="" className="size-6 rounded-full" referrerPolicy="no-referrer" />
                  ) : (
                    <span className="flex size-6 items-center justify-center rounded-full bg-brand text-xs font-semibold text-brand-ink">
                      {workspace?.name?.[0]?.toUpperCase() ?? "A"}
                    </span>
                  )}
                  <span className="max-w-36 truncate text-xs font-medium text-secondary">
                    {maskedUser}
                  </span>
                </div>
                <Link
                  href="/docs"
                  aria-label="Docs"
                  className="inline-flex min-h-10 items-center gap-1.5 rounded-md border border-outline bg-surface px-2.5 text-xs font-medium text-secondary transition hover:text-foreground"
                >
                  <BookOpen className="size-3.5" aria-hidden />
                  <span className="hidden sm:inline">Docs</span>
                </Link>
                <form action="/api/auth/signout" method="post">
                  <button
                    type="submit"
                    aria-label="Sign out"
                    className="inline-flex min-h-10 items-center gap-1.5 rounded-md border border-outline bg-surface px-2.5 text-xs font-medium text-secondary transition hover:text-foreground"
                  >
                    <LogOut className="size-3.5" aria-hidden />
                    <span className="hidden sm:inline">Sign out</span>
                  </button>
                </form>
                <details className="relative lg:hidden">
                  <summary
                    aria-label="Dashboard menu"
                    className="flex size-10 cursor-pointer list-none items-center justify-center rounded-md border border-outline bg-surface text-foreground [&::-webkit-details-marker]:hidden"
                  >
                    <Menu size={18} aria-hidden />
                  </summary>
                  <div className="absolute top-12 right-0 max-h-[calc(100dvh-5rem)] w-52 overflow-y-auto rounded-lg border border-outline bg-surface shadow-2xl shadow-black/50">
                    <DashboardNav mobile />
                  </div>
                </details>
              </div>
            </div>
          </header>
          <main className="px-4 py-6 sm:px-6 lg:px-8">{children}</main>
        </div>
      </div>
    </div>
  );
}
