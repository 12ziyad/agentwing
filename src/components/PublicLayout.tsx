import Link from "next/link";
import { PublicNavLinks } from "@/components/PublicNavLinks";

const footerLinks = {
  Product: [
    { href: "/docs", label: "Docs" },
    { href: "/dashboard", label: "Dashboard" },
    { href: "/blog", label: "Blog" },
  ],
  Company: [
    { href: "/vision", label: "Vision" },
    { href: "/open-source", label: "Open Source" },
    { href: "/contact", label: "Contact" },
  ],
  Legal: [
    { href: "/privacy", label: "Privacy Policy" },
    { href: "/terms", label: "Terms of Service" },
    { href: "/security", label: "Security" },
    { href: "/support", label: "Support" },
  ],
};

export function PublicNav({ isSignedIn }: { isSignedIn?: boolean }) {
  return (
    <header className="sticky top-0 z-30 border-b border-white/[0.08] bg-[#05070d]/90 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-6 px-4 py-4 sm:px-6">
        <div className="flex items-center gap-6">
          <Link href="/" className="text-sm font-semibold text-white">
            AgentWing
          </Link>
          <PublicNavLinks />
        </div>
        <div className="flex items-center gap-2">
          {isSignedIn ? (
            <Link
              href="/dashboard"
              className="rounded border border-cyan-300/25 bg-cyan-300/[0.08] px-3 py-1.5 text-xs font-semibold text-cyan-100 transition hover:bg-cyan-300/[0.14]"
            >
              Dashboard
            </Link>
          ) : (
            <a
              href="/api/auth/signin/google?next=/dashboard"
              className="rounded border border-white/[0.1] px-3 py-1.5 text-xs font-semibold text-slate-200 transition hover:text-white"
            >
              Sign in
            </a>
          )}
        </div>
      </div>
    </header>
  );
}

export function PublicFooter() {
  return (
    <footer className="border-t border-white/[0.08] bg-[#080b12]">
      <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
        <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <p className="text-sm font-semibold text-white">AgentWing</p>
            <p className="mt-2 text-xs leading-5 text-slate-400">
              Runtime control layer for AI agents. Policy, approval, sandbox routing, restore points, and audit receipts.
            </p>
            <div className="mt-4 flex gap-3">
              <a href="https://github.com/12ziyad" target="_blank" rel="noopener noreferrer" className="text-xs text-slate-500 transition hover:text-slate-200">
                GitHub
              </a>
              <a href="https://www.reddit.com/user/Far_Pangolin_7657/" target="_blank" rel="noopener noreferrer" className="text-xs text-slate-500 transition hover:text-slate-200">
                Reddit
              </a>
            </div>
          </div>
          {Object.entries(footerLinks).map(([section, links]) => (
            <div key={section}>
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">{section}</p>
              <ul className="mt-3 space-y-2">
                {links.map(({ href, label }) => (
                  <li key={href}>
                    <Link href={href} className="text-xs text-slate-500 transition hover:text-slate-200">
                      {label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <div className="mt-10 flex flex-wrap items-center justify-between gap-4 border-t border-white/[0.06] pt-6">
          <p className="text-xs text-slate-600">© 2026 GPMai Labs. All rights reserved.</p>
          <a href="mailto:founder@gpmai.dev" className="text-xs text-slate-600 transition hover:text-slate-400">
            founder@gpmai.dev
          </a>
        </div>
      </div>
    </footer>
  );
}
