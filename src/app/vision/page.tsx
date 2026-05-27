import { PublicNav, PublicFooter } from "@/components/PublicLayout";

export default function VisionPage() {
  return (
    <div className="min-h-screen bg-[#05070d] text-slate-100">
      <PublicNav />
      <main className="mx-auto max-w-2xl px-4 py-16 sm:px-6">
        <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-cyan-200">Vision</p>
        <h1 className="mt-3 text-4xl font-semibold tracking-tight text-white">
          Runtime control for the agent era
        </h1>
        <p className="mt-4 text-base font-medium text-slate-300">
          Agents were built to act. Production systems were built for humans to approve. AgentWing is the missing runtime control layer between autonomous agents and real execution.
        </p>

        <div className="prose-custom mt-10 space-y-8 text-slate-300">
          <Section title="How we got here">
            <p>
              Software development started with humans writing and reviewing every line. Then came CI/CD, which automated testing and deployment — but humans still authored every change. The diff was still readable.
            </p>
            <p>
              AI coding agents changed that. Now an agent can propose a 200-file refactor, edit production config, run shell commands, and push to a branch — all in under a minute. The diff is no longer human-sized.
            </p>
          </Section>

          <Section title="The operator became the agent">
            <p>
              The mental model of software development assumed a human operator in the loop: reading the diff, approving the PR, watching the deploy. That operator is now an AI agent running at machine speed.
            </p>
            <p>
              This is not a criticism of agents. It is a description of a capability gap. The tools we built for human operators were not designed for agent operators.
            </p>
          </Section>

          <Section title="The problem: agents act before teams can review">
            <p>
              Today, most teams using AI agents have no runtime control layer. An agent that has access to a filesystem can read secrets. An agent that has access to a terminal can run destructive commands. An agent that has access to git can push to main.
            </p>
            <p>
              These are not hypothetical risks. They are the default behavior of every agent that lacks a control layer.
            </p>
          </Section>

          <Section title="Our bet">
            <p>
              We believe runtime control for AI agents will become as fundamental as auth, logging, and rate limiting. Not because agents are dangerous in some abstract sense — but because production systems were not built for automated operators making thousands of decisions per hour.
            </p>
            <p>
              The teams that ship agents safely will be the ones that put a control layer between agent capability and production access.
            </p>
          </Section>

          <Section title="What we are building">
            <p>
              AgentWing is a runtime control layer that sits between an agent and its tools. Before an agent executes any action, it asks AgentWing: is this allowed?
            </p>
            <p>
              AgentWing evaluates the action against a policy engine — custom rules first, then defaults — and returns a decision: allow, block, approval_required, sandbox_required, or restore_point_required. Every decision creates an audit receipt.
            </p>
            <p>
              The agent receives structured feedback it can use to re-plan. The human operator gets a real-time view of what the agent tried to do, what was blocked, what was approved, and what ran in a sandbox.
            </p>
          </Section>

          <Section title="Why policy, sandbox routing, restore points, feedback, and receipts become infrastructure">
            <p>
              Each of these components solves a different failure mode:
            </p>
            <ul className="mt-2 space-y-2 text-sm">
              <li><span className="font-semibold text-white">Policy</span> — prevents unsafe actions from executing at all.</li>
              <li><span className="font-semibold text-white">Sandbox routing</span> — lets risky actions run in isolation before touching production.</li>
              <li><span className="font-semibold text-white">Restore points</span> — ensures recovery paths exist before irreversible mutations.</li>
              <li><span className="font-semibold text-white">Feedback</span> — gives the agent context to re-plan rather than fail silently.</li>
              <li><span className="font-semibold text-white">Receipts</span> — creates an audit trail that survives incidents and compliance reviews.</li>
            </ul>
            <p>
              Together they form the control plane that production agent infrastructure needs.
            </p>
          </Section>

          <Section title="Agents should not just act; they should be governed at runtime">
            <p>
              We are not building another safety layer that sits outside the agent loop and occasionally says no. We are building infrastructure that is integrated into the agent loop itself — fast enough to not matter for latency, rich enough to actually change behavior.
            </p>
            <p>
              The goal is agents that are both autonomous and governed. Not constrained by static rules, but audited, sandboxed, and correctable at runtime.
            </p>
            <p className="text-slate-400">
              — Ziyad, founder of GPMai Labs
            </p>
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
      <h2 className="text-lg font-semibold text-white">{title}</h2>
      <div className="mt-3 space-y-3 text-sm leading-7">{children}</div>
    </div>
  );
}
