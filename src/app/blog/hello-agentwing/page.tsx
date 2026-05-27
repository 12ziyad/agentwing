import Link from "next/link";
import { PublicNav, PublicFooter } from "@/components/PublicLayout";

export default function HelloAgentWingPost() {
  return (
    <div className="min-h-screen bg-[#05070d] text-slate-100">
      <PublicNav />
      <main className="mx-auto max-w-2xl px-4 py-16 sm:px-6">
        <Link href="/blog" className="text-xs text-slate-500 transition hover:text-slate-300">
          ← Blog
        </Link>
        <p className="mt-4 text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-500">
          launch · 2026 · 3 min read
        </p>
        <h1 className="mt-3 text-4xl font-semibold tracking-tight text-white">Hello AgentWing</h1>
        <p className="mt-4 text-base font-medium text-slate-300">
          AI agents can run commands, edit files, call tools, and touch production. Most teams still lack a runtime control layer. Today that changes.
        </p>

        <div className="mt-10 space-y-8 text-sm leading-7 text-slate-300">
          <Section title="Agents can act now">
            <p>
              The era of AI agents that can actually do things is here. Claude Code can edit files, run shell commands, and commit code. Codex can scaffold entire projects. Custom agents built on any LLM can call APIs, read databases, and modify production state.
            </p>
            <p>
              This is genuinely useful. It is also genuinely risky if there is nothing between the agent and the environment.
            </p>
          </Section>

          <Section title="The missing layer is runtime control">
            <p>
              Most agent infrastructure today handles what an agent can plan — not what it can execute at runtime. The gap between planning and execution is where accidents happen.
            </p>
            <p>
              You cannot solve this with a system prompt alone. System prompts can tell an agent not to read .env files. They cannot enforce that at execution time. An adversarial input, a confused model, or a forgotten edge case is all it takes to bypass a system prompt instruction.
            </p>
          </Section>

          <Section title="Problem one: unsafe actions">
            <p>
              Without a runtime control layer, agents can read secret files, run destructive shell commands, exfiltrate data over the network, push breaking changes to production branches, and drop database tables — by default, with full permission.
            </p>
          </Section>

          <Section title="Problem two: no audit trail">
            <p>
              When an agent causes an incident, most teams have no record of what it actually tried to do. Logs capture errors. They do not capture intentional actions that were allowed.
            </p>
            <p>
              An audit receipt for every agent action — decision, risk, policy, action metadata — is not optional for teams running agents in production.
            </p>
          </Section>

          <Section title="Problem three: agents need feedback to re-plan">
            <p>
              When an agent is blocked, it needs to know why, and what to do next. A raw 403 response or a vague error message is not enough. An agent that receives structured feedback — &quot;Do not read .env. Ask the user for the specific variable or use configured secrets.&quot; — can actually re-plan.
            </p>
          </Section>

          <Section title="What AgentWing does">
            <p>
              AgentWing is a runtime control layer that intercepts agent tool calls before execution. Before your agent reads a file, runs a command, or makes a network call, it sends the proposed action to AgentWing.
            </p>
            <p>
              AgentWing evaluates the action against custom policies and a default ruleset, then returns a decision: <span className="font-mono text-cyan-100">allow</span>, <span className="font-mono text-red-200">block</span>, <span className="font-mono text-amber-200">approval_required</span>, <span className="font-mono text-cyan-200">sandbox_required</span>, or <span className="font-mono text-violet-200">restore_point_required</span>.
            </p>
            <p>
              Every decision includes a risk level, the policy that matched, structured human-readable feedback, a next step for re-planning, and an audit receipt ID.
            </p>
          </Section>

          <Section title="Free and open during beta">
            <p>
              AgentWing is free to use during beta. Sign up with Google — no password, no credit card. You get a workspace, project management, API key generation, custom policies, BYOK E2B sandbox routing, receipts, usage counters, and approvals out of the box.
            </p>
            <p>
              Open source components — the SDK, policy pack, examples, and sandbox adapters — are publishing to GitHub.
            </p>
          </Section>

          <Section title="This is the start">
            <p>
              AgentWing V1 is the beginning. The runtime control problem for AI agents is not solved. We are building the infrastructure layer that makes production agent deployment safe by default.
            </p>
            <p>
              If you are building with agents — coding agents, research agents, workflow agents, custom operators — we want to hear from you. Try the API, add a policy, see what gets blocked.
            </p>
            <p>
              The control layer should be invisible when things are fine and essential when they are not. That is what we are building.
            </p>
          </Section>
        </div>

        <div className="mt-12 flex flex-wrap gap-3 border-t border-white/[0.08] pt-8">
          <a href="/api/auth/signin/google" className="rounded-md bg-cyan-300 px-5 py-2.5 text-sm font-semibold text-[#031018] transition hover:bg-cyan-200">
            Sign up free with Google
          </a>
          <Link href="/docs" className="rounded-md border border-white/[0.1] px-5 py-2.5 text-sm font-semibold text-slate-300 transition hover:text-white">
            Read the docs
          </Link>
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
      <div className="mt-3 space-y-3">{children}</div>
    </div>
  );
}
