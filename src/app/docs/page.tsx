import Link from "next/link";

const curlExample = `curl -X POST https://agentwing.gpmai.dev/api/v1/check-action \\
  -H "Authorization: Bearer AW_LIVE_KEY_HERE" \\
  -H "Content-Type: application/json" \\
  -d '{
    "projectId": "YOUR_PROJECT_ID",
    "sessionId": "live-test",
    "agentId": "test-agent",
    "actionType": "file_access",
    "tool": "filesystem",
    "target": ".env",
    "description": "Read .env file"
  }'`;

const executeActionExample = `curl -X POST https://agentwing.gpmai.dev/api/v1/execute-action \\
  -H "Authorization: Bearer AW_LIVE_KEY_HERE" \\
  -H "Content-Type: application/json" \\
  -d '{
    "projectId": "YOUR_PROJECT_ID",
    "sessionId": "live-test",
    "agentId": "test-agent",
    "actionType": "package_install",
    "tool": "npm",
    "command": "npm install lodash",
    "description": "Install lodash"
  }'`;

const psExample = `$headers = @{
  "Authorization" = "Bearer AW_LIVE_KEY_HERE"
  "Content-Type"  = "application/json"
}
$body = @{
  projectId  = "YOUR_PROJECT_ID"
  sessionId  = "live-test"
  agentId    = "test-agent"
  actionType = "file_access"
  tool       = "filesystem"
  target     = ".env"
} | ConvertTo-Json

Invoke-RestMethod -Method POST \\
  -Uri "https://agentwing.gpmai.dev/api/v1/check-action" \\
  -Headers $headers -Body $body`;

const fetchExample = `const response = await fetch("https://agentwing.gpmai.dev/api/v1/check-action", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    Authorization: \`Bearer \${process.env.AGENTWING_API_KEY}\`,
  },
  body: JSON.stringify({
    projectId: "YOUR_PROJECT_ID",
    sessionId: "sess_123",
    agentId: "agent_coder",
    actionType: "file_access",
    tool: "filesystem",
    target: ".env",
    description: "Read .env file",
  }),
});

const { decision, risk, policy, feedback, receiptId } = await response.json();
// decision: "block"
// risk: "high"
// policy: "block-secret-file-access"`;

const responseExample = `{
  "decision": "block",
  "risk": "high",
  "policy": "block-secret-file-access",
  "feedback": "Secret-bearing files such as .env are blocked before contents can be exposed.",
  "receiptId": "aw_receipt_..."
}`;

const approvalHandoffExample = `import { AgentWing } from "@agentwing/sdk";

const aw = new AgentWing({ apiKey: process.env.AGENTWING_API_KEY });

const { run, approval } = await aw.executeAction({
  actionType: "deploy_action",
  target: "production",
  description: "Deploy to prod",
});

if (run.status === "waiting_approval") {
  // Surface this to your operator. AgentWing deliberately does NOT hand the
  // agent a credential that would approve its own action.
  console.log("Approve at:", approval.approvalUrl);

  // Then poll until a human decides.
  let current = run;
  while (current.status === "waiting_approval") {
    await new Promise((r) => setTimeout(r, 3000));
    current = await aw.getActionRun(run.runId);
  }
  console.log("Operator decided:", current.status);
}`;

const approvalCurlExample = `# 1. Propose the action. A gated action comes back waiting_approval.
curl -X POST https://agentwing.gpmai.dev/api/v1/execute-action \\
  -H "Authorization: Bearer AW_LIVE_KEY_HERE" \\
  -H "Content-Type: application/json" \\
  -d '{"actionType":"deploy_action","target":"production","description":"Deploy to prod"}'

# Response contains run.status = "waiting_approval" and:
#   approval.approvalUrl  -> where a human approves
#   approval.statusUrl    -> poll this until the status changes
#
# It does NOT contain an approval credential. The agent proposing an action
# cannot approve it.

# 2. A human approves in the dashboard, or with their own session:
#    POST /api/v1/action-runs/RUN_ID/approve
#    POST /api/v1/action-runs/RUN_ID/reject

# 3. Poll for the outcome:
curl https://agentwing.gpmai.dev/api/v1/action-runs/RUN_ID \\
  -H "Authorization: Bearer AW_LIVE_KEY_HERE"`;

const customPolicyExample = `// Create a policy via dashboard /dashboard/policies
// or via API (authenticated dashboard session):
POST /api/v1/policies
{
  "name": "Block rm -rf",
  "actionType": "shell_command",
  "commandPattern": "rm -rf*",
  "decision": "block",
  "risk": "critical",
  "priority": 5,
  "feedback": "rm -rf is blocked unconditionally."
}`;

export default function DocsPage() {
  return (
    <main className="min-h-screen bg-[#05070d] text-slate-100">
      <header className="border-b border-white/[0.08] bg-[#080b12]">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-4 sm:px-6">
          <Link href="/" className="text-sm font-semibold text-white">
            AgentWing
          </Link>
          <div className="flex items-center gap-2">
            <Link href="/dashboard" className="rounded-md border border-white/[0.1] px-3 py-2 text-xs font-semibold text-slate-200 transition hover:text-white">
              Dashboard
            </Link>
            <a href="/api/auth/signin/google?next=/dashboard" className="rounded-md border border-cyan-300/25 bg-cyan-300 px-3 py-2 text-xs font-semibold text-[#031018]">
              Sign up free
            </a>
          </div>
        </div>
      </header>
      <section className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-cyan-200">Documentation</p>
        <h1 className="mt-3 max-w-3xl text-4xl font-semibold tracking-tight text-white">
          AgentWing — Runtime control layer for AI agents
        </h1>
        <p className="mt-5 max-w-3xl text-base leading-7 text-slate-300">
          Policy decisions, approval gates, BYOK sandbox execution, execution logs, and audit receipts — before your tools run.
        </p>

        <div className="mt-8 grid gap-4 md:grid-cols-3">
          {["Policy checks", "Approval gates", "BYOK sandbox (E2B)", "Custom policies", "Structured feedback", "Audit receipts"].map((item) => (
            <div key={item} className="rounded-md border border-white/[0.08] bg-[#080b12] p-4 text-sm font-semibold text-white">
              {item}
            </div>
          ))}
        </div>

        <DocSection title="0. Approval gates">
          <p className="mb-3 text-sm leading-6 text-slate-300">
            When a decision is <code className="font-mono text-cyan-100">approval_required</code>, the run parks at{" "}
            <code className="font-mono text-cyan-100">waiting_approval</code> and the response tells your agent where a
            human can approve and how to poll for the outcome.
          </p>
          <div className="mb-4 rounded border border-cyan-300/20 bg-cyan-300/[0.04] px-3 py-2 text-xs leading-5 text-cyan-100">
            <strong className="font-semibold">The response carries no approval credential.</strong> The agent proposing
            an action cannot approve it — that separation is the whole point of an approval gate, so approval happens
            through a separately-authenticated human session in the dashboard.
          </div>
          <CodeBlock label="TypeScript / Node.js SDK" code={approvalHandoffExample} />
          <CodeBlock label="cURL" code={approvalCurlExample} />
          <div className="mt-3 grid gap-2 md:grid-cols-2">
            {[
              ["run_not_found (404)", "Run ID not found, or it belongs to another workspace."],
              ["blocked_action_cannot_execute (409)", "A blocked run can never report an execution result."],
              ["run_not_awaiting_execution (409)", "The run is not in a status where executing was authorised."],
              ["policy_store_unavailable (503)", "Policies could not be read, so no decision was made. Retry."],
              ["rate_limited (429)", "Too many requests in the current window. Honour Retry-After."],
              ["plan_limit_reached (429)", "The API key has used its plan allowance."],
            ].map(([code, desc]) => (
              <div key={code} className="rounded border border-white/[0.08] bg-[#05070d] p-3">
                <p className="font-mono text-xs text-red-300">{code}</p>
                <p className="mt-1 text-xs text-slate-400">{desc}</p>
              </div>
            ))}
          </div>
        </DocSection>

        <DocSection title="1. Sign up free">
          <p className="text-sm leading-6 text-slate-300">
            Sign up at{" "}
            <a href="https://agentwing.gpmai.dev" className="font-mono text-cyan-100 underline">agentwing.gpmai.dev</a>{" "}
            using Google. No password needed — click <strong className="text-white">Continue with Google</strong>.
            Your workspace, projects, API keys, receipts, and sandbox config are all user-scoped.
          </p>
        </DocSection>

        <DocSection title="2. Create a project">
          <p className="text-sm leading-6 text-slate-300">
            Go to <Link href="/dashboard/projects" className="font-mono text-cyan-100">Dashboard → Projects</Link> and create a project.
            Projects scope your API keys, policies, receipts, and usage.
          </p>
        </DocSection>

        <DocSection title="3. Generate an API key">
          <p className="text-sm leading-6 text-slate-300">
            Go to <Link href="/dashboard/api-keys" className="font-mono text-cyan-100">Dashboard → API Keys</Link>, select a project, and click Generate key.
            Copy the full key immediately — it is only shown once. Existing keys show only a masked prefix.
          </p>
          <div className="mt-3 rounded border border-amber-300/20 bg-amber-300/[0.04] px-3 py-2 text-xs text-amber-100">
            Security: API keys are stored as a SHA-256 hash. The full key is never stored or retrievable after generation.
          </div>
        </DocSection>

        <DocSection title="4. Call /api/v1/check-action">
          <p className="mb-4 text-sm leading-6 text-slate-300">
            Before executing any agent tool call, send the proposed action to AgentWing. The response tells you what to do.
          </p>
          <CodeBlock label="cURL" code={curlExample} />
          <CodeBlock label="PowerShell" code={psExample} />
          <CodeBlock label="JavaScript fetch" code={fetchExample} />
          <CodeBlock label="Expected response" code={responseExample} />
        </DocSection>

        <DocSection title="4b. Or create a managed action run">
          <p className="mb-4 text-sm leading-6 text-slate-300">
            Use <code className="font-mono text-cyan-100">/api/v1/execute-action</code> when you want AgentWing to create a full lifecycle record. Runs are visible at <Link href="/dashboard/runs" className="font-mono text-cyan-100">Dashboard - Runs</Link>.
          </p>
          <CodeBlock label="cURL" code={executeActionExample} />
        </DocSection>

        <DocSection title="5. Decision values">
          <div className="grid gap-3 md:grid-cols-2">
            {[
              ["allow", "The action is low risk and can execute immediately."],
              ["block", "The action is denied — e.g., secret file access, force push."],
              ["approval_required", "A human should approve before the action executes."],
              ["sandbox_required", "Run the action in an isolated sandbox first."],
              ["restore_point_required", "Create a restore point before mutating files or state."],
            ].map(([decision, copy]) => (
              <div key={decision} className="rounded border border-white/[0.08] bg-[#05070d] p-3">
                <p className="font-mono text-sm text-cyan-100">{decision}</p>
                <p className="mt-2 text-sm leading-6 text-slate-400">{copy}</p>
              </div>
            ))}
          </div>
        </DocSection>

        <DocSection title="6. Custom policies">
          <p className="mb-4 text-sm leading-6 text-slate-300">
            Go to <Link href="/dashboard/policies" className="font-mono text-cyan-100">Dashboard → Policies</Link> to create project-specific policies.
            Critical default safety blocks run first. Custom policies then match before the remaining AgentWing ruleset.
            Use priority (lower = first) to control custom policy order.
          </p>
          <p className="mb-3 text-sm text-slate-300">Matching: empty field = match any. Target and command patterns support <code className="font-mono text-cyan-100">*</code> wildcards.</p>
          <CodeBlock label="Example — create via API" code={customPolicyExample} />
        </DocSection>

        <DocSection title="7. Connect E2B BYOK sandbox">
          <p className="text-sm leading-6 text-slate-300">
            Go to <Link href="/dashboard/sandboxes" className="font-mono text-cyan-100">Dashboard → Sandboxes</Link> and paste your E2B API key.
            The key is stored encrypted server-side using AES-GCM with your configured{" "}
            <code className="font-mono text-cyan-100">AGENTWING_SANDBOX_SECRET</code>.
            It is never returned to the browser.
          </p>
          <div className="mt-3 space-y-2 text-sm text-slate-300">
            <p>When <code className="font-mono text-cyan-100">sandbox_required</code> is returned, AgentWing will use your saved key to run the action in E2B.</p>
            <p>Use <strong className="text-white">Test connection</strong> to verify the key works.</p>
          </div>
        </DocSection>

        <DocSection title="8. Receipts and usage">
          <p className="text-sm leading-6 text-slate-300">
            Every <code className="font-mono text-cyan-100">/api/v1/check-action</code> call and managed action run creates an audit receipt.
            Go to <Link href="/dashboard/receipts" className="font-mono text-cyan-100">Dashboard → Receipts</Link> to view them.
            Click any receipt for the full decision detail, sandbox output, and metadata.
            <br />
            <Link href="/dashboard/usage" className="font-mono text-cyan-100">Dashboard → Usage</Link> shows workspace-level counters for action checks, sandbox runs, and receipts.
          </p>
        </DocSection>

        <DocSection title="9. Security notes">
          <ul className="space-y-2 text-sm leading-6 text-slate-300">
            <li>• API keys are shown once and stored as a SHA-256 hash. They cannot be retrieved after generation.</li>

            <li>• E2B keys are encrypted server-side with AES-GCM. The raw key is never returned to the browser.</li>
            <li>• Command output, error text, and event metadata are redacted for known credential formats before they are stored or returned.</li>
            <li>• Every query carrying tenant data requires a workspace, enforced by the type signatures rather than by convention.</li>
            <li>• The admin console requires a verified admin email set in <code className="font-mono text-cyan-100">ADMIN_EMAILS</code>.</li>
            <li>• Authentication is Google OAuth only. No password is stored.</li>
          </ul>
        </DocSection>

        <DocSection title="10. Required secrets (Cloudflare)">
          <p className="mb-3 text-sm text-slate-300">Set these via <code className="font-mono text-cyan-100">wrangler secret put &lt;NAME&gt;</code>:</p>
          <div className="space-y-2">
            {[
              ["GOOGLE_CLIENT_ID", "Google OAuth client ID"],
              ["GOOGLE_CLIENT_SECRET", "Google OAuth client secret"],
              ["AUTH_URL", "Your production URL, e.g. https://agentwing.gpmai.dev"],
              ["AGENTWING_SANDBOX_SECRET", "Random 32-byte base64 secret for E2B key encryption"],
              ["ADMIN_EMAILS", "Comma-separated admin emails, e.g. you@example.com"],
            ].map(([name, desc]) => (
              <div key={name} className="flex gap-3 rounded border border-white/[0.08] bg-[#05070d] px-3 py-2">
                <code className="font-mono text-xs text-cyan-100">{name}</code>
                <span className="text-xs text-slate-400">{desc}</span>
              </div>
            ))}
          </div>
        </DocSection>
      </section>
    </main>
  );
}

function DocSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-8 rounded-md border border-white/[0.08] bg-[#080b12] p-5">
      <h2 className="text-lg font-semibold text-white">{title}</h2>
      <div className="mt-4">{children}</div>
    </section>
  );
}

function CodeBlock({ label, code }: { label: string; code: string }) {
  return (
    <div className="mb-4">
      <p className="mb-2 text-xs font-semibold text-slate-500">{label}</p>
      <pre className="overflow-x-auto rounded-md border border-white/[0.08] bg-[#05070d] p-4 text-xs leading-6 text-slate-300">{code}</pre>
    </div>
  );
}
