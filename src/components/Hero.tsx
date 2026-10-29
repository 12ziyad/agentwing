import Link from "next/link";
import { PublicFooter, PublicNav } from "@/components/PublicLayout";
import { PolicyPlayground } from "@/components/PolicyPlayground";
import { DECISION_STYLE } from "@/components/decisionStyle";
import { evaluateAgentAction } from "@/lib/agentwingPolicy";
import type { AgentWingDecision } from "@/lib/agentwingTypes";
import { PLAYGROUND_PRESETS } from "@/lib/playgroundPresets";

/**
 * The landing page.
 *
 * Every decision shown here is real output from `evaluateAgentAction` for the
 * action beside it, not illustrative JSON. If the engine's behaviour changes,
 * this page becomes wrong — which is the correct incentive.
 */

type Decision = AgentWingDecision;

// Computed, not typed in: each row is the engine's answer to its preset.
const LEDGER = PLAYGROUND_PRESETS.filter((p) => p.id !== "refund" && p.id !== "force-push").map((preset) => {
  const evaluation = evaluateAgentAction(preset.action);
  return { action: preset.label, kind: preset.action.actionType, decision: evaluation.decision, policy: evaluation.policy };
});

const DECISIONS: ReadonlyArray<{ name: Decision; summary: string; detail: string }> = [
  {
    name: "allow",
    summary: "Proceed",
    detail: "Genuinely read-only work is not obstructed. Every segment of a command must be safe, so a safe prefix cannot launder what follows it.",
  },
  {
    name: "block",
    summary: "Never runs",
    detail: "Secret reads and irreversibly destructive commands. No custom policy can downgrade these — the floor is not configurable.",
  },
  {
    name: "approval_required",
    summary: "A human decides",
    detail: "Deploys, payments, external messages, and anything the engine cannot classify. The agent proposing the action cannot approve it.",
  },
  {
    name: "sandbox_required",
    summary: "Runs elsewhere",
    detail: "Untrusted code executes in your own E2B sandbox, never on the host. Output is captured and redacted before it is stored.",
  },
  {
    name: "restore_point_required",
    summary: "Reversible first",
    detail: "Sensitive file and configuration changes wait for a checkpoint, so the action can be undone rather than merely regretted.",
  },
];

export function Hero({ isSignedIn }: { isSignedIn?: boolean }) {
  return (
    <div className="min-h-screen bg-[#05070d] text-slate-100">
      <PublicNav isSignedIn={isSignedIn} />

      {/* ── Hero ─────────────────────────────────────────────── */}
      <section className="relative overflow-hidden border-b border-white/[0.06]">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 -top-40 h-[32rem] opacity-[0.18]"
          style={{ background: "radial-gradient(60% 60% at 50% 0%, #22d3ee 0%, transparent 70%)" }}
        />
        <div className="relative mx-auto max-w-6xl px-5 pb-16 pt-16 sm:px-8 sm:pb-24 sm:pt-24">
          <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-cyan-300/70">
            Runtime control plane for AI agents
          </p>

          <h1 className="mt-5 max-w-4xl text-[clamp(2.2rem,5.4vw,4.25rem)] font-bold leading-[1.05] tracking-tight text-balance">
            Your agent asks first.
            <br />
            <span className="text-cyan-400">You decide what runs.</span>
          </h1>

          <p className="mt-6 max-w-2xl text-base leading-7 text-slate-400 sm:text-lg">
            AgentWing sits between an AI agent and the actions it wants to take. Before it reads a file, runs a command,
            installs a package or ships to production, it asks — and gets back one of five answers, plus a receipt.
          </p>

          <div className="mt-9 flex flex-wrap gap-3">
            {isSignedIn ? (
              <Link
                href="/dashboard"
                className="rounded-md bg-cyan-400 px-5 py-2.5 text-sm font-semibold text-black transition hover:bg-cyan-300"
              >
                Open dashboard
              </Link>
            ) : (
              <a
                href="/api/auth/signin/google"
                className="rounded-md bg-cyan-400 px-5 py-2.5 text-sm font-semibold text-black transition hover:bg-cyan-300"
              >
                Start free
              </a>
            )}
            <a
              href="#try"
              className="rounded-md border border-white/[0.12] px-5 py-2.5 text-sm font-semibold text-slate-300 transition hover:border-white/25 hover:text-white"
            >
              Try it live
            </a>
          </div>
          <p className="mt-4 text-xs text-slate-500">
            Free during beta · no card ·{" "}
            <Link href="/pricing" className="underline decoration-slate-700 underline-offset-4 hover:text-slate-300">
              see pricing
            </Link>
          </p>

          {/* Live decision ledger */}
          <div className="mt-14 overflow-hidden rounded-xl border border-white/[0.08] bg-[#080b12] shadow-2xl shadow-black/50">
            <div className="flex items-center gap-2 border-b border-white/[0.06] px-4 py-3">
              <span className="size-2.5 rounded-full bg-[#ff5f57]" />
              <span className="size-2.5 rounded-full bg-[#febc2e]" />
              <span className="size-2.5 rounded-full bg-[#28c840]" />
              <span className="ml-2 font-mono text-[11px] text-slate-500">POST /api/v1/check-action</span>
              <span className="ml-auto hidden font-mono text-[11px] text-slate-600 sm:block">real engine output</span>
            </div>

            <div className="divide-y divide-white/[0.05]">
              {LEDGER.map(({ action, kind, decision, policy }) => {
                const style = DECISION_STYLE[decision];
                return (
                  <div
                    key={action}
                    className="grid grid-cols-1 gap-2 px-4 py-3.5 sm:grid-cols-[1fr_auto] sm:items-center sm:gap-6"
                  >
                    <div className="min-w-0">
                      <p className="truncate font-mono text-[13px] text-slate-200">{action}</p>
                      <p className="mt-1 font-mono text-[11px] text-slate-600">
                        {kind} · {policy}
                      </p>
                    </div>
                    <span
                      className={`inline-flex w-fit items-center gap-2 rounded-full px-3 py-1 font-mono text-[11px] ring-1 ${style.ring} ${style.text}`}
                    >
                      <span className={`size-1.5 rounded-full ${style.dot}`} />
                      {decision}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </section>

      {/* ── Playground ───────────────────────────────────────── */}
      <section id="try" className="scroll-mt-20 border-b border-white/[0.06]">
        <div className="mx-auto max-w-6xl px-5 py-16 sm:px-8 sm:py-20">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-cyan-300/70">Try it — no sign-in</p>
              <h2 className="mt-3 text-2xl font-semibold tracking-tight text-white sm:text-3xl">Talk the engine into something</h2>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-400">
                This is the production policy engine, running in your browser. Pick an action or type your own and watch
                the answer change as you type. Try to sneak a dangerous command past it.
              </p>
            </div>
            <Link href="/playground" className="text-sm font-semibold text-cyan-300 transition hover:text-cyan-200">
              Open full playground →
            </Link>
          </div>
          <div className="mt-8">
            <PolicyPlayground compact />
          </div>
        </div>
      </section>

      {/* ── Works with ───────────────────────────────────────── */}
      <section className="border-b border-white/[0.06]">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-8 gap-y-3 px-5 py-8 sm:px-8">
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">Works with</p>
          {[
            ["Claude Code", "PreToolUse hook"],
            ["Cursor", "hook"],
            ["Codex", "hook"],
            ["Any MCP client", "remote MCP server"],
            ["Your own agent", "REST API · TypeScript SDK"],
          ].map(([name, via]) => (
            <p key={name} className="text-sm text-slate-300">
              {name} <span className="font-mono text-[11px] text-slate-600">· {via}</span>
            </p>
          ))}
        </div>
      </section>

      {/* ── The five decisions ───────────────────────────────── */}
      <section className="border-b border-white/[0.06]">
        <div className="mx-auto max-w-6xl px-5 py-16 sm:px-8 sm:py-20">
          <h2 className="text-2xl font-semibold tracking-tight text-white sm:text-3xl">Five answers, no ambiguity</h2>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-400">
            Every action gets exactly one. The decision is deterministic — the same action always produces the same
            answer, and the answer always names the rule that produced it.
          </p>

          <div className="mt-10 grid gap-px overflow-hidden rounded-xl border border-white/[0.08] bg-white/[0.06] sm:grid-cols-2 lg:grid-cols-3">
            {DECISIONS.map(({ name, summary, detail }) => {
              const style = DECISION_STYLE[name];
              return (
                <div key={name} className="bg-[#080b12] p-5">
                  <div className="flex items-center gap-2">
                    <span className={`size-1.5 rounded-full ${style.dot}`} />
                    <span className={`font-mono text-[12px] ${style.text}`}>{name}</span>
                  </div>
                  <p className="mt-3 text-sm font-semibold text-white">{summary}</p>
                  <p className="mt-2 text-[13px] leading-6 text-slate-400">{detail}</p>
                </div>
              );
            })}
            <div className="bg-[#080b12] p-5">
              <p className="font-mono text-[12px] text-slate-500">every decision</p>
              <p className="mt-3 text-sm font-semibold text-white">Leaves a receipt</p>
              <p className="mt-2 text-[13px] leading-6 text-slate-400">
                The action, the verdict, the rule that decided it, and what happened next — recorded per workspace and
                readable from the dashboard.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ── How it works ─────────────────────────────────────── */}
      <section className="border-b border-white/[0.06]">
        <div className="mx-auto max-w-6xl px-5 py-16 sm:px-8 sm:py-20">
          <div className="grid gap-12 lg:grid-cols-[0.9fr_1.1fr] lg:gap-16">
            <div>
              <h2 className="text-2xl font-semibold tracking-tight text-white sm:text-3xl">One call to integrate</h2>
              <p className="mt-3 text-sm leading-6 text-slate-400">
                Send the action your agent is about to take. Obey the answer. That is the whole contract — there is no
                framework to adopt and nothing to run alongside your agent.
              </p>

              <ol className="mt-8 space-y-4">
                {[
                  ["Propose", "Your agent describes the action before performing it."],
                  ["Decide", "The engine evaluates it against your policies, then the defaults."],
                  ["Enforce", "Block, hold for approval, route to a sandbox, or proceed."],
                  ["Record", "The decision and its outcome are written to the workspace's log."],
                ].map(([label, copy], index) => (
                  <li key={label} className="flex gap-4">
                    <span className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded border border-cyan-300/25 bg-cyan-300/[0.08] font-mono text-[11px] text-cyan-200">
                      {index + 1}
                    </span>
                    <div>
                      <p className="text-sm font-semibold text-white">{label}</p>
                      <p className="mt-0.5 text-[13px] leading-6 text-slate-400">{copy}</p>
                    </div>
                  </li>
                ))}
              </ol>
            </div>

            <div className="overflow-hidden rounded-xl border border-white/[0.08] bg-[#080b12]">
              <div className="border-b border-white/[0.06] px-4 py-2.5">
                <span className="font-mono text-[11px] text-slate-500">guard.ts</span>
              </div>
              <pre className="overflow-x-auto px-5 py-5 font-mono text-[12.5px] leading-6 text-slate-300">
                <code>{`const res = await fetch(
  "https://agentwing.gpmai.dev/api/v1/check-action",
  {
    method: "POST",
    headers: {
      authorization: \`Bearer \${process.env.AGENTWING_API_KEY}\`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      actionType: "shell_command",
      tool: "terminal",
      command: "rm -rf ./build",
      description: "Clean the build directory.",
    }),
  },
);

const { decision, policy, feedback } = await res.json();

if (decision !== "allow") {
  // Do not run it. Tell the model why.
  throw new Error(feedback);
}`}</code>
              </pre>
            </div>
          </div>
        </div>
      </section>

      {/* ── Posture ──────────────────────────────────────────── */}
      <section className="border-b border-white/[0.06]">
        <div className="mx-auto max-w-6xl px-5 py-16 sm:px-8 sm:py-20">
          <h2 className="text-2xl font-semibold tracking-tight text-white sm:text-3xl">
            Built to be wrong safely
          </h2>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-400">
            A control plane is only worth having if its failure modes are conservative. These are the properties the
            test suite holds it to.
          </p>

          <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {[
              ["Default deny", "An action no rule classifies is held for a human, not allowed. The engine gives its weakest answer to its weakest input."],
              ["Fails closed", "If policies cannot be read, the request is refused rather than decided from defaults — a workspace's block rules may be exactly what is missing."],
              ["Scoped by construction", "Every query carries its workspace. There is no code path that can omit it, so cross-tenant reads are not a bug to avoid but a state that cannot be written."],
              ["No self-approval", "The response to a gated action carries no credential. The agent being policed cannot approve itself."],
              ["Bounded matching", "Customer-authored patterns are validated when written, anchored, and matched without backtracking, so a policy cannot hang the service."],
              ["Secrets stay out", "Command output is redacted before storage. Sandbox credentials are encrypted at rest and never returned to a client."],
            ].map(([title, copy]) => (
              <div key={title} className="rounded-lg border border-white/[0.07] bg-[#080b12] p-5">
                <p className="text-sm font-semibold text-white">{title}</p>
                <p className="mt-2 text-[13px] leading-6 text-slate-400">{copy}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA ──────────────────────────────────────────────── */}
      <section>
        <div className="mx-auto max-w-6xl px-5 py-16 sm:px-8 sm:py-24">
          <div className="rounded-2xl border border-white/[0.08] bg-gradient-to-b from-[#0b1018] to-[#080b12] px-6 py-12 text-center sm:px-12">
            <h2 className="text-2xl font-semibold tracking-tight text-white sm:text-3xl text-balance">
              Give your agent a gate it has to ask through
            </h2>
            <p className="mx-auto mt-3 max-w-xl text-sm leading-6 text-slate-400">
              Create a project, generate a key, and put one call in front of your agent&apos;s tools. Free during the
              beta, open source under Apache&nbsp;2.0.
            </p>
            <div className="mt-8 flex flex-wrap justify-center gap-3">
              {isSignedIn ? (
                <Link
                  href="/dashboard"
                  className="rounded-md bg-cyan-400 px-5 py-2.5 text-sm font-semibold text-black transition hover:bg-cyan-300"
                >
                  Open dashboard
                </Link>
              ) : (
                <a
                  href="/api/auth/signin/google"
                  className="rounded-md bg-cyan-400 px-5 py-2.5 text-sm font-semibold text-black transition hover:bg-cyan-300"
                >
                  Start free
                </a>
              )}
              <Link
                href="/docs"
                className="rounded-md border border-white/[0.12] px-5 py-2.5 text-sm font-semibold text-slate-300 transition hover:border-white/25 hover:text-white"
              >
                Read the docs
              </Link>
            </div>
          </div>
        </div>
      </section>

      <PublicFooter />
    </div>
  );
}
