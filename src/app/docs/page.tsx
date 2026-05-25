import Link from "next/link";

const fetchExample = `const response = await fetch("https://your-agentwing-host.com/api/v1/check-action", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    Authorization: \`Bearer \${process.env.AGENTWING_API_KEY}\`
  },
  body: JSON.stringify({
    projectId: "proj_live",
    sessionId: "sess_123",
    agentId: "agent_coder",
    actionType: "shell_command",
    tool: "terminal",
    command: "npm test",
    description: "Run the project test suite before writing files"
  })
});

const decision = await response.json();`;

const usageExample = `const usage = await fetch("https://your-agentwing-host.com/api/v1/usage", {
  headers: {
    Authorization: \`Bearer \${process.env.AGENTWING_API_KEY}\`
  }
}).then((response) => response.json());`;

const sandboxRunExample = `const sandboxResult = await fetch("https://your-agentwing-host.com/api/v1/sandbox/run", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    Authorization: \`Bearer \${process.env.AGENTWING_API_KEY}\`
  },
  body: JSON.stringify({
    projectId: "proj_live",
    sessionId: "sess_123",
    agentId: "agent_coder",
    provider: "e2b",
    action: {
      actionType: "shell_command",
      tool: "terminal",
      target: "e2b sandbox",
      command: "node -e \\"console.log('hello from AgentWing sandbox')\\"",
      description: "Run command in an E2B BYOK sandbox"
    }
  })
}).then((response) => response.json());`;

const createProjectExample = `const { project } = await fetch("https://your-agentwing-host.com/api/v1/projects", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ name: "Production Coding Agent" })
}).then((response) => response.json());`;

const generateKeyExample = `const { apiKey } = await fetch("https://your-agentwing-host.com/api/v1/api-keys", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ projectId: project.projectId })
}).then((response) => response.json());

// Store this securely. AgentWing only shows the full key once.`;

const d1Commands = `wrangler d1 create agentwing_v1

# Put the returned database_id into wrangler.jsonc:
# binding = AGENTWING_DB
# database_name = agentwing_v1

wrangler d1 migrations apply agentwing_v1 --local
wrangler d1 migrations apply agentwing_v1 --remote`;

const sandboxSecretCommands = `# Required when storing usable BYOK sandbox keys in D1
wrangler secret put AGENTWING_SANDBOX_SECRET

# Optional server-level E2B fallback key
wrangler secret put E2B_API_KEY`;

const sdkExample = `import { AgentWing } from "@agentwing/sdk";

const agentwing = new AgentWing({
  apiKey: process.env.AGENTWING_API_KEY!, // local/dev: aw_live_demo_key
  baseUrl: "https://your-agentwing-host.com"
});

const result = await agentwing.checkAction({
  projectId: "proj_live",
  sessionId: "sess_123",
  agentId: "agent_coder",
  actionType: "file_access",
  tool: "fs.writeFile",
  target: "src/App.tsx",
  description: "Update application copy",
  metadata: { operation: "write" }
});`;

const guardExample = `await agentwing.guardAction({
  action: {
    projectId: "proj_live",
    sessionId: "sess_123",
    agentId: "agent_coder",
    actionType: "api_call",
    tool: "github",
    target: "GET /repos/acme/app/issues",
    description: "Read issues before planning work"
  },
  execute: () => github.rest.issues.listForRepo(params)
});`;

export default function DocsPage() {
  return (
    <main className="min-h-screen bg-[#05070d] text-slate-100">
      <header className="border-b border-white/[0.08] bg-[#080b12]">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-4 sm:px-6">
          <Link href="/" className="text-sm font-semibold text-white">
            AgentWing
          </Link>
          <div className="flex items-center gap-2">
            <Link href="/dashboard" className="rounded-md border border-white/[0.1] px-3 py-2 text-xs font-semibold text-slate-200">
              Dashboard
            </Link>
            <Link href="/runtime-lab" className="rounded-md border border-cyan-300/25 bg-cyan-300 px-3 py-2 text-xs font-semibold text-[#031018]">
              Runtime Lab
            </Link>
          </div>
        </div>
      </header>
      <section className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-cyan-200">API and SDK</p>
        <h1 className="mt-3 max-w-3xl text-4xl font-semibold tracking-tight text-white">
          Universal runtime control for AI agent actions
        </h1>
        <p className="mt-5 max-w-3xl text-base leading-7 text-slate-300">
          Put AgentWing before your agent tools. It checks proposed actions and returns allow, block,
          approval_required, sandbox_required, or restore_point_required with feedback and an audit receipt.
        </p>
        <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-400">
          Authenticate API requests with <span className="font-mono text-cyan-100">Authorization: Bearer &lt;key&gt;</span>.
          Local development includes <span className="font-mono text-cyan-100">aw_live_demo_key</span> on the Beta plan.
          Project and API key management endpoints are intended for authenticated dashboard/admin sessions.
        </p>

        <div className="mt-8 grid gap-4 md:grid-cols-3">
          {["Policy", "Approval", "Sandbox routing", "Restore points", "Feedback", "Audit receipts"].map((item) => (
            <div key={item} className="rounded-md border border-white/[0.08] bg-[#080b12] p-4 text-sm font-semibold text-white">
              {item}
            </div>
          ))}
        </div>

        <DocSection title="Install" code="npm install @agentwing/sdk" />
        <DocSection title="Create a project" code={createProjectExample} />
        <DocSection title="Generate an API key" code={generateKeyExample} />
        <DocSection title="Create a client" code={sdkExample} />
        <DocSection title="Guard tool execution" code={guardExample} />
        <DocSection title="Use the HTTP API" code={fetchExample} />
        <DocSection title="Run sandbox-required action" code={sandboxRunExample} />
        <DocSection title="Check usage balance" code={usageExample} />
        <DocSection title="Cloudflare D1 persistence" code={d1Commands} />
        <DocSection title="Sandbox secrets" code={sandboxSecretCommands} />

        <section className="mt-8 rounded-md border border-white/[0.08] bg-[#080b12] p-5">
          <h2 className="text-xl font-semibold text-white">Persistent storage</h2>
          <p className="mt-3 text-sm leading-6 text-slate-300">
            Bind a Cloudflare D1 database as AGENTWING_DB to persist api_keys, usage, receipts, and sandbox_configs.
            If the binding is unavailable, AgentWing keeps a local in-memory development fallback so Runtime Lab and
            dashboard flows still work.
          </p>
        </section>

        <section className="mt-8 rounded-md border border-white/[0.08] bg-[#080b12] p-5">
          <h2 className="text-xl font-semibold text-white">AgentAction schema</h2>
          <p className="mt-3 text-sm leading-6 text-slate-300">
            Send projectId, sessionId, agentId, actionType, tool, target, command, description, and metadata.
            Supported action types are file_access, shell_command, api_call, browser_action, database_query,
            message_send, payment_action, deploy_action, and custom_action.
          </p>
        </section>

        <section className="mt-8 rounded-md border border-white/[0.08] bg-[#080b12] p-5">
          <h2 className="text-xl font-semibold text-white">Decisions</h2>
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            {[
              ["allow", "The action is low risk and can execute."],
              ["block", "The action is denied, such as secret access or force push."],
              ["approval_required", "A human should approve before the action executes."],
              ["sandbox_required", "Run the action in an isolated sandbox before continuing."],
              ["restore_point_required", "Create a restore point before mutating files or state."],
            ].map(([decision, copy]) => (
              <div key={decision} className="rounded border border-white/[0.08] bg-[#05070d] p-3">
                <p className="font-mono text-sm text-cyan-100">{decision}</p>
                <p className="mt-2 text-sm leading-6 text-slate-400">{copy}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="mt-8 rounded-md border border-white/[0.08] bg-[#080b12] p-5">
          <h2 className="text-xl font-semibold text-white">Sandbox modes</h2>
          <p className="mt-3 text-sm leading-6 text-slate-300">
            E2B BYOK lets teams connect their own E2B account and keep sandbox credentials server-side. Custom HTTP
            sandboxes are planned for teams with their own runner. AgentWing Managed Sandbox is coming later and is not
            enabled in this V1 build.
          </p>
          <p className="mt-3 text-sm leading-6 text-slate-400">
            Customers do not install the E2B SDK or write E2B code. They call AgentWing with their AgentWing API key;
            AgentWing uses the saved BYOK key server-side when a policy requires sandbox execution.
          </p>
        </section>
      </section>
    </main>
  );
}

function DocSection({ title, code }: { title: string; code: string }) {
  return (
    <section className="mt-8 rounded-md border border-white/[0.08] bg-[#080b12] p-5">
      <h2 className="text-xl font-semibold text-white">{title}</h2>
      <pre className="mt-4 overflow-x-auto rounded-md border border-white/[0.08] bg-[#05070d] p-4 text-sm leading-6 text-slate-300">
        {code}
      </pre>
    </section>
  );
}
