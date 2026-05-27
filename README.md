# AgentWing

**Runtime control and sandbox routing layer for AI agents.**

AgentWing sits between an AI agent and the tools/actions it wants to execute.  
Before an agent reads files, runs commands, edits code, installs packages, or touches infrastructure, AgentWing checks the action and returns a runtime decision.

## What AgentWing does

- Checks agent actions before execution
- Blocks risky actions like secret file access
- Routes unsafe commands to sandbox
- Supports approval-required decisions
- Creates receipts for every checked action
- Gives feedback so agents can re-plan safely

## Runtime flow

```txt
Agent proposes action
→ AgentWing checks policy
→ AgentWing returns decision
→ Agent executes / stops / asks approval / uses sandbox
→ Receipt is saved
```

## How to integrate

### 1. Open AgentWing

[agentwing.gpmai.dev](https://agentwing.gpmai.dev)

Sign in with Google and create a project.

### 2. Generate an API key

Go to **Dashboard → API Keys** and generate a key.

Keep it safe. The full key is shown only once.

### 3. Call AgentWing before every agent action

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

### 4. Handle the decision

```txt
allow → execute action
block → stop action
approval_required → ask human approval
sandbox_required → run in sandbox
restore_point_required → create checkpoint first
```

Example response:

```json
{
  "decision": "block",
  "risk": "high",
  "policy": "block-secret-file-access",
  "feedback": "Secret-bearing files such as .env are blocked before contents can be exposed.",
  "receiptId": "aw_receipt_xxx",
  "nextStep": "Stop this action and re-plan without reading secret-bearing files."
}
```

## Sandbox behavior

AgentWing does not replace sandbox providers.

It decides **when** an action should be sandboxed.

If a sandbox is connected, route `sandbox_required` actions there.  
If no sandbox is connected, do not run those actions locally.

## Status

**AgentWing public beta is live.**

You can test it here:

[agentwing.gpmai.dev](https://agentwing.gpmai.dev)

Try the flow:

1. Sign in with Google
2. Create a project
3. Generate an API key
4. Call `/api/v1/check-action` before your agent executes an action
5. View receipts and usage in the dashboard

AgentWing currently includes:

- Google sign-in
- projects and API keys
- runtime action check API
- default safety policies
- custom policies
- receipts and usage tracking
- BYOK E2B sandbox connection

## License

Apache License 2.0
