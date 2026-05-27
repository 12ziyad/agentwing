# AgentWing Real Agent Example

This example shows a small local agent loop that asks AgentWing before every proposed action. The default plan is deterministic, so it works without `OPENAI_API_KEY`.

## Run on Windows PowerShell

```powershell
cd C:\Users\ziyad\agentwing-live-lab\examples\real-agent
npm install
copy .env.example .env
notepad .env
node real-agent.mjs
```

## Configure

Get an AgentWing API key from:

https://agentwing.gpmai.dev/dashboard/api-keys

Get a project ID from:

https://agentwing.gpmai.dev/dashboard/projects

Paste both into `.env`:

```env
AGENTWING_BASE_URL=https://agentwing.gpmai.dev
AGENTWING_API_KEY=your_agentwing_key
AGENTWING_PROJECT_ID=your_project_id
OPENAI_API_KEY=
```

`OPENAI_API_KEY` is optional. This example keeps the deterministic plan by default so testers see the same decisions every run.

## Expected behavior

The agent proposes four actions:

1. `package.json` read -> `allow` -> executes a safe local read
2. `.env` read -> `block` -> skipped
3. `npm install lodash` -> `sandbox_required` -> skipped locally
4. `rm -rf /` -> `block` with `critical` risk -> skipped

For `sandbox_required`, this example does not execute locally. Route the action to AgentWing sandbox/E2B or your own connected sandbox.

For `approval_required`, the example prints the approval ID when AgentWing returns one and tells you to open:

https://agentwing.gpmai.dev/dashboard/approvals

For `restore_point_required`, the example prints checkpoint guidance. It does not fake rollback.

## After running

Check receipts and usage:

https://agentwing.gpmai.dev/dashboard/receipts

https://agentwing.gpmai.dev/dashboard/usage

Admins can also check:

https://agentwing.gpmai.dev/admin
