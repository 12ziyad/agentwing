import { PublicNav, PublicFooter } from "@/components/PublicLayout";

const repos = [
  {
    name: "agentwing-sdk",
    license: "MIT — planned",
    description: "TypeScript SDK for calling AgentWing policy APIs. Typed check-action client, decision helpers, and agent loop wrappers.",
    status: "coming-soon",
  },
  {
    name: "agentwing-policy-pack",
    license: "MIT — planned",
    description: "Default critical runtime policies for autonomous agents: .env protection, destructive command blocking, credential exfiltration rules.",
    status: "coming-soon",
  },
  {
    name: "agentwing-examples",
    license: "MIT — planned",
    description: "Integration examples for Claude Code, Codex, Cursor, and custom agents. Shows full check-action → decision → re-plan loop.",
    status: "coming-soon",
  },
  {
    name: "agentwing-sandbox-adapters",
    license: "MIT — planned",
    description: "BYOK sandbox adapters for E2B, Daytona, Cloudflare Sandbox, and custom HTTP sandboxes.",
    status: "coming-soon",
  },
];

export default function OpenSourcePage() {
  return (
    <div className="min-h-screen bg-[#05070d] text-slate-100">
      <PublicNav />
      <main className="mx-auto max-w-4xl px-4 py-16 sm:px-6">
        <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-cyan-200">Open Source</p>
        <h1 className="mt-3 text-4xl font-semibold tracking-tight text-white">AgentWing open source</h1>
        <p className="mt-4 max-w-2xl text-base leading-7 text-slate-400">
          The AgentWing runtime service is hosted infrastructure. These open-source components let you integrate, extend, and self-host pieces of the control layer.
        </p>

        <div className="mt-8 grid gap-4">
          {repos.map((repo) => (
            <div key={repo.name} className="rounded-md border border-white/[0.08] bg-[#080b12] p-6">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="font-mono text-base font-semibold text-white">{repo.name}</p>
                  <p className="mt-0.5 text-xs text-slate-500">{repo.license}</p>
                </div>
                <span className="rounded border border-amber-300/20 bg-amber-300/[0.06] px-2 py-0.5 text-xs font-semibold text-amber-200">
                  Repository publishing in progress
                </span>
              </div>
              <p className="mt-3 text-sm leading-6 text-slate-400">{repo.description}</p>
            </div>
          ))}
        </div>

        <div className="mt-8 rounded-md border border-white/[0.08] bg-[#080b12] p-6">
          <p className="font-semibold text-white">GitHub</p>
          <p className="mt-2 text-sm text-slate-400">
            Repositories are publishing to GitHub. Follow for updates.
          </p>
          <a
            href="https://github.com/12ziyad"
            target="_blank"
            rel="noopener noreferrer"
            className="mt-4 inline-flex items-center gap-2 rounded border border-white/[0.1] px-4 py-2 text-sm font-semibold text-slate-200 transition hover:text-white"
          >
            github.com/12ziyad
          </a>
        </div>
      </main>
      <PublicFooter />
    </div>
  );
}
