# AgentWing

**Guarded execution control layer for AI agents.**

AgentWing sits between an AI agent and the tools/actions it wants to execute. Before an agent reads files, runs commands, edits code, installs packages, sends messages, touches data, or deploys, AgentWing checks and routes the action.

## What AgentWing does

- Checks agent actions before tools run
- Blocks risky actions like secret file access and destructive commands
- Creates action runs for managed execution lifecycle tracking
- Routes `sandbox_required` shell/package/code actions to BYOK E2B when connected
- Pauses `approval_required` actions until a human approves
- Requires restore points before sensitive file/config changes
- Captures logs/output/status when execution is performed
- Creates auditable receipts for checks and runs

## Runtime flow

```txt
Agent proposes action
-> AgentWing evaluates policy
-> AgentWing creates an action run
-> Action is blocked / approved / sandboxed / checkpointed / skipped
-> Execution result or next safe step is recorded
-> Receipt is sealed
```

## APIs

### Lightweight decision API

`POST /api/v1/check-action`

Returns one of:

```txt
allow
block
sandbox_required
approval_required
restore_point_required
```

This endpoint remains the smallest integration point: send a proposed action and receive a decision, feedback, next step, and receipt ID.

### Managed lifecycle API

`POST /api/v1/execute-action`

Creates an action run and advances it safely:

- `block` -> run status `blocked`; no execution
- `allow` -> safe read/check actions become `execution_skipped`; other tools require an explicit external runner
- `sandbox_required` -> runs in E2B only if BYOK E2B is connected; otherwise `waiting_sandbox`
- `approval_required` -> creates an approval and waits in `waiting_approval`
- `restore_point_required` -> waits for a real restore point or external runner continuation

Hosted AgentWing does not execute arbitrary shell commands on the server.

For terminal or IDE runners, include a runtime approval surface:

```json
{
  "action": { "...": "same AgentAction shape" },
  "runtime": {
    "surface": "cli",
    "interactiveApproval": true,
    "runnerId": "my-local-runner"
  }
}
```

When the decision is `approval_required`, AgentWing returns a short-lived one-time runner approval token and runner approve/reject endpoints. The normal API key creates the run but cannot approve it by itself.

## Example check

```bash
curl -X POST https://agentwing.gpmai.dev/api/v1/check-action \
  -H "Authorization: Bearer YOUR_AGENTWING_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "projectId": "YOUR_PROJECT_ID",
    "sessionId": "demo-session",
    "agentId": "coding-agent",
    "actionType": "file_access",
    "tool": "filesystem",
    "target": ".env",
    "description": "Agent wants to read environment secrets"
  }'
```

## Example managed run

```bash
curl -X POST https://agentwing.gpmai.dev/api/v1/execute-action \
  -H "Authorization: Bearer YOUR_AGENTWING_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "projectId": "YOUR_PROJECT_ID",
    "sessionId": "demo-session",
    "agentId": "coding-agent",
    "actionType": "package_install",
    "tool": "npm",
    "command": "npm install lodash"
  }'
```

Open `/dashboard/runs/{runId}` to see the full lifecycle: proposed action, decision, approval/sandbox/checkpoint path, execution status, logs, and receipt.

## Sandbox behavior

AgentWing does not replace sandbox providers. It decides when an action needs sandbox execution.

If BYOK E2B is connected, `sandbox_required` shell/package/code actions run in E2B and AgentWing captures stdout, stderr, exit code, duration, and receipt metadata.

If E2B is not connected, AgentWing sets the run to `waiting_sandbox` and does not run the action locally.

## Local runner behavior

Local execution is explicit. The SDK/example runner can continue a run only when the caller provides a local runner callback. AgentWing never silently runs shell commands on the hosted server.

Examples:

- `examples/guarded-runner` shows the managed run lifecycle.
- `examples/runtime-approval` shows terminal approval with the one-time runner token.

## Status

AgentWing public beta is live:

https://agentwing.gpmai.dev

Current beta includes:

- Google sign-in
- projects and API keys
- `/api/v1/check-action`
- `/api/v1/execute-action`
- action runs dashboard
- default safety policies
- custom policies
- inline approval gates
- receipts and usage tracking
- BYOK E2B sandbox connection

## License

Apache License 2.0
