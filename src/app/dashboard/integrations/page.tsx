import Link from "next/link";

export const dynamic = "force-dynamic";

const curlExample = `curl -X POST https://agentwing.gpmai.dev/api/v1/check-action \\
  -H "Authorization: Bearer YOUR_AW_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
    "projectId": "YOUR_PROJECT_ID",
    "sessionId": "sess_123",
    "agentId": "my-agent",
    "actionType": "file_access",
    "tool": "filesystem",
    "target": ".env",
    "description": "Read .env file"
  }'`;

const fetchExample = `const awKey = process.env.AGENTWING_API_KEY; // load once at startup

const res = await fetch("https://agentwing.gpmai.dev/api/v1/check-action", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "Authorization": \`Bearer \${awKey}\`,
  },
  body: JSON.stringify({
    projectId: process.env.AGENTWING_PROJECT_ID,
    sessionId: "sess_123",
    agentId: "my-agent",
    actionType: "file_access",
    tool: "filesystem",
    target: ".env",
    description: "Read .env file",
  }),
});

const { decision, risk, policy, feedback, receiptId, nextStep } = await res.json();`;

const pythonExample = `import os
import requests

AW_KEY = os.environ["AGENTWING_API_KEY"]  # load once at startup

def check_action(action_type, tool=None, target=None, description=None, **kwargs):
    res = requests.post(
        "https://agentwing.gpmai.dev/api/v1/check-action",
        headers={
            "Authorization": f"Bearer {AW_KEY}",
            "Content-Type": "application/json",
        },
        json={
            "projectId": os.environ.get("AGENTWING_PROJECT_ID"),
            "sessionId": kwargs.get("session_id", "default"),
            "agentId": kwargs.get("agent_id", "my-agent"),
            "actionType": action_type,
            "tool": tool,
            "target": target,
            "description": description,
        },
    )
    return res.json()

result = check_action("file_access", tool="filesystem", target=".env")
print(result["decision"])  # "block"`;

const nodeWrapperExample = `// agentwing.ts - simple wrapper
const AW_KEY = process.env.AGENTWING_API_KEY!; // load once at startup
const AW_PROJECT = process.env.AGENTWING_PROJECT_ID!;

export async function checkAction(opts: {
  sessionId: string;
  agentId?: string;
  actionType: string;
  tool?: string;
  target?: string;
  command?: string;
  description?: string;
}) {
  const res = await fetch("https://agentwing.gpmai.dev/api/v1/check-action", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: \`Bearer \${AW_KEY}\`,
    },
    body: JSON.stringify({ projectId: AW_PROJECT, ...opts }),
  });
  return res.json() as Promise<{
    decision: "allow" | "block" | "approval_required" | "sandbox_required" | "restore_point_required";
    risk: "low" | "medium" | "high" | "critical";
    policy: string;
    feedback: string;
    receiptId: string;
    nextStep: string;
    approvalId?: string;
  }>;
}

// Usage in agent loop:
const result = await checkAction({
  sessionId: "sess_001",
  agentId: "coder",
  actionType: "shell_command",
  tool: "terminal",
  command: "npm install lodash",
  description: "Install a package",
});

if (result.decision === "block") throw new Error(result.feedback);
if (result.decision === "approval_required") return;
if (result.decision === "sandbox_required") {
  // Route to connected E2B or your own sandbox. Do not run locally.
  return;
}
// decision === "allow" - proceed`;

const responseExample = `{
  "decision": "block",
  "risk": "high",
  "policy": "block-secret-file-access",
  "feedback": "Secret-bearing files such as .env are blocked before contents can be exposed.",
  "receiptId": "aw_receipt_...",
  "nextStep": "Stop this action and re-plan without reading secret-bearing files."
}`;

const realAgentCommands = `cd C:\\Users\\ziyad\\agentwing-live-lab\\examples\\real-agent
npm install
copy .env.example .env
notepad .env
node real-agent.mjs`;

export default function IntegrationsPage() {
  return (
    <div className="max-w-4xl space-y-8">
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-cyan-200">Integrations</p>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight text-white">Integrate AgentWing with your agent</h1>
        <p className="mt-2 text-sm leading-6 text-slate-400">
          Call <span className="font-mono text-cyan-100">/api/v1/check-action</span> before executing any agent tool call.
          AgentWing returns a decision, risk level, policy name, human-readable feedback, and a receipt ID.
        </p>
      </div>

      <section className="rounded-md border border-white/[0.08] bg-[#080b12] p-6">
        <h2 className="text-base font-semibold text-white">Control flow</h2>
        <div className="mt-4 space-y-2">
          {[
            { step: "1", text: "Agent proposes an action: file read, shell command, network call, or other tool use." },
            { step: "2", text: "Client sends the proposed action to /api/v1/check-action before execution." },
            { step: "3", text: "AgentWing enforces critical default safety blocks, then evaluates custom policies and remaining defaults." },
            { step: "4", text: "Response includes decision, risk, policy, feedback, receiptId, and nextStep." },
            { step: "5", text: "Client executes only when allowed, stops on block, waits on approval, checkpoints on restore_point_required, and routes sandbox_required actions to a sandbox." },
          ].map(({ step, text }) => (
            <div key={step} className="flex items-start gap-3 rounded border border-white/[0.06] bg-[#05070d] p-3">
              <span className="flex size-6 shrink-0 items-center justify-center rounded border border-cyan-300/20 bg-cyan-300/[0.08] font-mono text-xs text-cyan-100">{step}</span>
              <span className="text-sm text-slate-300">{text}</span>
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-md border border-white/[0.08] bg-[#080b12] p-6">
        <h2 className="text-base font-semibold text-white">Decision values</h2>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          {[
            { d: "allow", cls: "text-emerald-200", desc: "Cleared. Proceed with execution." },
            { d: "block", cls: "text-red-200", desc: "Denied. Stop and re-plan. Check feedback." },
            { d: "approval_required", cls: "text-amber-200", desc: "Pause. Wait for human approval in Approvals dashboard." },
            { d: "sandbox_required", cls: "text-cyan-200", desc: "Route to connected E2B or your own sandbox. Do not execute locally without a sandbox." },
            { d: "restore_point_required", cls: "text-violet-200", desc: "Checkpoint current state before continuing." },
          ].map(({ d, cls, desc }) => (
            <div key={d} className="rounded border border-white/[0.06] bg-[#05070d] p-3">
              <p className={`font-mono text-sm font-semibold ${cls}`}>{d}</p>
              <p className="mt-1 text-xs text-slate-400">{desc}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-md border border-white/[0.08] bg-[#080b12] p-6">
        <h2 className="text-base font-semibold text-white">Response example</h2>
        <CodeBlock code={responseExample} />
      </section>

      <section className="rounded-md border border-white/[0.08] bg-[#080b12] p-6">
        <h2 className="text-base font-semibold text-white">Real local agent example</h2>
        <p className="mt-2 text-sm leading-6 text-slate-400">
          See <code className="font-mono text-cyan-100">examples/real-agent</code> for a deterministic agent loop.
          The API key is loaded once. AgentWing is called before each action.
        </p>
        <p className="mt-2 text-sm leading-6 text-slate-400">
          If no sandbox is connected, sandbox_required actions must not execute locally.
        </p>
        <CodeBlock code={realAgentCommands} />
      </section>

      <section className="rounded-md border border-white/[0.08] bg-[#080b12] p-6">
        <h2 className="text-base font-semibold text-white">Sandbox routing behavior</h2>
        <div className="mt-4 grid gap-3 md:grid-cols-3">
          <InfoBox title="BYOK E2B connected" body="sandbox_required actions can be routed to your connected E2B sandbox." />
          <InfoBox title="Own sandbox" body="Use the AgentWing decision to route action to the sandbox your agent already owns." />
          <InfoBox title="No sandbox connected" body="sandbox_required means do not execute locally. Connect E2B BYOK or use your own sandbox." />
        </div>
        <p className="mt-4 text-xs leading-5 text-slate-500">
          AgentWing does not replace sandbox providers. It is the runtime control layer that decides when to allow,
          block, require approval, require a restore point, or require a sandbox.
        </p>
      </section>

      <section className="rounded-md border border-white/[0.08] bg-[#080b12] p-6">
        <h2 className="text-base font-semibold text-white">cURL</h2>
        <CodeBlock code={curlExample} />
      </section>

      <section className="rounded-md border border-white/[0.08] bg-[#080b12] p-6">
        <h2 className="text-base font-semibold text-white">JavaScript fetch</h2>
        <CodeBlock code={fetchExample} />
      </section>

      <section className="rounded-md border border-white/[0.08] bg-[#080b12] p-6">
        <h2 className="text-base font-semibold text-white">Node.js typed wrapper</h2>
        <p className="mb-4 text-xs text-slate-400">Use this as a small reusable helper.</p>
        <CodeBlock code={nodeWrapperExample} />
      </section>

      <section className="rounded-md border border-white/[0.08] bg-[#080b12] p-6">
        <h2 className="text-base font-semibold text-white">Python</h2>
        <CodeBlock code={pythonExample} />
      </section>

      <div className="rounded border border-cyan-300/15 bg-cyan-300/[0.04] p-4 text-sm text-slate-300">
        <span className="font-semibold text-cyan-200">SDK coming soon.</span>{" "}
        A typed TypeScript SDK is planned. For now, use the Node.js wrapper above or the raw fetch API.
        Follow{" "}
        <a href="https://github.com/12ziyad" target="_blank" rel="noopener noreferrer" className="text-cyan-200 underline">github.com/12ziyad</a>{" "}
        for updates.
      </div>

      <div className="flex flex-wrap gap-3 text-sm">
        <Link href="/docs" className="rounded border border-white/[0.1] px-4 py-2 text-slate-300 transition hover:text-white">
          View full docs
        </Link>
        <Link href="/dashboard/api-keys" className="rounded border border-white/[0.1] px-4 py-2 text-slate-300 transition hover:text-white">
          Generate API key
        </Link>
        <Link href="/dashboard/policies" className="rounded border border-white/[0.1] px-4 py-2 text-slate-300 transition hover:text-white">
          Add policies
        </Link>
      </div>
    </div>
  );
}

function InfoBox({ title, body }: { title: string; body: string }) {
  return (
    <div className="rounded border border-white/[0.06] bg-[#05070d] p-3">
      <p className="text-sm font-semibold text-white">{title}</p>
      <p className="mt-1 text-xs leading-5 text-slate-400">{body}</p>
    </div>
  );
}

function CodeBlock({ code }: { code: string }) {
  return (
    <pre className="mt-4 overflow-x-auto rounded border border-white/[0.08] bg-[#05070d] p-4 text-xs leading-6 text-slate-300">
      {code}
    </pre>
  );
}
