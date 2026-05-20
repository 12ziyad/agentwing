# AgentWing Live Lab — Design Notes

## What this is

A side-by-side comparison demo showing what happens when the same AI agent runs the same task — once without AgentWing, once with it.

**Default task:** "Fix the failing login test and deploy to staging"

## Architecture decisions

### State management
`useReducer` with a single `DemoState` in `page.tsx`. No Zustand (not installed). The reducer (`src/lib/demoReducer.ts`) handles all 18 event types from the `DemoEvent` union.

### Animation
Pure CSS keyframes in `globals.css`. No framer-motion. Tailwind handles spacing and color; keyframes handle movement.

### WebSocket / replay fallback
`useDemoStream` tries `ws://localhost:8080/demo-stream` with a 1200ms timeout. If the connection fails or times out, it falls back to the local `REPLAY_SEQUENCE` in `src/lib/demoEvents.ts`. The replay uses `setTimeout` based on absolute `at` timestamps from demo start. A subtle badge shows "Replay demo" vs "Live demo".

### Pacing
- WITHOUT side: 6 incidents over ~6.5s — fast and alarming
- WITH side: 6 transactions over ~32s — deliberate, each with evidence
- Auto-approve for TX-006 fires at t=37s if user hasn't acted

### Rollback
The rollback is triggered from `RestorePoints` (user click) or `Summary` (button). Both use the same helper that schedules 4 rollback_line events then a rollback_complete. The `demoReducer` slices the restore points array to remove everything after the target.

### Fonts
Space Grotesk (body/headings) + JetBrains Mono (code/data) via `next/font/google`. CSS variables: `--font-space-grotesk`, `--font-jetbrains-mono`. Falls back to Geist / system fonts.

### No external UI libraries
Only Tailwind CSS + inline SVG. lucide-react is available for icons but not used in new components (uses inline SVG and emoji where needed).

## Component map

| Component | Role |
|---|---|
| `Hero` | Initial screen with CTA, config grid, proof badge |
| `Stage` | Main demo layout: progress strip + plan + 3 cols + restore + summary |
| `PlanDiff` | 5-line agent plan with live V1→V2 strike + insert |
| `WithoutPanel` | Left column: incident feed → freezes |
| `WithPanel` | Center column: stacked transaction cards |
| `TransactionCard` | Individual TX card with tool_call JSON, policy, feedback |
| `AgentWingConsole` | Right column: Wisp mascot + feedback contract + guide input |
| `Mascot` | Wisp — custom SVG creature with 6 CSS animation states |
| `FeedbackContract` | Shows full JSON for 3s then collapses to compact form |
| `TerminalBlock` | Terminal output inside a TX card (TX-003 restore, TX-004 sandbox) |
| `ApprovalBlock` | Approve/Deny buttons for TX-006 |
| `RestorePoints` | Horizontal dot timeline with rollback button |
| `Summary` | Post-run comparison cards + metrics + audit log |
| `GuideInput` | Console input for agent constraints (UI-state only) |

## Event protocol
See `src/lib/demoTypes.ts` for the full `DemoEvent` union. The protocol is identical whether events come from WebSocket or local replay.

## Known limitations
- The WebSocket server at `ws://localhost:8080/demo-stream` is not included. The demo runs fully on local replay by default.
- The Mascot SVG uses color props (not CSS `currentColor`) so hue-rotate filters aren't needed.
- "Replay run" and "Run again" both reload the page (simplest approach).
- The guide input only processes preset keywords locally; it is not connected to any real agent.
- Old prototype components under `src/components/` (AgentPanel, FileExplorer, etc.) are preserved but not imported from the new `page.tsx`.

## TODO
- Add 3 demo runs per IP/session for public abuse protection.
- Wire WebSocket server for live agent demos.
- Add keyboard shortcut (Space) to advance approval gate.
