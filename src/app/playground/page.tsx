import type { Metadata } from "next";
import Link from "next/link";
import { PublicFooter, PublicNav } from "@/components/PublicLayout";
import { PolicyPlayground } from "@/components/PolicyPlayground";

export const metadata: Metadata = {
  title: "Playground — AgentWing",
  description: "Run the AgentWing policy engine in your browser. Propose an agent action and see the decision the API would return.",
};

export default function PlaygroundPage() {
  return (
    <div className="min-h-screen bg-[#05070d] text-slate-100">
      <PublicNav />
      <main className="mx-auto max-w-6xl px-5 py-14 sm:px-8 sm:py-16">
        <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-cyan-300/70">Playground</p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight text-white sm:text-4xl">Propose an action. See the answer.</h1>
        <p className="mt-4 max-w-2xl text-sm leading-6 text-slate-400 sm:text-base sm:leading-7">
          This is the same decision engine behind <code className="font-mono text-slate-300">POST /api/v1/check-action</code>,
          compiled into this page. It applies the default policies only — your workspace&apos;s custom policies, approvals
          and receipts need an API key.
        </p>

        <div className="mt-10">
          <PolicyPlayground />
        </div>

        <div className="mt-10 grid gap-4 sm:grid-cols-3">
          {[
            ["Try to break it", "Chain commands, hide a deletion behind a safe prefix, rename .env. Every bypass we have found is now a test."],
            ["Unknown means ask", "An action no rule classifies is held for a human. The engine never allows what it does not understand."],
            ["Same answer every time", "Decisions are deterministic and always name the rule that made them, so you can see why."],
          ].map(([title, copy]) => (
            <div key={title} className="rounded-lg border border-white/[0.07] bg-[#080b12] p-5">
              <p className="text-sm font-semibold text-white">{title}</p>
              <p className="mt-2 text-[13px] leading-6 text-slate-400">{copy}</p>
            </div>
          ))}
        </div>

        <div className="mt-10 flex flex-wrap items-center gap-3">
          <a
            href="/api/auth/signin/google?next=/dashboard"
            className="rounded-md bg-cyan-400 px-5 py-2.5 text-sm font-semibold text-black transition hover:bg-cyan-300"
          >
            Get an API key — free in beta
          </a>
          <Link
            href="/docs"
            className="rounded-md border border-white/[0.12] px-5 py-2.5 text-sm font-semibold text-slate-300 transition hover:border-white/25 hover:text-white"
          >
            Read the docs
          </Link>
        </div>
      </main>
      <PublicFooter />
    </div>
  );
}
