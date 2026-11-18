"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Activity, Boxes, Gauge, KeyRound, LayoutDashboard, PlugZap, ReceiptText, Route, Settings, ShieldCheck,
} from "lucide-react";

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

export function DashboardNav({ mobile = false }: { mobile?: boolean }) {
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
