import { PublicNav, PublicFooter } from "@/components/PublicLayout";

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-[#05070d] text-slate-100">
      <PublicNav />
      <main className="mx-auto max-w-2xl px-4 py-16 sm:px-6">
        <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-400">Legal</p>
        <h1 className="mt-3 text-4xl font-semibold tracking-tight text-white">Privacy Policy</h1>
        <p className="mt-2 text-xs text-slate-500">Last updated: 2026 · GPMai Labs</p>

        <div className="mt-10 space-y-8 text-sm leading-7 text-slate-300">
          <Section title="Who we are">
            <p>AgentWing is operated by GPMai Labs. Contact: founder@gpmai.dev.</p>
          </Section>

          <Section title="What AgentWing collects">
            <ul className="mt-2 space-y-1 text-slate-400">
              {[
                "Google profile basics — email, name, avatar — collected at sign-in via Google OAuth",
                "Workspace and project metadata you create",
                "API key hashes — the full key is never stored after creation",
                "Encrypted BYOK sandbox provider credentials (AES-GCM, server-side only)",
                "Custom policies you create",
                "Receipts — the audit log of every check-action call (action metadata, decision, risk, policy — no secret file contents)",
                "Usage counters (action checks, sandbox runs, receipts)",
                "Product and security events (sign-in, sign-out, key creation, API calls, errors)",
                "Optional diagnostic metadata in receipts and events",
              ].map((item) => (
                <li key={item} className="flex items-start gap-2"><span className="mt-0.5 text-cyan-400 shrink-0">•</span>{item}</li>
              ))}
            </ul>
          </Section>

          <Section title="What AgentWing does NOT store">
            <ul className="mt-2 space-y-1 text-slate-400">
              {[
                "User passwords — Google OAuth only, no password stored by AgentWing",
                "Raw API keys after creation — shown once, then hashed",
                "Plain-text E2B or BYOK sandbox keys — encrypted server-side, never returned to browser",
                "OAuth secrets exposed to the browser",
                "Contents of secret-bearing files (e.g., .env) in receipts",
              ].map((item) => (
                <li key={item} className="flex items-start gap-2"><span className="mt-0.5 text-slate-500 shrink-0">•</span>{item}</li>
              ))}
            </ul>
          </Section>

          <Section title="How we use your data">
            <p>Data is used to operate, secure, meter, debug, and improve AgentWing. We do not sell user data. We do not use your data to train AI models.</p>
          </Section>

          <Section title="Security">
            <p>API keys are hashed at rest. BYOK sandbox keys are encrypted server-side using Worker secrets. Workspace isolation ensures users cannot access other workspaces. Detailed security information: <a href="/security" className="text-cyan-200 underline">agentwing.gpmai.dev/security</a>.</p>
          </Section>

          <Section title="Sub-processors">
            <div className="mt-2 space-y-2 text-slate-400">
              {[
                { name: "Google OAuth", use: "Sign-in only. Google&apos;s privacy policy applies." },
                { name: "Cloudflare", use: "Hosting, Workers, D1 database, logs." },
                { name: "E2B", use: "Sandbox execution only, and only when users connect their own E2B key." },
                { name: "OpenAI", use: "Only if optional Runtime Lab / agent planning features are enabled." },
              ].map(({ name, use }) => (
                <div key={name} className="flex gap-3">
                  <span className="w-28 shrink-0 font-semibold text-slate-300">{name}</span>
                  <span dangerouslySetInnerHTML={{ __html: use }} />
                </div>
              ))}
            </div>
          </Section>

          <Section title="Data retention and deletion">
            <p>Receipts and events are retained to operate the service. To request data export or account deletion, email <a href="mailto:founder@gpmai.dev" className="text-cyan-200 underline">founder@gpmai.dev</a> with your workspace ID.</p>
          </Section>

          <Section title="Changes">
            <p>We will update this page when our data practices change. Continued use after an update constitutes acceptance.</p>
          </Section>

          <Section title="Contact">
            <p>Privacy questions: <a href="mailto:founder@gpmai.dev" className="text-cyan-200 underline">founder@gpmai.dev</a></p>
          </Section>
        </div>
      </main>
      <PublicFooter />
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h2 className="text-base font-semibold text-white">{title}</h2>
      <div className="mt-2">{children}</div>
    </div>
  );
}
