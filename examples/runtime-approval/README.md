# AgentWing Runtime Approval Example

This terminal example creates an `approval_required` run with:

```json
"runtime": {
  "surface": "cli",
  "interactiveApproval": true,
  "runnerId": "terminal-demo-runner"
}
```

AgentWing returns a one-time runner approval token. The API key creates the run, but the API key alone cannot approve it; the terminal decision uses the short-lived runner token.

```powershell
cd C:\Users\ziyad\agentwing-live-lab\examples\runtime-approval
copy ..\real-agent\.env.example .env
notepad .env
node runtime-approval-agent.mjs
```

Expected path:

1. `deploy_action` returns `approval_required` / `waiting_approval`.
2. The terminal asks `Approve? y/N`.
3. `y` calls `/api/v1/action-runs/:runId/runner-approve`.
4. `n` calls `/api/v1/action-runs/:runId/runner-reject`.
5. Approved deploys become `external_runner_required` unless a safe sandbox or explicit runner is configured.

No shell command or deploy operation is executed by this example.
