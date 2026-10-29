import { PublicNav, PublicFooter } from "@/components/PublicLayout";

const REPO = "https://github.com/12ziyad/agentwing";

// What is actually in the repository today. npm publishing has not happened
// yet, so each entry links to its source rather than claiming an install.
const repos = [
  {
    name: "@agentwing/hook",
    path: "packages/hook",
    description: "A PreToolUse hook for Claude Code, Cursor and Codex. Every Bash, Write, Edit, Read and WebFetch is checked before it runs — no changes to your agent.",
  },
  {
    name: "@agentwing/sdk",
    path: "packages/sdk",
    description: "TypeScript SDK with a typed HTTP client, guardAction() for the full decide-then-run loop, and runtime approval helpers. ESM and CJS, Node 18+.",
  },
  {
    name: "@agentwing/receipt-verifier",
    path: "packages/receipt-verifier",
    description: "Verifies an exported receipt log offline, without trusting AgentWing. If an entry was altered, it says which one.",
  },
  {
    name: "examples",
    path: "examples",
    description: "Runnable examples: a guarded runner, a human approval flow for a production deploy, and a small agent loop that asks before every action.",
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
            <a
              key={repo.name}
              href={`${REPO}/tree/main/${repo.path}`}
              target="_blank"
              rel="noopener noreferrer"
              className="group rounded-md border border-white/[0.08] bg-[#080b12] p-6 transition hover:border-white/20"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="font-mono text-base font-semibold text-white">{repo.name}</p>
                  <p className="mt-0.5 font-mono text-xs text-slate-500">{repo.path} · Apache-2.0</p>
                </div>
                <span className="text-xs font-semibold text-cyan-300 transition group-hover:text-cyan-200">View source →</span>
              </div>
              <p className="mt-3 text-sm leading-6 text-slate-400">{repo.description}</p>
            </a>
          ))}
        </div>

        <div className="mt-8 rounded-md border border-white/[0.08] bg-[#080b12] p-6">
          <p className="font-semibold text-white">One repository</p>
          <p className="mt-2 text-sm text-slate-400">
            The hosted service, the policy engine, the packages and the test suite all live in one public repository.
          </p>
          <a
            href={REPO}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-4 inline-flex items-center gap-2 rounded border border-white/[0.1] px-4 py-2 text-sm font-semibold text-slate-200 transition hover:text-white"
          >
            github.com/12ziyad/agentwing
          </a>
        </div>
      </main>
      <PublicFooter />
    </div>
  );
}
