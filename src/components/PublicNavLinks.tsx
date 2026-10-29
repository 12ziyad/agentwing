"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const navLinks = [
  { href: "/playground", label: "Playground" },
  { href: "/pricing", label: "Pricing" },
  { href: "/docs", label: "Docs" },
  { href: "/security", label: "Security" },
  { href: "/open-source", label: "Open Source" },
  { href: "/blog", label: "Blog" },
];

function isActive(pathname: string, href: string) {
  if (href === "/blog") return pathname === "/blog" || pathname.startsWith("/blog/");
  return pathname === href;
}

export function PublicNavLinks() {
  const pathname = usePathname();

  return (
    <nav className="hidden items-center gap-1 md:flex">
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

/** Below `md` the links collapse into a native disclosure — no JS state needed. */
export function PublicNavMobile() {
  const pathname = usePathname();

  return (
    <details className="group relative md:hidden">
      <summary
        aria-label="Menu"
        className="flex size-8 cursor-pointer list-none items-center justify-center rounded border border-white/[0.1] text-slate-300 [&::-webkit-details-marker]:hidden"
      >
        <svg viewBox="0 0 16 16" className="size-4" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden>
          <path className="group-open:hidden" d="M2 4h12M2 8h12M2 12h12" />
          <path className="hidden group-open:block" d="M3.5 3.5l9 9M12.5 3.5l-9 9" />
        </svg>
      </summary>
      <nav className="absolute right-0 top-10 z-40 w-48 rounded-lg border border-white/[0.1] bg-[#0a0e16] p-1.5 shadow-2xl shadow-black/60">
        {navLinks.map(({ href, label }) => (
          <Link
            key={href}
            href={href}
            aria-current={isActive(pathname, href) ? "page" : undefined}
            className="block rounded px-3 py-2 text-sm text-slate-300 transition hover:bg-white/[0.06] hover:text-white aria-[current=page]:text-cyan-200"
          >
            {label}
          </Link>
        ))}
      </nav>
    </details>
  );
}
