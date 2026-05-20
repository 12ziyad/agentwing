"use client";

import { RUNTIME_LIMIT_MAILTO } from "@/lib/accessMail";

export function RuntimeLimitReached({ onBack }: { onBack: () => void }) {
  return (
    <main className="min-h-screen bg-[#05070d] px-4 py-6 text-slate-100 sm:px-6">
      <div className="mx-auto flex min-h-[calc(100vh-3rem)] max-w-4xl items-center justify-center">
        <section className="w-full rounded-2xl border border-white/[0.08] bg-[#080b12] p-6 shadow-2xl shadow-black/45 sm:p-8">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-amber-200">
            Runtime Lab
          </p>
          <h1 className="mt-3 text-4xl font-semibold tracking-tight text-white sm:text-5xl">
            Runtime Lab limit reached.
          </h1>
          <p className="mt-5 max-w-2xl text-base leading-7 text-slate-300">
            You&apos;ve used your 3 public AgentWing Runtime Lab runs.
          </p>
          <p className="mt-4 max-w-2xl text-base leading-7 text-slate-300">
            Early access is open for the first 20 serious builders and teams
            working on agents that touch real systems.
          </p>

          <div className="mt-6 rounded-xl border border-white/[0.08] bg-[#05070d] p-4 text-sm leading-6 text-slate-300">
            <p>For early access, bugs, reports, product enquiries, or demos:</p>
            <p className="mt-2 font-mono text-cyan-100">founder@gpmai.dev</p>
            <p className="font-mono text-cyan-100">ziyad@gpmai.dev</p>
          </div>

          <div className="mt-6 flex flex-wrap gap-3">
            <a
              href={RUNTIME_LIMIT_MAILTO}
              className="rounded-md border border-cyan-300/30 bg-cyan-300 px-5 py-3 text-sm font-semibold text-[#031018] transition hover:bg-cyan-200 active:scale-[0.99]"
            >
              Request early access
            </a>
            <button
              type="button"
              onClick={onBack}
              className="rounded-md border border-white/[0.12] bg-white/[0.04] px-5 py-3 text-sm font-semibold text-slate-100 transition hover:border-white/[0.2] hover:bg-white/[0.07]"
            >
              Back to landing
            </button>
          </div>
        </section>
      </div>
    </main>
  );
}
