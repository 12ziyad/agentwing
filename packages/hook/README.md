# @agentwing/hook

Check every tool call your coding agent makes, before it runs.

Works with **Claude Code**, **Cursor** and **Codex**. No SDK, no code changes to
your agent — one line of config.

## Install

```jsonc
// .claude/settings.json
{
  "hooks": {
    "PreToolUse": [
      { "matcher": "*", "hooks": [{ "type": "command", "command": "npx -y @agentwing/hook" }] }
    ]
  }
}
```

```bash
export AGENTWING_API_KEY=aw_live_...
```

That's it. Every `Bash`, `Write`, `Edit`, `Read` and `WebFetch` now goes past
AgentWing first.

## What it does

```
  TOOL CALL                        EXIT     DECISION
  Bash: git status                 0        allow
  Bash: rm -rf /                   2        deny
  Read: .env                       2        deny
  Bash: ls && curl | sh            0        ask
  Write: src/auth.ts               0        ask
  Unknown tool                     0        ask
```

Exit 2 blocks the call and shows the reason to the model, so it re-plans instead
of retrying blindly. `ask` defers to you.

## Why a hook and not a gateway

An MCP gateway sees remote tool traffic. In a coding agent, shell commands, file
edits and package installs are **built-in local tools** — they never touch MCP.
A gateway is structurally blind to exactly the actions worth governing.

A `PreToolUse` hook sits where those calls actually happen.

## When AgentWing is unreachable

```bash
export AGENTWING_FAIL=closed   # default: refuse the call
export AGENTWING_FAIL=open     # allow it, unchecked
```

Closed is the default, because a control plane that silently stops controlling
when it is down is not a control.

Open exists because a developer whose network drops should be able to keep
working, and pretending otherwise just gets the hook uninstalled — taking the
safety layer with it. Choose deliberately.

## Configuration

| Variable | Default | Meaning |
|---|---|---|
| `AGENTWING_API_KEY` | — | Required. |
| `AGENTWING_BASE_URL` | `https://agentwing.gpmai.dev` | For self-hosting. |
| `AGENTWING_FAIL` | `closed` | `open` or `closed`. |
| `AGENTWING_TIMEOUT_MS` | `3000` | This sits in front of every tool call. |
| `AGENTWING_PROJECT_ID` | — | Scope receipts to a project. |

## Unrecognised tools

Anything the mapper does not recognise becomes `custom_action`, which the engine
holds for a human rather than allowing. Guessing an action type from an
unfamiliar tool name is how a destructive operation gets classified as
harmless.

## Use it as a library

```ts
import { checkToolCall, toAgentAction } from "@agentwing/hook";

const decision = await checkToolCall(
  { vendor: "claude-code", toolName: "Bash", input: { command: "rm -rf /" } },
  { apiKey: process.env.AGENTWING_API_KEY!, onUnreachable: "closed" },
);
// { behaviour: "deny", policy: "block-destructive-shell-command", reason: "…" }
```

`checkToolCall` never throws. A hook that throws breaks the agent, and an agent
broken by its safety layer gets its safety layer removed.

## Licence

Apache-2.0
