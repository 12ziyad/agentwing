"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ArrowUpRight, Menu, X } from "lucide-react";

const navLinks = [
  { href: "/playground", label: "Playground" },
  { href: "/#integrations", label: "Integrations" },
  { href: "/docs", label: "Docs" },
  { href: "/pricing", label: "Pricing" },
  { href: "https://github.com/12ziyad/agentwing", label: "GitHub", external: true },
];

function NavItems({ mobile = false }: { mobile?: boolean }) {
  const pathname = usePathname();
  const linkClass = "inline-flex items-center gap-1 rounded-md px-3 text-sm text-muted hover:text-foreground aria-[current=page]:text-brand";

  return (
    <>
      {navLinks.map(({ href, label, external }) => (
        <Link
          key={href}
          href={href}
          aria-current={pathname === href ? "page" : undefined}
          className={`${linkClass} ${mobile ? "min-h-11 hover:bg-white/[0.06]" : "min-h-10"}`}
          onClick={mobile ? (event) => event.currentTarget.closest("details")?.removeAttribute("open") : undefined}
        >
          {label} {external && <ArrowUpRight size={13} aria-hidden />}
        </Link>
      ))}
    </>
  );
}

export function PublicNavLinks() {
  return (
    <nav aria-label="Main" className="hidden items-center md:flex">
      <NavItems />
    </nav>
  );
}

export function PublicNavMobile() {
  return (
    <details className="group relative md:hidden">
      <summary
        aria-label="Menu"
        className="flex size-10 cursor-pointer list-none items-center justify-center rounded-md border border-outline text-foreground [&::-webkit-details-marker]:hidden"
      >
        <Menu size={18} className="group-open:hidden" aria-hidden />
        <X size={18} className="hidden group-open:block" aria-hidden />
      </summary>
      <nav aria-label="Main" className="absolute top-12 right-0 z-40 flex w-48 flex-col rounded-lg border border-outline bg-surface p-1.5 shadow-2xl shadow-black/60">
        <NavItems mobile />
      </nav>
    </details>
  );
}
