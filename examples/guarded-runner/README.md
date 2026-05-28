# AgentWing Guarded Runner Example

This example uses `/api/v1/execute-action` to create full action runs instead of only checking decisions.

Expected demo path:

1. `package.json` read -> `allow` -> `execution_skipped` by hosted AgentWing, then optional explicit local read
2. `.env` read -> `block` / `blocked`
3. `npm install lodash` -> `sandbox_required` -> E2B execution if connected, otherwise `waiting_sandbox`
4. `deploy_action` -> `waiting_approval`, then `external_runner_required` after approval
5. external email -> `waiting_approval`
6. `src/auth.ts` write -> `restore_point_required`
7. `wrangler.toml` config change -> `restore_point_required`
8. database SELECT -> `allow` / `execution_skipped`
9. database UPDATE -> `approval_required`

No shell command is executed locally unless you explicitly pass a local runner callback.

```powershell
cd C:\Users\ziyad\agentwing-live-lab\examples\guarded-runner
copy ..\real-agent\.env.example .env
notepad .env
node guarded-runner.mjs
```
