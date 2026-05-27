import { PublicNav, PublicFooter } from "@/components/PublicLayout";

const measures = [
  { title: "Google OAuth only", body: "AgentWing uses Google sign-in. No password is stored by AgentWing. No email/password login exists." },
  { title: "API keys hashed at rest", body: "Generated API keys are shown once and stored as a SHA-256 hash. The full key cannot be retrieved after creation." },
  { title: "BYOK keys encrypted server-side", body: "E2B and other BYOK sandbox provider keys are encrypted using AES-GCM with a Cloudflare Worker secret. The raw key is never returned to the browser." },
  { title: "Workspace isolation", body: "Every database query filters by workspace_id. Users cannot access data from other workspaces." },
  { title: "Receipts avoid secrets", body: "Audit receipts record action metadata and decisions, not file contents. Secret-bearing files like .env are blocked before their contents can be exposed." },
  { title: "Admin console restricted", body: "The admin console (/admin) is restricted to accounts listed in the ADMIN_EMAILS server environment variable. It is not visible in the normal user dashboard or navigation." },
  { title: "No raw keys in logs", body: "API keys, E2B keys, and OAuth tokens are never logged in plaintext. Event metadata is sanitized before storage." },
  { title: "Revocation", body: "API keys can be revoked immediately. Revoked keys fail authentication on the next call." },
];

export default function SecurityPage() {
  return (
    <div className="min-h-screen bg-[#05070d] text-slate-100">
      <PublicNav />
      <main className="mx-auto max-w-3xl px-4 py-16 sm:px-6">
        <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-400">Security</p>
        <h1 className="mt-3 text-4xl font-semibold tracking-tight text-white">Security</h1>
        <p className="mt-4 text-base leading-7 text-slate-400">
          AgentWing is infrastructure for AI agent control. We take security seriously.
        </p>

        <div className="mt-8 grid gap-4 sm:grid-cols-2">
          {measures.map(({ title, body }) => (
            <div key={title} className="rounded-md border border-white/[0.08] bg-[#080b12] p-5">
              <div className="flex items-center gap-2">
                <span className="size-2 rounded-full bg-emerald-400 shrink-0" />
                <p className="font-semibold text-white">{title}</p>
              </div>
              <p className="mt-2 text-sm leading-6 text-slate-400">{body}</p>
            </div>
          ))}
        </div>

        <div className="mt-8 rounded-md border border-amber-300/20 bg-amber-300/[0.04] p-6">
          <p className="font-semibold text-amber-200">Reporting security issues</p>
          <p className="mt-2 text-sm text-slate-400">
            If you discover a security vulnerability in AgentWing, please report it responsibly to{" "}
            <a href="mailto:founder@gpmai.dev" className="text-cyan-200 underline">founder@gpmai.dev</a>.
            Do not open public GitHub issues for security vulnerabilities.
          </p>
          <p className="mt-3 text-sm text-slate-400">
            For code issues and non-security bugs:{" "}
            <a href="https://github.com/12ziyad" target="_blank" rel="noopener noreferrer" className="text-cyan-200 underline">github.com/12ziyad</a>
          </p>
        </div>
      </main>
      <PublicFooter />
    </div>
  );
}
