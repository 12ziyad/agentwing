# @agentwing/sdk

Runtime control layer for AI agents. Ask before your agent acts; obey the answer.

```bash
npm install @agentwing/sdk
```

Node 18+. Ships ESM and CJS with types.

## The short version

```ts
import { AgentWing, AgentWingGuardError } from "@agentwing/sdk";

const aw = new AgentWing({ apiKey: process.env.AGENTWING_API_KEY! });

try {
  const output = await aw.guardAction({
    action: {
      actionType: "shell_command",
      tool: "terminal",
      command: "rm -rf ./build",
      description: "Clean the build directory.",
    },
    execute: () => runInMyShell("rm -rf ./build"),
  });
} catch (error) {
  if (error instanceof AgentWingGuardError) {
    // AgentWing did not allow it. Tell the model why and let it re-plan.
    console.error(error.result.decision, error.result.feedback);
  }
}
```

`guardAction` throws when the decision is anything but `allow`, so a blocked
action cannot be missed by forgetting to check a return value.

## Decisions

Every action gets exactly one:

| Decision | Meaning |
|---|---|
| `allow` | Proceed. |
| `block` | Never run this. |
| `approval_required` | A human decides. |
| `sandbox_required` | Run it in a sandbox, not on the host. |
| `restore_point_required` | Make it reversible first. |

## Just the decision

```ts
const { decision, policy, feedback, receiptId } = await aw.checkAction({
  actionType: "file_access",
  tool: "filesystem",
  target: ".env",
  description: "Read environment secrets.",
});
// decision: "block"  policy: "block-secret-file-access"
```

`checkAction` never creates a run. Use it when you want the verdict and will
enforce it yourself.

## The full lifecycle

`executeAction` creates a run and drives it: approval gates, sandbox routing,
restore points, and reporting the result back.

```ts
const { run, handoff, timedOut } = await aw.executeAction(
  { actionType: "deploy_action", target: "production", description: "Ship it." },
  {
    onApprovalRequired: ({ handoff }) => {
      console.log("Approve at:", handoff?.approvalUrl);
    },
    maxWaitMs: 5 * 60 * 1000,
  },
);
```

### The SDK cannot approve on your behalf

When a run is held, you get a **handoff** — an `approvalUrl` for a human and a
`statusUrl` to poll. It contains no credential, because the server does not
issue one to the principal whose action is being gated.

An earlier version returned a single-use approval token in the `executeAction`
response, to the agent that made the request. Two calls approved your own
deploy, and the trail recorded it as human approval. If the party being policed
can approve itself, the gate is decoration.

## Running the action locally

For decisions that hand execution back to you:

```ts
await aw.executeAction(action, {
  createRestorePoint: async (run) => { await snapshot(); },
  localRunner: async (run) => execSync(run.action.command!).toString(),
  serializeLocalResult: (stdout) => ({ stdout, exitCode: 0 }),
});
```

## Reliability

Every request has a timeout, bounded retries with full jitter, and honours
`Retry-After`. Retries apply to 408/425/429/5xx and network failures — never to
a 4xx that will not become valid on a second attempt.

```ts
const aw = new AgentWing({
  apiKey,
  timeoutMs: 15_000,   // per attempt
  maxRetries: 3,       // total attempts
});

// Per call, plus cancellation:
await aw.checkAction(action, { signal: controller.signal, timeoutMs: 2_000 });
```

Pass an `idempotencyKey` on a write so a retry replays the first response
instead of creating a second run.

## Errors

`AgentWingError` carries a stable `code`, the HTTP `status`, the server's
`requestId`, and `retryable`.

| code | meaning |
|---|---|
| `unauthorized` | Missing or invalid API key. |
| `rate_limited` | Too many requests. Honour `retryAfterSeconds`. |
| `plan_limit_reached` | The key has used its plan allowance. |
| `policy_store_unavailable` | Policies could not be read, so nothing was decided. Retry. |
| `blocked_action_cannot_execute` | A blocked run cannot report an execution result. |
| `run_not_awaiting_execution` | The run is not in a state where executing was authorised. |
| `timeout` / `network_error` / `cancelled` | Client-side. |

## Options

```ts
new AgentWing({
  apiKey,                                  // required
  baseUrl: "https://agentwing.gpmai.dev",  // self-hosting? point it here
  timeoutMs: 15_000,
  maxRetries: 3,
  fetch: myFetch,                          // custom fetch
});
```

## Licence

Apache-2.0
