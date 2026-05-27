"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const navLinks = [
  { href: "/open-source", label: "Open Source" },
  { href: "/vision", label: "Vision" },
  { href: "/blog", label: "Blog" },
  { href: "/docs", label: "Docs" },
];

function isActive(pathname: string, href: string) {
  if (href === "/blog") return pathname === "/blog" || pathname.startsWith("/blog/");
  return pathname === href;
}

export function PublicNavLinks() {
  const pathname = usePathname();

  return (
    <nav className="hidden items-center gap-2 sm:flex">
      {navLinks.map(({ href, label }) => {
        const active = isActive(pathname, href);
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? "page" : undefined}
            className={`rounded px-2.5 py-1.5 text-sm transition ${
              active
                ? "border border-cyan-300/25 bg-cyan-300/[0.08] font-semibold text-cyan-100"
                : "text-slate-400 hover:text-white"
            }`}
          >
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
