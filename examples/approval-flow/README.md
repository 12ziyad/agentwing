# Approval flow

Proposes a production deploy. AgentWing holds it, a human decides, the agent
continues or stops.

## Run it

```bash
npm install @agentwing/sdk
export AGENTWING_API_KEY=aw_live_...
node approval-flow.mjs
```

## What happens

1. The agent proposes a `deploy_action` targeting `production`.
2. AgentWing returns `approval_required` and parks the run at `waiting_approval`.
3. The response carries an **approval handoff** — where a human can approve, and
   a URL to poll. It carries **no credential**.
4. You approve or reject in the dashboard.
5. The SDK's poll sees the new status and the script reports the outcome.

## Why the agent isn't given a token

An earlier version of this API returned a single-use approval token in the
`execute-action` response — to the agent whose action was being gated. Two calls
were enough to approve your own deploy, and the audit trail recorded it as human
approval.

The approver has to be a different principal from the one being policed, or the
gate means nothing. So approval happens through a separately-authenticated
session, and the agent gets a URL and a status endpoint.

Terminal approval is still a reasonable thing to want. Doing it safely needs a
device credential the human registers out of band, so the CLI authenticates as
*them* rather than as the agent. That is a feature, not a flag.

## Exit codes

| Code | Meaning |
|---|---|
| `0` | Approved |
| `1` | Rejected, blocked, or an API error |
| `2` | Nobody decided within the wait window |
