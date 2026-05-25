"use client";

import { Mascot } from "./Mascot";

type HeroProps = {
  onStart: () => void;
};

const NAV_ITEMS = [
  ["How it works", "#how-it-works"],
  ["Sandbox Shelf", "#sandbox-shelf"],
  ["Contact", "#contact"],
];

const WHAT_CARDS = [
  ["Intercept tool calls", "Inspect file, shell, API, sandbox, and deploy actions before execution."],
  ["Apply policy", "Decide what is allowed, blocked, redirected, sandboxed, or approval-gated."],
  ["Create Restore Points", "Capture reversible file state before controlled writes."],
  ["Route to sandbox", "Send risky commands to E2B, Daytona, Modal, Vercel, or custom providers."],
  ["Return feedback", "Give the agent structured guidance so it can re-plan safely."],
  ["Seal audit receipt", "Record the decision, risk, policy, feedback, and rollback context."],
];

const PAIN_CARDS = [
  ["Secret access", "Blocked"],
  ["Shell commands", "Sandboxed"],
  ["Git operations", "Approval-gated"],
  ["Deploys", "Approval-gated"],
  ["API calls", "Audited"],
  ["Database changes", "Feedback returned"],
];

const FLOW = [
  "Agent proposes action",
  "AgentWing checks policy",
  "Restore Point captured",
  "Sandbox replay or approval gate",
  "Feedback returned to agent",
  "Audit receipt sealed",
];

const PROVIDERS = [
  "E2B",
  "Daytona",
  "Modal",
  "Vercel Sandbox",
  "Browserbase",
  "Cloudflare",
  "Custom Provider / BYO Sandbox",
];

const COMPARISON = [
  ["Isolated execution", "yes", "uses provider"],
  ["Per-action policy", "partial / no", "yes"],
  ["Restore Points + rollback", "partial / no", "yes"],
  ["Structured feedback to agent", "no", "yes"],
  ["Approval gates", "no / partial", "yes"],
  ["Audit receipt", "partial", "yes"],
];

export function Hero({ onStart }: HeroProps) {
  return (
    <main className="min-h-screen bg-[#05070d] text-slate-100">
      <LandingNav />
      <HeroSection onStart={onStart} />
      <WhatAgentWingIs />
      <WhyTeamsNeedIt />
      <HowItWorks />
      <SandboxShelf />
      <RuntimeLabPreview onStart={onStart} />
      <Differentiation />
      <ContactSection />
    </main>
  );
}

function LandingNav() {
  return (
    <header className="sticky top-0 z-30 border-b border-white/[0.08] bg-[#05070d]/92 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-7xl items-center gap-4 px-4 sm:px-6">
        <a href="#top" className="flex min-w-0 items-baseline gap-3">
          <span className="text-base font-semibold tracking-tight text-white">AgentWing</span>
          <span className="hidden text-[11px] font-medium text-slate-300 sm:inline">
            2-phase commit for AI agents
          </span>
        </a>
        <nav className="ml-auto hidden items-center gap-5 md:flex">
          {NAV_ITEMS.map(([label, href]) => (
            <a key={label} href={href} className="text-sm font-medium text-slate-300 transition hover:text-white">
              {label}
            </a>
          ))}
        </nav>
        <a
          href="/dashboard"
          className="rounded-md border border-cyan-300/30 bg-cyan-300 px-3.5 py-2 text-sm font-semibold text-[#031018] transition hover:bg-cyan-200 active:scale-[0.99]"
        >
          Open dashboard
        </a>
      </div>
    </header>
  );
}

function HeroSection({ onStart }: { onStart: () => void }) {
  return (
    <section id="top" className="border-b border-white/[0.08]">
      <div className="mx-auto grid min-h-[720px] max-w-7xl items-center gap-10 px-4 py-16 sm:px-6 lg:grid-cols-[1fr_0.92fr] lg:py-20">
        <div>
          <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-white/[0.1] bg-white/[0.035] px-3 py-1 text-xs text-slate-300">
            <span className="size-1.5 rounded-full bg-cyan-300" />
            Control for agents that touch real systems
          </div>
          <h1 className="max-w-4xl text-5xl font-semibold tracking-tight text-white sm:text-6xl lg:text-7xl">
            The execution control layer for AI agents.
          </h1>
          <p className="mt-6 max-w-2xl text-lg leading-8 text-slate-300">
            AgentWing intercepts agent tool calls before they touch files,
            shells, APIs, sandboxes, or production systems — adding policy
            checks, Restore Points, sandbox replay, human approval, feedback,
            and audit receipts.
          </p>
          <p className="mt-4 max-w-2xl text-sm font-medium leading-6 text-cyan-100">
            Agents can plan. Sandboxes can execute. AgentWing controls what is
            allowed to happen between them.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <a
              href="/api/auth/signin/google"
              className="rounded-md border border-cyan-300/30 bg-cyan-300 px-5 py-3 text-sm font-semibold text-[#031018] transition hover:bg-cyan-200 active:scale-[0.99]"
            >
              Start free
            </a>
            <a
              href="/api/auth/signin/google"
              className="rounded-md border border-white/[0.12] bg-white/[0.04] px-5 py-3 text-sm font-semibold text-slate-100 transition hover:border-white/[0.2] hover:bg-white/[0.07]"
            >
              Sign in with Google
            </a>
            <button
              type="button"
              onClick={onStart}
              className="rounded-md border border-white/[0.12] bg-white/[0.04] px-5 py-3 text-sm font-semibold text-slate-100 transition hover:border-white/[0.2] hover:bg-white/[0.07]"
            >
              Try Runtime Lab
            </button>
            <a
              href="/docs"
              className="rounded-md border border-white/[0.12] bg-white/[0.04] px-5 py-3 text-sm font-semibold text-slate-100 transition hover:border-white/[0.2] hover:bg-white/[0.07]"
            >
              View docs
            </a>
          </div>
        </div>

        <EnterpriseVisual />
      </div>
    </section>
  );
}

function EnterpriseVisual() {
  return (
    <div className="relative">
      <div className="absolute -inset-3 rounded-2xl border border-cyan-300/10" />
      <div className="relative overflow-hidden rounded-2xl border border-white/[0.1] bg-[#080b12] p-6 shadow-2xl shadow-black/50">
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute left-1/2 top-1/2 size-72 -translate-x-1/2 -translate-y-1/2 rounded-full border border-cyan-300/15" />
          <div className="absolute left-1/2 top-1/2 size-96 -translate-x-1/2 -translate-y-1/2 rounded-full border border-white/[0.06]" />
          <div className="absolute left-1/2 top-1/2 size-[30rem] -translate-x-1/2 -translate-y-1/2 rounded-full border border-cyan-300/[0.06]" />
          <div className="absolute left-8 top-16 h-px w-32 bg-cyan-300/20" />
          <div className="absolute right-10 top-28 h-px w-36 bg-red-400/12" />
          <div className="absolute bottom-16 left-16 h-px w-44 bg-amber-300/14" />
          <div className="absolute bottom-24 right-12 h-px w-32 bg-emerald-300/14" />
        </div>
        <div className="relative flex min-h-[420px] items-center justify-center">
          <div className="relative rounded-full border border-cyan-300/15 bg-cyan-300/[0.04] p-8 shadow-[0_0_80px_rgba(103,232,249,0.10)]">
            <span className="absolute left-1/2 top-0 size-2 -translate-x-1/2 rounded-full bg-cyan-300 shadow-[0_0_18px_rgba(103,232,249,0.7)]" />
            <span className="absolute right-5 top-16 size-2 rounded-full bg-red-400 shadow-[0_0_18px_rgba(248,113,113,0.55)]" />
            <span className="absolute bottom-7 left-12 size-2 rounded-full bg-amber-300 shadow-[0_0_18px_rgba(252,211,77,0.55)]" />
            <span className="absolute bottom-16 right-8 size-2 rounded-full bg-emerald-400 shadow-[0_0_18px_rgba(52,211,153,0.55)]" />
            <div className="rounded-full border border-white/[0.08] bg-[#05070d] p-6">
              <Mascot state="checking" size={124} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function WhatAgentWingIs() {
  return (
    <section className="border-b border-white/[0.08] px-4 py-20 sm:px-6">
      <div className="mx-auto max-w-7xl">
        <SectionHeading
          eyebrow="What AgentWing is"
          title="One control layer for every agent action."
          copy="AgentWing works across agents, sandboxes, and execution environments. Use it above your existing sandbox, or route actions through AgentWing's sandbox shelf. Every action can be checked, routed, restored, approval-gated, fed back to the agent, and audited."
        />
        <div className="mt-10 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {WHAT_CARDS.map(([title, copy]) => (
            <InfoCard key={title} title={title} copy={copy} />
          ))}
        </div>
      </div>
    </section>
  );
}

function WhyTeamsNeedIt() {
  return (
    <section className="border-b border-white/[0.08] px-4 py-20 sm:px-6">
      <div className="mx-auto max-w-7xl">
        <SectionHeading
          eyebrow="Why teams need it"
          title="Agents are moving from chat to execution."
          copy="Coding agents and ops agents now edit files, run shell commands, call APIs, push branches, and trigger deploys. AgentWing gives teams control before those actions become real."
        />
        <div className="mt-10 grid gap-3 md:grid-cols-2 lg:grid-cols-3">
          {PAIN_CARDS.map(([action, response]) => (
            <div key={action} className="rounded-xl border border-white/[0.08] bg-[#080b12] p-4">
              <div className="flex items-center justify-between gap-3">
                <p className="text-sm font-semibold text-white">{action}</p>
                <span className="rounded border border-cyan-300/20 bg-cyan-300/[0.06] px-2 py-1 text-[10px] font-semibold text-cyan-100">
                  {response}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function HowItWorks() {
  return (
    <section id="how-it-works" className="border-b border-white/[0.08] px-4 py-20 sm:px-6">
      <div className="mx-auto max-w-7xl">
        <SectionHeading
          eyebrow="How it works"
          title="Every agent action becomes a controlled transaction."
          copy="Before execution, AgentWing evaluates the proposed tool call, captures rollback context when needed, routes risky actions through sandbox replay, and returns feedback the agent can use."
        />
        <div className="mt-10 grid gap-3 lg:grid-cols-7">
          {FLOW.map((step, index) => (
            <div key={step} className="relative rounded-xl border border-white/[0.08] bg-[#080b12] p-4">
              {index < FLOW.length - 1 && (
                <div className="absolute -right-3 top-1/2 hidden h-px w-3 bg-cyan-300/30 lg:block" />
              )}
              <p className="font-mono text-xs text-cyan-100">0{index + 1}</p>
              <p className="mt-3 text-sm font-semibold leading-6 text-white">{step}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function SandboxShelf() {
  return (
    <section id="sandbox-shelf" className="border-b border-white/[0.08] px-4 py-20 sm:px-6">
      <div className="mx-auto max-w-7xl">
        <SectionHeading
          eyebrow="Sandbox Shelf"
          title="Bring your own sandbox, or choose from AgentWing's sandbox shelf."
          copy="AgentWing can route actions through E2B, Daytona, Modal, Vercel Sandbox, Browserbase, Cloudflare, or custom enterprise providers. Switch providers anytime and customize policies per sandbox."
        />
        <div className="mt-10 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {PROVIDERS.map((provider) => (
            <div key={provider} className="rounded-xl border border-white/[0.08] bg-[#080b12] p-4">
              <p className="text-sm font-semibold text-white">{provider}</p>
            </div>
          ))}
        </div>
        <div className="mt-6 grid gap-3 md:grid-cols-3">
          {[
            "Switch providers anytime.",
            "Customize policies per sandbox or provider.",
            "Route risky actions to the right execution environment.",
            "Bring your own enterprise sandbox.",
          ].map((copy) => (
            <p key={copy} className="rounded-xl border border-cyan-300/15 bg-cyan-300/[0.045] px-4 py-3 text-sm text-cyan-50">
              {copy}
            </p>
          ))}
        </div>
      </div>
    </section>
  );
}

function RuntimeLabPreview({ onStart }: { onStart: () => void }) {
  return (
    <section className="border-b border-white/[0.08] px-4 py-20 sm:px-6">
      <div className="mx-auto grid max-w-7xl gap-8 lg:grid-cols-[1fr_0.8fr] lg:items-center">
        <div>
          <SectionHeading
            eyebrow="Runtime Lab"
            title="Try AgentWing in the Runtime Lab."
            copy="Run a Mini Code Agent against the Box Arena app. First, see the agent act without controls. Then rerun the same task with AgentWing intercepting actions, routing tests through E2B, creating Restore Points, and generating an audit receipt."
          />
          <button
            type="button"
            onClick={onStart}
            className="mt-8 rounded-md border border-cyan-300/30 bg-cyan-300 px-5 py-3 text-sm font-semibold text-[#031018] transition hover:bg-cyan-200 active:scale-[0.99]"
          >
            Launch Runtime Lab
          </button>
        </div>
        <BoxArenaPreview />
      </div>
    </section>
  );
}

function BoxArenaPreview() {
  return (
    <div className="rounded-xl border border-white/[0.08] bg-[#080b12] p-4">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-300">
            Box Arena
          </p>
          <p className="mt-1 text-xs leading-5 text-slate-300">
            This is the app the Mini Code Agent will edit.
          </p>
        </div>
        <span className="rounded border border-red-400/25 bg-red-400/10 px-2 py-1 text-[10px] font-semibold text-red-300">
          uncontrolled
        </span>
      </div>
      <div className="rounded border border-white/[0.08] bg-[#05070d] p-3">
        <div className="grid grid-cols-8 gap-1">
          {Array.from({ length: 40 }).map((_, index) => (
            <div
              key={index}
              className={`aspect-square rounded-sm border border-white/[0.04] ${
                index === 10 ? "bg-cyan-300/75" : "bg-white/[0.035]"
              }`}
            />
          ))}
        </div>
        <div className="mt-3 grid grid-cols-3 gap-2 text-[10.5px]">
          <span className="rounded border border-white/[0.08] bg-white/[0.03] px-2 py-1 text-slate-200">1 box</span>
          <span className="rounded border border-white/[0.08] bg-white/[0.03] px-2 py-1 text-slate-200">basic score</span>
          <span className="rounded border border-red-400/20 bg-red-400/[0.06] px-2 py-1 text-red-200">uncontrolled</span>
        </div>
      </div>
    </div>
  );
}

function Differentiation() {
  return (
    <section className="border-b border-white/[0.08] px-4 py-20 sm:px-6">
      <div className="mx-auto max-w-7xl">
        <SectionHeading
          eyebrow="Differentiation"
          title="Sandbox providers isolate. AgentWing controls."
          copy="AgentWing gives teams the policy, rollback, feedback, approval, and audit path around each agent action, while still using the execution provider that fits the job."
        />
        <div className="mt-10 overflow-hidden rounded-xl border border-white/[0.08] bg-[#080b12]">
          <div className="grid grid-cols-[1.1fr_0.8fr_0.8fr] border-b border-white/[0.08] bg-[#0c1019] text-sm font-semibold text-white">
            <div className="px-4 py-3">Capability</div>
            <div className="px-4 py-3">Sandbox providers</div>
            <div className="px-4 py-3">AgentWing</div>
          </div>
          {COMPARISON.map(([capability, sandbox, agentwing]) => (
            <div key={capability} className="grid grid-cols-[1.1fr_0.8fr_0.8fr] border-b border-white/[0.06] text-sm last:border-b-0">
              <div className="px-4 py-3 font-medium text-slate-100">{capability}</div>
              <div className="px-4 py-3 text-slate-300">{sandbox}</div>
              <div className="px-4 py-3 text-cyan-100">{agentwing}</div>
            </div>
          ))}
        </div>
        <p className="mt-5 text-sm font-medium text-slate-200">
          Your sandbox handles isolation. AgentWing controls what enters it.
        </p>
      </div>
    </section>
  );
}

function ContactSection() {
  return (
    <section id="contact" className="px-4 py-20 sm:px-6">
      <div className="mx-auto grid max-w-7xl gap-8 rounded-2xl border border-white/[0.08] bg-[#080b12] p-6 sm:p-8 lg:grid-cols-[1fr_0.7fr]">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-cyan-200">
            Self-serve beta
          </p>
          <h2 className="mt-3 text-3xl font-semibold tracking-tight text-white sm:text-4xl">
            Building agents that touch real systems?
          </h2>
          <p className="mt-4 max-w-2xl text-base leading-7 text-slate-300">
            Start free with Google, create a project, generate an AgentWing API key,
            and connect your own E2B sandbox when you are ready to run real actions.
          </p>
          <div className="mt-5 w-fit rounded border border-cyan-300/20 bg-cyan-300/[0.06] px-3 py-2 text-sm font-semibold text-cyan-100">
            Your dashboard, projects, API keys, usage, receipts, and sandbox config are user-scoped.
          </div>
          <div className="mt-5 text-sm leading-6 text-slate-300">
            <p>For bugs, reports, product enquiries, or demos:</p>
            <p className="mt-1 font-mono text-cyan-100">founder@gpmai.dev</p>
            <p className="font-mono text-cyan-100">ziyad@gpmai.dev</p>
          </div>
        </div>
        <div className="flex flex-col justify-center gap-3 rounded-xl border border-white/[0.08] bg-[#05070d] p-4">
          <a
            href="/api/auth/signin/google"
            className="w-full rounded-md border border-cyan-300/30 bg-cyan-300 px-4 py-3 text-center text-sm font-semibold text-[#031018] transition hover:bg-cyan-200 active:scale-[0.99]"
          >
            Start free
          </a>
          <a
            href="/dashboard"
            className="w-full rounded-md border border-white/[0.1] bg-white/[0.04] px-4 py-3 text-center text-sm font-semibold text-slate-100 transition hover:bg-white/[0.07]"
          >
            Open dashboard
          </a>
          <a
            href="/runtime-lab"
            className="w-full rounded-md border border-white/[0.1] bg-white/[0.04] px-4 py-3 text-center text-sm font-semibold text-slate-100 transition hover:bg-white/[0.07]"
          >
            Try Runtime Lab
          </a>
        </div>
      </div>
    </section>
  );
}

function SectionHeading({ eyebrow, title, copy }: { eyebrow: string; title: string; copy: string }) {
  return (
    <div className="max-w-3xl">
      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-cyan-200">
        {eyebrow}
      </p>
      <h2 className="mt-3 text-3xl font-semibold tracking-tight text-white sm:text-4xl">
        {title}
      </h2>
      <p className="mt-4 text-base leading-7 text-slate-300">{copy}</p>
    </div>
  );
}

function InfoCard({ title, copy }: { title: string; copy: string }) {
  return (
    <article className="rounded-xl border border-white/[0.08] bg-[#080b12] p-5">
      <p className="text-lg font-semibold text-white">{title}</p>
      <p className="mt-3 text-sm leading-6 text-slate-300">{copy}</p>
    </article>
  );
}
