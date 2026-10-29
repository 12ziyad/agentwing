# AgentWing — Design Notes

## What this is

AgentWing is a runtime control layer for AI agents. An agent describes the
action it is about to take; AgentWing answers with one of five decisions and
writes a receipt. The hosted service is a Next.js app on Cloudflare Workers
(OpenNext) with D1 for storage.

## Where things live

| Area | Path |
|---|---|
| Decision engine (pure, no I/O) | `src/lib/agentwingPolicy.ts` |
| Action and decision types | `src/lib/agentwingTypes.ts` |
| Next-step sentence per decision (pure) | `src/lib/nextStep.ts` |
| Managed run lifecycle | `src/lib/actionRunLifecycle.ts` |
| Storage, tenancy, usage | `src/lib/agentwingStore.ts`, `src/lib/cloudflareD1.ts` |
| Plan quotas | `src/lib/rateLimit.ts` |
| Roles and capabilities | `src/lib/rbac.ts` |
| Receipt chain | `src/lib/receiptChain.ts`, `src/lib/receiptChainStore.ts` |
| Webhooks and idempotency | `src/lib/webhookStore.ts`, `src/lib/idempotency.ts`, `workers/jobs` |
| Remote MCP server | `src/app/api/mcp`, `src/lib/mcp.ts` |
| Public API | `src/app/api/v1/*` |
| Packages | `packages/sdk`, `packages/hook`, `packages/receipt-verifier` |

## Decisions that shape the code

- **Default deny.** An action no rule classifies is `approval_required`, never `allow`.
- **Fail closed.** If custom policies cannot be loaded, the request is refused.
- **The engine is pure.** `evaluateAgentAction` has no I/O, which is what lets
  the public playground run it in the browser and lets the golden decision
  table in `tests/policy` pin its behaviour.
- **Public claims are computed or tested.** The landing-page ledger is computed
  from `src/lib/playgroundPresets.ts` at render time, and
  `tests/policy/playground.test.ts` pins each preset's decision. A policy change
  that alters what visitors see fails CI.

## Public pages

- `/` — landing page with the computed ledger and an embedded playground.
- `/playground` — the full playground. Default policies only; nothing is sent.
- `/pricing` — free during the beta. Pro and Team are shown as planned plans;
  nothing on the site takes payment yet.

## Known gaps

- Quotas are lifetime counters per API key. Paid plans will need monthly
  limits per workspace.
- The sandbox-secret encryption key is not versioned or rotated yet
  (`TODO` in `agentwingStore.ts`).
- The packages are not published to npm yet; the open-source page links to
  their source.
