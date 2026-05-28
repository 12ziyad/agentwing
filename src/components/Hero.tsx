"use client";

import Link from "next/link";
import { PublicNav, PublicFooter } from "@/components/PublicLayout";

const controlFlow = [
  { label: "Agent proposes action", sub: "file_access / shell_command / network_call" },
  { label: "Policy decision", sub: "Default blocks / Custom policies" },
  { label: "Guarded route", sub: "approval / sandbox / checkpoint / external runner" },
  { label: "Execution lifecycle", sub: "logs / result / sealed receipt" },
];

const decisions = [
  { d: "allow", cls: "border-emerald-300/25 bg-emerald-300/[0.08] text-emerald-100" },
  { d: "block", cls: "border-red-300/25 bg-red-400/[0.08] text-red-100" },
  { d: "approval_required", cls: "border-amber-300/25 bg-amber-300/[0.06] text-amber-100" },
  { d: "sandbox_required", cls: "border-cyan-300/25 bg-cyan-300/[0.06] text-cyan-100" },
  { d: "restore_point_required", cls: "border-violet-300/25 bg-violet-300/[0.06] text-violet-100" },
];

const features = [
  { title: "Policy checks", body: "Critical safety blocks run first. Custom policies then match before the remaining default ruleset, with wildcard patterns and per-project scope." },
  { title: "Approval gates", body: "Route any action through a human-in-the-loop approval. Agents pause and wait. You approve or reject from the dashboard." },
  { title: "BYOK Sandbox routing", body: "Bring your own E2B API key. Unsafe actions are routed to isolated execution before touching production." },
  { title: "Restore points", body: "Before mutating files, state, or config, AgentWing signals the agent to create a checkpoint first." },
  { title: "Structured feedback", body: "Every decision includes human-readable feedback and a next step the agent can use to re-plan." },
  { title: "Audit receipts", body: "Every check or execution run creates a receipt: decision, risk, policy, action metadata, and execution result when available." },
];

export function Hero({ isSignedIn }: { isSignedIn?: boolean }) {
  return (
    <div className="min-h-screen bg-[#05070d] text-slate-100">
      <PublicNav isSignedIn={isSignedIn} />

      {/* Hero */}
      <section className="mx-auto max-w-6xl px-4 pb-16 pt-20 sm:px-6 lg:pt-28">
        <div className="grid gap-12 lg:grid-cols-2 lg:items-center">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-cyan-300">Runtime infrastructure</p>
            <h1 className="mt-4 flex items-center gap-4 text-5xl font-semibold leading-[1.08] tracking-tight text-white lg:text-6xl">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/agentwing-icon.png" alt="" className="size-14 rounded-xl lg:size-16" />
              AgentWing
            </h1>
            <p className="mt-4 text-xl font-medium text-slate-300">
              Guarded execution for AI agents.
            </p>
            <p className="mt-5 max-w-lg text-base leading-7 text-slate-400">
              AgentWing checks and routes execution before tools run. It blocks dangerous actions, routes risky actions to sandbox, requests approval when needed, requires restore points for sensitive changes, and records the full receipt.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              {isSignedIn ? (
                <Link href="/dashboard" className="rounded-md border border-cyan-300/30 bg-cyan-300/[0.1] px-5 py-2.5 text-sm font-semibold text-cyan-100 transition hover:bg-cyan-300/[0.16]">
                  Open dashboard
                </Link>
              ) : (
                <>
                  <a href="/api/auth/signin/google?next=/dashboard" className="rounded-md bg-cyan-300 px-5 py-2.5 text-sm font-semibold text-[#031018] transition hover:bg-cyan-200">
                    Sign up free with Google
                  </a>
                  <a href="/api/auth/signin/google?next=/dashboard" className="rounded-md border border-white/[0.1] px-5 py-2.5 text-sm font-semibold text-slate-200 transition hover:text-white">
                    Sign in
                  </a>
                </>
              )}
              <Link href="/docs" className="rounded-md border border-white/[0.1] px-5 py-2.5 text-sm font-semibold text-slate-400 transition hover:text-white">
                Docs
              </Link>
            </div>
            {!isSignedIn && (
              <p className="mt-3 text-xs text-slate-500">Continue with Google. No password needed.</p>
            )}
          </div>

          {/* Control plane visual */}
          <div className="rounded-xl border border-white/[0.08] bg-[#080b12] p-6">
            <p className="mb-4 text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Control plane</p>
            <div className="space-y-1">
              {controlFlow.map((item, i) => (
                <div key={item.label} className="flex items-start gap-3">
                  <div className="flex flex-col items-center">
                    <span className="flex size-6 shrink-0 items-center justify-center rounded border border-cyan-300/20 bg-cyan-300/[0.08] font-mono text-xs text-cyan-100">{i + 1}</span>
                    {i < controlFlow.length - 1 && <span className="my-1 h-4 w-px bg-white/[0.08]" />}
                  </div>
                  <div className="pb-2 pt-0.5">
                    <p className="text-sm font-semibold text-white">{item.label}</p>
                    <p className="text-xs text-slate-500">{item.sub}</p>
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-4 border-t border-white/[0.06] pt-4">
              <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-600">Decision values</p>
              <div className="flex flex-wrap gap-1.5">
                {decisions.map(({ d, cls }) => (
                  <span key={d} className={`rounded border px-1.5 py-0.5 font-mono text-[10px] font-semibold ${cls}`}>{d}</span>
                ))}
              </div>
            </div>
            <pre className="mt-4 overflow-x-auto rounded border border-white/[0.06] bg-[#05070d] p-3 text-[10px] leading-5 text-slate-400">{`{
  "decision": "block",
  "risk": "high",
  "feedback": "Do not read .env.",
  "nextStep": "Re-plan without reading secret files.",
  "receiptId": "aw_receipt_..."
}`}</pre>
          </div>
        </div>
      </section>

      {/* Problem */}
      <section className="border-t border-white/[0.06] bg-[#080b12]">
        <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500">The problem</p>
          <h2 className="mt-3 max-w-2xl text-3xl font-semibold tracking-tight text-white">
            Agents act faster than teams can review
          </h2>
          <p className="mt-4 max-w-2xl text-base leading-7 text-slate-400">
            AI agents can read secrets, execute destructive commands, push to production, and exfiltrate data — all before a human sees the diff. Most teams have no runtime control layer.
          </p>
          <div className="mt-8 grid gap-4 sm:grid-cols-3">
            {[
              { title: "No audit trail", body: "Agents act. Nothing is recorded. When something breaks you have no receipt." },
              { title: "No policy enforcement", body: "Default tool access is all-or-nothing. Agents can read .env, run rm -rf, push to main." },
              { title: "No feedback loop", body: "When an agent is blocked, it has no context to re-plan. It just fails." },
            ].map(({ title, body }) => (
              <div key={title} className="rounded-md border border-white/[0.08] p-5">
                <p className="font-semibold text-white">{title}</p>
                <p className="mt-2 text-sm leading-6 text-slate-400">{body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
        <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-cyan-200">What AgentWing does</p>
        <h2 className="mt-3 text-3xl font-semibold tracking-tight text-white">Runtime controls for the full execution path</h2>
        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {features.map(({ title, body }) => (
            <div key={title} className="rounded-md border border-white/[0.08] bg-[#080b12] p-5">
              <p className="font-semibold text-white">{title}</p>
              <p className="mt-2 text-sm leading-6 text-slate-400">{body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* API snippet */}
      <section className="border-t border-white/[0.06] bg-[#080b12]">
        <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
          <div className="grid gap-10 lg:grid-cols-2 lg:items-center">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-400">One API call</p>
              <h2 className="mt-3 text-3xl font-semibold tracking-tight text-white">Add guarded execution in minutes</h2>
              <p className="mt-4 text-base leading-7 text-slate-400">
                Use <span className="font-mono text-cyan-100">/api/v1/check-action</span> for lightweight policy decisions, or <span className="font-mono text-cyan-100">/api/v1/execute-action</span> to create a managed action run.
                Sandbox execution runs in connected E2B BYOK; hosted AgentWing does not run arbitrary commands locally.
              </p>
              <div className="mt-6 flex gap-3">
                <Link href="/docs" className="rounded border border-white/[0.1] px-4 py-2 text-sm font-semibold text-slate-200 transition hover:text-white">
                  Full docs
                </Link>
                <Link href="/dashboard/integrations" className="rounded border border-white/[0.1] px-4 py-2 text-sm font-semibold text-slate-400 transition hover:text-white">
                  Integration guide
                </Link>
              </div>
            </div>
            <pre className="overflow-x-auto rounded-xl border border-white/[0.08] bg-[#05070d] p-5 text-xs leading-6 text-slate-300">{`POST /api/v1/check-action
Authorization: Bearer YOUR_AW_API_KEY

{
  "actionType": "file_access",
  "tool": "filesystem",
  "target": ".env"
}

→ {
  "decision": "block",
  "risk": "high",
  "feedback": "Do not read .env.",
  "nextStep": "Re-plan without reading secret files."
}`}</pre>
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="mx-auto max-w-6xl px-4 py-20 text-center sm:px-6">
        <h2 className="text-3xl font-semibold tracking-tight text-white">Start adding runtime control today</h2>
        <p className="mx-auto mt-4 max-w-xl text-base text-slate-400">
          Free during beta. Sign up with Google. No credit card, no password.
        </p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          {isSignedIn ? (
            <Link href="/dashboard" className="rounded-md bg-cyan-300 px-6 py-3 text-sm font-semibold text-[#031018] transition hover:bg-cyan-200">
              Open dashboard
            </Link>
          ) : (
            <>
              <a href="/api/auth/signin/google?next=/dashboard" className="rounded-md bg-cyan-300 px-6 py-3 text-sm font-semibold text-[#031018] transition hover:bg-cyan-200">
                Sign up free with Google
              </a>
              <Link href="/docs" className="rounded-md border border-white/[0.1] px-6 py-3 text-sm font-semibold text-slate-300 transition hover:text-white">
                Read the docs
              </Link>
            </>
          )}
        </div>
        {!isSignedIn && (
          <p className="mt-3 text-xs text-slate-600">Continue with Google. No password needed.</p>
        )}
      </section>

      <PublicFooter />
    </div>
  );
}
