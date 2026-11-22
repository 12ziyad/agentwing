import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { AgentWingBrand } from "@/components/AgentWingBrand";
import { PublicNavLinks, PublicNavMobile } from "@/components/PublicNavLinks";

const footerLinks = {
  Product: [
    { href: "/playground", label: "Playground" },
    { href: "/pricing", label: "Pricing" },
    { href: "/docs", label: "Docs" },
  ],
  Resources: [
    { href: "/open-source", label: "Open Source" },
    { href: "/security", label: "Security" },
    { href: "/blog", label: "Blog" },
    { href: "/vision", label: "Vision" },
  ],
  Company: [
    { href: "/about", label: "About & Team" },
    { href: "/support", label: "Support" },
    { href: "/contact", label: "Contact" },
    { href: "/privacy", label: "Privacy Policy" },
    { href: "/terms", label: "Terms of Service" },
  ],
};

const publicWidth = "mx-auto w-full max-w-[1360px] px-[clamp(20px,5vw,72px)]";

export function PublicNav({ isSignedIn }: { isSignedIn?: boolean }) {
  return (
    <header className="sticky top-0 z-30 border-b border-divider bg-background/95 font-sans backdrop-blur">
      <div className={`${publicWidth} flex min-h-[68px] items-center justify-between gap-3`}>
        <AgentWingBrand />
        <PublicNavLinks />
        <div className="flex items-center gap-2 sm:gap-3">
          <a
            href={isSignedIn ? "/dashboard" : "/api/auth/signin/google?next=/dashboard"}
            className="inline-flex min-h-10 items-center gap-1.5 whitespace-nowrap rounded-md border border-brand-outline bg-brand-surface px-2.5 text-xs font-semibold text-brand-text transition hover:border-brand sm:px-3.5 sm:text-sm"
          >
            {isSignedIn ? "Dashboard" : "Get started"} <ArrowUpRight size={14} aria-hidden />
          </a>
          <PublicNavMobile />
        </div>
      </div>
    </header>
  );
}

export function PublicFooter() {
  return (
    <footer className="border-t border-divider bg-background font-sans text-muted">
      <div className={`${publicWidth} py-12 sm:py-14`}>
        <div className="grid grid-cols-2 gap-8 sm:grid-cols-[1.4fr_1fr_1fr_1fr]">
          <div className="col-span-2 sm:col-span-1">
            <AgentWingBrand />
            <div className="mt-3 flex flex-wrap gap-x-4 gap-y-2 text-sm">
              <a href="https://github.com/12ziyad/agentwing" className="inline-flex items-center gap-1 hover:text-brand">
                GitHub <ArrowUpRight size={13} aria-hidden />
              </a>
              <a href="https://github.com/12ziyad/agentwing/blob/main/LICENSE" className="hover:text-brand">Apache 2.0</a>
            </div>
          </div>
          {Object.entries(footerLinks).map(([section, links]) => (
            <div key={section}>
              <p className="text-sm font-semibold text-foreground">{section}</p>
              <ul className="mt-3 space-y-2.5">
                {links.map(({ href, label }) => (
                  <li key={href}>
                    <Link href={href} className="text-sm hover:text-brand">
                      {label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <div className="mt-10 border-t border-divider pt-6">
          <p className="text-xs">© 2026 GPMai Labs</p>
        </div>
      </div>
    </footer>
  );
}
