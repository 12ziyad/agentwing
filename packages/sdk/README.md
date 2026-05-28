# @agentwing/sdk

TypeScript/Node.js SDK for [AgentWing](https://agentwing.gpmai.dev) — runtime control layer for AI agents.

## Quickstart — interactive runtime approval

```ts
import { AgentWing } from "@agentwing/sdk";
import * as readline from "node:readline/promises";

const aw = new AgentWing({ apiKey: process.env.AGENTWING_API_KEY });

const { run } = await aw.executeAction(
  { actionType: "deploy_action", target: "production", description: "Deploy to prod" },
  {
    runtime: {
      surface: "cli",
      onApprovalRequired: async ({ run, approval }) => {
        console.log("Approval required:", approval.approvalUrl);
        const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
        const answer = await rl.question("Approve deploy? (y/n) ");
        rl.close();
        return answer.trim().toLowerCase() === "y"
          ? "approve"
          : { decision: "reject", reason: "Operator declined." };
      },
    },
  },
);
console.log("Final status:", run.status);
```

The SDK calls `onApprovalRequired` when the server returns `waiting_approval` with a runner token.  
It then POSTs the decision to `approval.approveEndpoint` or `approval.rejectEndpoint` with  
`Authorization: Bearer <runnerApprovalToken>`.

## Low-level runner-approve / runner-reject endpoints

```bash
# Approve using the runner token directly in the Authorization header:
curl -X POST https://agentwing.gpmai.dev/api/v1/action-runs/RUN_ID/runner-approve \
  -H "Authorization: Bearer aw_rat_RUNNER_TOKEN_HERE" \
  -H "Content-Type: application/json" \
  -d '{}'

# Reject:
curl -X POST https://agentwing.gpmai.dev/api/v1/action-runs/RUN_ID/runner-reject \
  -H "Authorization: Bearer aw_rat_RUNNER_TOKEN_HERE" \
  -H "Content-Type: application/json" \
  -d '{"reason":"Not safe right now."}'

# Legacy: body.runnerApprovalToken is also accepted (back-compat):
curl -X POST .../runner-approve \
  -H "Authorization: Bearer aw_live_KEY" \
  -H "Content-Type: application/json" \
  -d '{"runnerApprovalToken":"aw_rat_..."}'

# aw_live_ key alone (no runner token) → 400 missing_runner_approval_token
```

Token precedence in the routes:
1. `Authorization: Bearer <token>` — treated as runner token when it does NOT start with `aw_live_`
2. `body.runnerApprovalToken`
3. `body.token`

## Error codes

| code | status | meaning |
|---|---|---|
| `missing_runner_approval_token` | 400 | No runner token in header or body |
| `invalid_runner_token` | 401 | Token not found / wrong run |
| `expired_runner_token` | 401 | Token TTL elapsed (default 15 min) |
| `runner_token_already_used` | 409 | One-time token already consumed |
| `run_not_waiting_approval` | 409 | Run not in `waiting_approval` |
| `blocked_action_cannot_be_approved` | 409 | `block` decisions cannot be approved |
| `run_not_found` | 404 | Run ID not found |

The SDK surfaces these as `AgentWingError` with a `.code` property:

```ts
import { AgentWingError } from "@agentwing/sdk";

try {
  const { run } = await aw.executeAction(action, { runtime: { surface: "cli", onApprovalRequired } });
} catch (err) {
  if (err instanceof AgentWingError) {
    console.error(err.code, err.message); // e.g. "runner_token_already_used"
  }
}
```

## API

### `new AgentWing(options)`

| option | type | description |
|---|---|---|
| `apiKey` | `string` | `aw_live_…` key |
| `baseUrl` | `string` | Default: `https://agentwing.gpmai.dev` |
| `fetch` | `typeof fetch` | Custom fetch implementation |

### `executeAction(action, options?)`

| option | type | description |
|---|---|---|
| `runtime.surface` | `"cli" \| "ide" \| "web" \| "webhook"` | Tells server which surface is calling |
| `runtime.onApprovalRequired` | callback | Called with `{ run, approval }` — return `"approve"` / `"reject"` |
| `runtime.approvalTimeoutMs` | `number` | Default 5 min; returns `{ run, timedOut: true }` if exceeded |
| `runtime.runnerId` | `string` | Optional runner identifier |
| `pollIntervalMs` | `number` | Polling interval for legacy wait-for-dashboard flow |
| `maxWaitMs` | `number` | Max wait for polling |
| `createRestorePoint` | callback | Called before restore-point actions |
| `localRunner` | callback | Execute action locally and report result |
| `serializeLocalResult` | callback | Serialize local runner output |
