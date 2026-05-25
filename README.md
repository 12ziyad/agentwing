# AgentWing Live Agent Lab

Interactive Next.js prototype for demonstrating AgentWing as a runtime control layer between an autonomous coding agent and real execution systems.

The demo shows a controlled mini coding agent editing a small AgentOps dashboard UI while AgentWing evaluates every file and terminal action before execution. It includes a live preview, code viewer, diff viewer, timeline, feedback JSON, session summary, and E2B sandbox replay for `npm test`.

## Local Development

Create `.env.local` for Next.js local dev:

```bash
E2B_API_KEY=e2b_your_key_here
AGENTWING_SANDBOX_SECRET=dev-only-secret-for-local-byok-encryption
OPENAI_API_KEY=sk_your_key_here
OPENAI_MODEL=gpt-4.1-mini
DEMO_ACCESS_CODE=AGENTWING-BETA
```

The public demo opens directly to the dashboard. `OPENAI_API_KEY` is used only by `/api/agent/plan`; if OpenAI planning fails, the mini-agent falls back to deterministic UI rules. `E2B_API_KEY` is an optional server-level fallback. Customers normally paste their E2B BYOK key into the AgentWing dashboard once, then AgentWing uses that server-side key for `/api/v1/sandbox/run`.

Run locally:

```bash
npm install
npm run dev
```

Open `http://localhost:3000`.

## Demo Script

Use this task:

```text
Make the primary button bigger
```

Click `Run Agent`. Expected behavior:

- `src/App.jsx` and `src/styles.css` are read.
- `.primary-button` changes from `font-size: 14px` / `padding: 8px 12px` to `font-size: 18px` / `padding: 12px 20px`.
- The preview, code viewer, and diff update.
- `npm test` is replayed through `/api/v1/sandbox/run` in E2B.
- `.env` read and `git push --force origin main` are blocked.
- The agent replans to `.env.example` and `git checkout -b safe-ui-change`.

## Cloudflare Workers Deployment

This repo is configured for `@opennextjs/cloudflare` and Wrangler.

### D1 setup

AgentWing V1 stores projects, hashed API keys, usage, receipts, and sandbox config in Cloudflare D1 when the `AGENTWING_DB` binding is available. Local Next.js dev falls back to an in-memory store.

Create the D1 database:

```bash
wrangler d1 create agentwing_v1
```

Copy the returned `database_id` into `wrangler.jsonc` under the `AGENTWING_DB` binding:

```jsonc
"d1_databases": [
  {
    "binding": "AGENTWING_DB",
    "database_name": "agentwing_v1",
    "database_id": "your-d1-database-id"
  }
]
```

Apply migrations locally and remotely:

```bash
wrangler d1 migrations apply agentwing_v1 --local
wrangler d1 migrations apply agentwing_v1 --remote
```

The first API request with `Authorization: Bearer aw_live_demo_key` seeds the local demo API key and Beta usage row if they are missing. Generated keys use the shape `aw_live_<random_secure_token>`; D1 stores the key hash and only returns the full key once at creation time.

Create a project and generate a key:

```bash
# These management endpoints require an authenticated dashboard/admin session in production.
curl -X POST http://localhost:3000/api/v1/projects \
  -H "Content-Type: application/json" \
  -d "{\"name\":\"Production Coding Agent\"}"

curl -X POST http://localhost:3000/api/v1/api-keys \
  -H "Content-Type: application/json" \
  -d "{\"projectId\":\"proj_your_project_id\"}"
```

Preview in the Workers runtime:

```bash
cp .dev.vars.example .dev.vars
npm run preview:cf
```

Deploy to the existing Cloudflare Worker/app named `agentwing-live-lab`:

```bash
npm run deploy:cf
```

Required Cloudflare secrets:

```bash
wrangler secret put E2B_API_KEY
wrangler secret put AGENTWING_SANDBOX_SECRET
wrangler secret put OPENAI_API_KEY
wrangler secret put DEMO_ACCESS_CODE
```

The E2B key is read only by backend sandbox provider code. BYOK keys saved from the dashboard are encrypted with `AGENTWING_SANDBOX_SECRET` before being stored in D1 and are never returned to the frontend. `E2B_API_KEY` remains an optional backend fallback. The OpenAI key is read only in `src/app/api/agent/plan/route.ts` via `process.env.OPENAI_API_KEY`. There are no `NEXT_PUBLIC_` secret variables and no frontend access to either key.

### Local V1 sandbox checks

Run the app locally, save an E2B key from `/dashboard/sandboxes`, then test the V1 API:

```bash
curl -X POST http://localhost:3000/api/v1/sandbox/test-e2b

curl -X POST http://localhost:3000/api/v1/check-action \
  -H "Authorization: Bearer aw_live_demo_key" \
  -H "Content-Type: application/json" \
  -d "{\"projectId\":\"runtime-lab\",\"sessionId\":\"sandbox-check\",\"agentId\":\"test-agent\",\"actionType\":\"shell_command\",\"tool\":\"terminal\",\"target\":\"local project\",\"command\":\"npm test\",\"description\":\"Run tests\"}"

curl -X POST http://localhost:3000/api/v1/sandbox/run \
  -H "Authorization: Bearer aw_live_demo_key" \
  -H "Content-Type: application/json" \
  -d "{\"projectId\":\"runtime-lab\",\"sessionId\":\"e2b-real-test\",\"agentId\":\"test-agent\",\"provider\":\"e2b\",\"action\":{\"actionType\":\"shell_command\",\"tool\":\"terminal\",\"target\":\"e2b sandbox\",\"command\":\"node -e \\\"console.log('hello from AgentWing sandbox')\\\"\",\"description\":\"Run hello command in E2B sandbox\"}}"

curl http://localhost:3000/api/v1/usage \
  -H "Authorization: Bearer aw_live_demo_key"

curl http://localhost:3000/api/v1/receipts
```

## Scripts

- `npm run dev` - Next.js dev server.
- `npm run build` - Next.js production build.
- `npm run preview:cf` - Build and preview with OpenNext Cloudflare.
- `npm run deploy:cf` - Build and deploy with OpenNext Cloudflare.
- `npm run lint` - ESLint.
