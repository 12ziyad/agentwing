"use client";

import { useEffect, useRef, useState, type Dispatch, type RefObject } from "react";
import type { DemoEvent, DemoState, RestorePoint, Transaction } from "@/lib/demoTypes";
import { AgentWingConsole } from "./AgentWingConsole";
import { RestorePoints } from "./RestorePoints";
import { Summary } from "./Summary";

type StageProps = {
  state: DemoState;
  dispatch: Dispatch<DemoEvent>;
  connectionLost: boolean;
  onBackToLanding: () => void;
};

type StatusTone = "cyan" | "green" | "red" | "amber" | "muted";

const PROJECT_FILES = [
  { path: ".env", state: "blocked" },
  { path: ".env.example", state: "safe" },
  { path: "src/boxArenaConfig.ts", state: "edited" },
  { path: "test/boxArenaConfig.test.ts", state: "verified" },
  { path: "package.json", state: "clean" },
];

function hasTx(transactions: Transaction[], id: string) {
  return transactions.some((tx) => tx.id === id);
}

function hasTerminal(transactions: Transaction[], needle: string) {
  return transactions.some((tx) =>
    tx.terminalLines.some((line) => line.toLowerCase().includes(needle.toLowerCase())),
  );
}

function normalizeTerminalLine(line: string) {
  return line
    .replace("[TX-003] Applying controlled write", "[MINI AGENT] proposes edit src/boxArenaConfig.ts")
    .replace("Capturing Restore Point: ", "Capturing Restore Point ")
    .replace("Running npm test", "npm test")
    .replace("[TX-004] Syncing 7 files to E2B sandbox", "[TX-004] Syncing 7 files to E2B")
    .replace("[TX-003]", "[AGENTWING]")
    .replace("[TX-004] Syncing", "[E2B] Syncing")
    .replace("[TX-004] npm test", "[E2B] npm test")
    .replace("[TX-004] ", "")
    .replace("login.test.js passed", "boxArenaConfig.test.js passed")
    .replace("snakeConfig.test.js passed", "boxArenaConfig.test.js passed")
    .replace("auth.test.js passed", "authPolicy.test.js passed");
}

function buildTerminalLines(state: DemoState, userLines: string[]) {
  const hiddenFragments = [
    "agentwing@sandbox",
    "Proposed action",
    "Policy matched",
    "Capturing stdout",
    "Returning sandbox output",
    "Feedback Contract sent",
  ];
  const txLines = state.transactions.flatMap((tx) =>
    tx.terminalLines
      .filter((line) => !hiddenFragments.some((fragment) => line.includes(fragment)))
      .map(normalizeTerminalLine),
  );
  const derivedLines = [
    hasTx(state.transactions, "TX-005") ? "[AGENTWING] Force push blocked before shell execution" : null,
    hasTx(state.transactions, "TX-006") ? "[AGENTWING] Deploy held for approval" : null,
  ].filter(Boolean) as string[];
  const rollbackLines = state.rollbackLines.map((line) =>
    line
      .replace("Restoring preview state", "Preview state restored")
      .replace(": rollback_applied", ""),
  );
  return [...txLines, ...derivedLines, ...userLines, ...rollbackLines];
}

function buildInfraLogs(state: DemoState, userLines: string[]) {
  const logs: string[] = [];
  if (hasTx(state.transactions, "TX-001")) {
    const tx = state.transactions.find((item) => item.id === "TX-001");
    logs.push(
      "[MINI AGENT] proposes read .env",
      `[AGENTWING] Policy matched: ${tx?.policy ?? "block-secret-file-access"}`,
      "[AGENTWING] Blocked before file access",
      `[AGENTWING] Feedback returned: ${tx?.feedback ?? "use .env.example"}`,
      "[MINI AGENT] re-planning with .env.example",
    );
  }
  if (hasTx(state.transactions, "TX-003")) {
    logs.push(
      "[MINI AGENT] proposes edit src/boxArenaConfig.ts",
      "[AGENTWING] Capturing Restore Point RP-002",
      "[AGENTWING] Files captured: 7",
      "[AGENTWING] Restore Point locked",
    );
  }
  if (hasTerminal(state.transactions, "Transaction committed")) {
    logs.push("[AGENTWING] Controlled write committed");
  }
  if (hasTx(state.transactions, "TX-004")) {
    logs.push("[E2B] Syncing 7 files to E2B", "[E2B] npm test");
  }
  if (hasTerminal(state.transactions, "passed")) {
    logs.push("[PASS] boxArenaConfig.test.ts passed", "[PASS] authPolicy.test.ts passed");
  }
  if (hasTx(state.transactions, "TX-005")) {
    const tx = state.transactions.find((item) => item.id === "TX-005");
    logs.push(
      "[MINI AGENT] proposes git push --force origin main",
      `[AGENTWING] Policy matched: ${tx?.policy ?? "block-force-push"}`,
      "[AGENTWING] Blocked before shell execution",
      `[AGENTWING] Feedback returned: ${tx?.feedback ?? "create safe feature branch"}`,
    );
  }
  if (hasTx(state.transactions, "TX-006")) {
    const tx = state.transactions.find((item) => item.id === "TX-006");
    logs.push(
      "[MINI AGENT] proposes POST /deploy/staging",
      `[AGENTWING] Policy matched: ${tx?.policy ?? "approval-deploy-action"}`,
      "[AGENTWING] Deploy held for human approval",
    );
  }
  if (state.transactions.some((tx) => tx.approvalState === "approved")) {
    logs.push("[AGENTWING] Audit receipt sealed");
  }
  return [...logs, ...userLines, ...state.rollbackLines];
}

function buildLiveFeed(state: DemoState) {
  const items: string[] = [];
  if (hasTx(state.transactions, "TX-001")) {
    items.push("TX-001 blocked .env", "-> feedback sent to Mini Code Agent");
  }
  if (hasTx(state.transactions, "TX-002")) {
    items.push("TX-002 safe config read", "-> .env.example approved");
  }
  if (hasTx(state.transactions, "TX-003")) {
    items.push("TX-003 Restore Point captured", "-> rollback available");
  }
  if (hasTx(state.transactions, "TX-004")) {
    items.push("TX-004 E2B tests passed", "-> safe to continue");
  }
  if (hasTx(state.transactions, "TX-005")) {
    items.push("TX-005 force push blocked", "-> redirected to safe branch");
  }
  if (hasTx(state.transactions, "TX-006")) {
    items.push("TX-006 deploy held", "-> approval required, audit recorded");
  }
  if (state.rollback !== "idle") {
    items.push("ROLLBACK Restore Point applied", "-> preview and diff rewound");
  }
  return items;
}

function buildRollbackHandler(
  restorePoints: RestorePoint[],
  rollback: DemoState["rollback"],
  dispatch: Dispatch<DemoEvent>,
): (() => void) | null {
  if (rollback !== "idle") return null;
  const currentIdx = restorePoints.findIndex((p) => p.current);
  const target = currentIdx > 0 ? restorePoints[currentIdx - 1] : null;
  if (!target) return null;
  return () => {
    dispatch({ type: "rollback_start", restore_point_id: target.id });
    const lines = [
      `[ROLLBACK] Rewinding to ${target.id}`,
      "[ROLLBACK] boxArenaConfig.ts restored",
      "[ROLLBACK] Preview state restored",
      "[ROLLBACK] Audit event added",
    ];
    lines.forEach((text, i) =>
      setTimeout(() => dispatch({ type: "rollback_line", text }), (i + 1) * 380),
    );
    setTimeout(
      () => dispatch({ type: "rollback_complete", restore_point_id: target.id }),
      lines.length * 380 + 420,
    );
  };
}

function StatusDot({ tone }: { tone: StatusTone }) {
  const cls = {
    cyan: "bg-cyan-300",
    green: "bg-emerald-400",
    red: "bg-red-400",
    amber: "bg-amber-300",
    muted: "bg-slate-600",
  }[tone];

  return <span className={`size-1.5 rounded-full ${cls}`} />;
}

function PanelHeader({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div className="flex h-9 items-center justify-between border-b border-white/[0.08] px-3">
      <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-300">
        {title}
      </p>
      {subtitle ? <p className="truncate pl-3 text-[10px] text-slate-400">{subtitle}</p> : null}
    </div>
  );
}

function TaskBar() {
  const [task, setTask] = useState("Add an extra box, run tests, and prepare staging deploy");

  return (
    <section className="rounded-lg border border-white/[0.08] bg-[#080b12] p-3">
      <div className="mb-2 flex items-center justify-between gap-3">
        <label htmlFor="runtime-task" className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-300">
          Tell the mini agent what to do
        </label>
        <span className="text-[10px] text-slate-400">same prompt replayed with controls</span>
      </div>
      <input
        id="runtime-task"
        value={task}
        onChange={(event) => setTask(event.target.value)}
        className="h-9 w-full rounded border border-white/[0.08] bg-[#05070d] px-3 font-mono text-[12px] text-slate-100 outline-none focus:border-cyan-400/30"
      />
    </section>
  );
}

function MiniPreview({ state }: { state: DemoState }) {
  const rolledBack = state.rollback === "complete" || state.rollback === "rolling";
  const authSafe = hasTx(state.transactions, "TX-002") && !rolledBack;
  const testsPassed = hasTerminal(state.transactions, "passed") && !rolledBack;
  const deployHeld = hasTx(state.transactions, "TX-006");
  const controlled = authSafe && testsPassed && deployHeld && !rolledBack;
  const showWithout = state.transactions.length === 0;
  const boxEdited = hasTerminal(state.transactions, "Transaction committed") && !rolledBack;

  const rows = showWithout
    ? [
        ["Boxes", "1", "amber"],
        ["Animation", "Off", "muted"],
        ["Score Badge", "Basic", "muted"],
        ["Risk", "Uncontrolled", "red"],
      ]
    : rolledBack
      ? [
          ["Boxes", "1", "amber"],
          ["Animation", "Restored", "amber"],
          ["Score Badge", "Basic", "amber"],
          ["Risk", "Restored", "amber"],
        ]
      : [
          ["Boxes", boxEdited ? "3" : "1", boxEdited ? "green" : "amber"],
          ["Animation", boxEdited ? "Fast" : "Normal", boxEdited ? "green" : "muted"],
          ["Score Badge", boxEdited ? "Added" : "Basic", boxEdited ? "green" : "muted"],
          ["Risk", controlled ? "Controlled" : boxEdited ? "Guarded" : "Uncontrolled", controlled ? "green" : "amber"],
        ];

  return (
    <section className="min-h-0 overflow-hidden rounded-lg border border-white/[0.08] bg-[#080b12]">
      <PanelHeader title="Live Preview" subtitle="Box Arena" />
      <div className="h-full p-3">
        <div className="h-full rounded-md border border-white/[0.08] bg-[#0d111a] p-4">
          <div className="mb-4 flex items-start justify-between gap-3">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                Editable app
              </p>
              <h2 className="mt-1 text-xl font-semibold tracking-tight text-white">
                Box Arena
              </h2>
              <p className="mt-1 text-xs text-slate-400">
                Visual app state edited by the Mini Code Agent.
              </p>
            </div>
            <span
              className={`rounded border px-2 py-1 text-[10px] font-semibold uppercase ${
                controlled
                  ? "border-emerald-400/25 bg-emerald-400/10 text-emerald-300"
                  : showWithout
                    ? "border-red-400/25 bg-red-400/10 text-red-300"
                    : "border-amber-400/25 bg-amber-400/10 text-amber-200"
              }`}
            >
              {showWithout ? "unsafe" : rolledBack ? "restored" : controlled ? "controlled" : "running"}
            </span>
          </div>
          <div className="mb-3 rounded border border-white/[0.08] bg-[#05070d] p-3">
            <div className="grid grid-cols-8 gap-1">
              {Array.from({ length: 40 }).map((_, index) => {
                const boxOne = index === 10;
                const boxTwo = boxEdited && [25, 26].includes(index);
                const boxThree = boxEdited && index === 35;
                return (
                  <div
                    key={index}
                    className={`aspect-square rounded-sm border border-white/[0.04] ${
                      boxOne
                        ? "bg-cyan-300/75"
                        : boxTwo || boxThree
                          ? "bg-cyan-300/75"
                          : "bg-white/[0.035]"
                    }`}
                  />
                );
              })}
            </div>
            <div className="mt-3 flex items-center justify-between gap-2">
              <button className="rounded border border-white/[0.12] bg-white/[0.05] px-3 py-1.5 text-[11px] font-semibold text-slate-100">
                Start Game
              </button>
              <span className={`rounded border px-2 py-1 text-[10px] font-semibold ${
                boxEdited ? "border-emerald-400/25 bg-emerald-400/10 text-emerald-300" : "border-slate-500/25 bg-white/[0.03] text-slate-400"
              }`}>
                {boxEdited ? "Score badge added" : "Basic score"}
              </span>
            </div>
          </div>

          <div className="grid gap-2 sm:grid-cols-2">
            {rows.map(([label, value, tone]) => (
              <div key={label} className="rounded border border-white/[0.08] bg-[#05070d] px-3 py-3 transition-colors duration-500">
                <div className="mb-2 flex items-center gap-2 text-[10px] uppercase tracking-[0.12em] text-slate-400">
                  <StatusDot tone={tone as StatusTone} />
                  {label}
                </div>
                <p className="text-sm font-medium text-slate-100">{value}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

function CodeDiff({ state }: { state: DemoState }) {
  const writeApplied = hasTerminal(state.transactions, "Transaction committed");
  const rolledBack = state.rollback === "complete";
  const rolling = state.rollback === "rolling";
  const rollbackProgress = state.rollbackLines.length;
  const active = writeApplied && !rolledBack;
  const showDiff = writeApplied || rolling || rolledBack;

  return (
    <section className="flex min-h-0 flex-col overflow-hidden rounded-lg border border-white/[0.08] bg-[#080b12]">
      <PanelHeader
        title="Code Diff / Editor"
        subtitle={rolledBack ? "src/boxArenaConfig.ts restored to RP-002" : rolling ? "rewinding src/boxArenaConfig.ts" : "src/boxArenaConfig.ts"}
      />
      <div className="border-b border-white/[0.08] bg-[#0c1019] px-3 py-2 font-mono text-[11px] text-slate-400">
        src/boxArenaConfig.ts
      </div>
      {!showDiff ? (
        <div className="min-h-0 flex-1 overflow-auto p-4">
          <div className="rounded border border-white/[0.08] bg-[#05070d] px-3 py-4">
            <p className="text-sm text-slate-200">No code changes yet.</p>
            <p className="mt-1 text-[12px] text-slate-400">
              Mini Code Agent has not edited src/boxArenaConfig.ts.
            </p>
          </div>
        </div>
      ) : (
      <div className="min-h-0 flex-1 overflow-auto font-mono text-[12px] leading-6">
        <div className="grid grid-cols-[3rem_1fr] px-3 py-1 text-slate-500">
          <span>04</span>
          <code>export const boxArenaConfig = {"{"}</code>
        </div>
        {[
          ...(rolledBack || (rolling && rollbackProgress >= 2)
            ? [
                { marker: "-", text: 'boxes: [{ id: "box-1" }, { id: "box-2" }, { id: "box-3" }],', cls: "bg-red-400/10 text-red-200" },
                { marker: "+", text: 'boxes: [{ id: "box-1" }],', cls: "bg-amber-400/10 text-amber-200" },
                { marker: "-", text: 'animation: "fast",', cls: "bg-red-400/10 text-red-200" },
                { marker: "+", text: 'animation: "normal",', cls: "bg-amber-400/10 text-amber-200" },
                { marker: "-", text: "scoreBadge: true,", cls: "bg-red-400/10 text-red-200" },
                { marker: "+", text: "scoreBadge: false,", cls: "bg-amber-400/10 text-amber-200" },
              ]
            : [
                { marker: "-", text: 'boxes: [{ id: "box-1" }],', cls: "bg-red-400/10 text-red-200" },
                { marker: "+", text: 'boxes: [{ id: "box-1" }, { id: "box-2" }, { id: "box-3" }],', cls: active || rolling ? "bg-emerald-400/10 text-emerald-200" : "bg-white/[0.02] text-slate-500" },
                { marker: "-", text: 'animation: "normal",', cls: "bg-red-400/10 text-red-200" },
                { marker: "+", text: 'animation: "fast",', cls: active || rolling ? "bg-emerald-400/10 text-emerald-200" : "bg-white/[0.02] text-slate-500" },
                { marker: "-", text: "scoreBadge: false,", cls: "bg-red-400/10 text-red-200" },
                { marker: "+", text: "scoreBadge: true,", cls: active || rolling ? "bg-emerald-400/10 text-emerald-200" : "bg-white/[0.02] text-slate-500" },
              ]),
        ].map((row) => (
          <div
            key={`${row.marker}-${row.text}-${row.cls}`}
            className={`grid grid-cols-[3rem_1fr] px-3 py-1 transition-all duration-500 ${row.cls}`}
          >
            <span className="select-none text-slate-500">{row.marker}</span>
            <code>{row.text}</code>
          </div>
        ))}
        <div className="grid grid-cols-[3rem_1fr] px-3 py-1 text-slate-500">
          <span>08</span>
          <code>{"}"}</code>
        </div>
      </div>
      )}
    </section>
  );
}

function Terminal({ infraLines, feedLines }: { infraLines: string[]; feedLines: string[] }) {
  const infraRef = useRef<HTMLDivElement>(null);
  const feedRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (infraRef.current) infraRef.current.scrollTop = infraRef.current.scrollHeight;
  }, [infraLines.length]);

  useEffect(() => {
    if (feedRef.current) feedRef.current.scrollTop = feedRef.current.scrollHeight;
  }, [feedLines.length]);

  return (
    <section className="flex min-h-0 flex-col overflow-hidden rounded-lg border border-white/[0.1] bg-[#03050a]">
      <div className="flex h-9 items-center justify-between border-b border-white/[0.08] bg-[#080b12] px-3">
        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-300">
          Terminal <span className="text-slate-400">- Mini Code Agent / AgentWing / E2B</span>
        </p>
        <span className="text-[10px] text-cyan-200">streaming</span>
      </div>
      <div className="grid min-h-[270px] flex-1 grid-cols-1 gap-0 overflow-hidden lg:grid-cols-[1.15fr_0.85fr]">
        <TerminalPane title="Terminal - Infra Logs" lines={infraLines} paneRef={infraRef} />
        <TerminalPane title="AgentWing Live Feed" lines={feedLines} paneRef={feedRef} compact />
      </div>
    </section>
  );
}

function TerminalPane({
  title,
  lines,
  paneRef,
  compact,
}: {
  title: string;
  lines: string[];
  paneRef: RefObject<HTMLDivElement | null>;
  compact?: boolean;
}) {
  return (
    <div className="min-h-0 border-t border-white/[0.06] lg:border-l lg:border-t-0 lg:first:border-l-0">
      <div className="border-b border-white/[0.06] bg-white/[0.025] px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-300">
        {title}
      </div>
      <div ref={paneRef} className="h-full max-h-[320px] overflow-auto px-3 py-2 font-mono text-[12px] leading-6">
        {lines.length === 0 ? (
          <p className="text-slate-500">Waiting for controlled actions...</p>
        ) : (
          lines.map((line, index) => {
            const active = index === lines.length - 1;
            return (
              <p
                key={`${line}-${index}`}
                className={`term-line rounded px-1 ${
                  active ? "bg-cyan-400/[0.05]" : ""
                } ${
                  line.includes("passed") || line.includes("approved")
                    ? "text-emerald-300"
                    : line.includes("ROLLBACK") || line.includes("Restore Point") || line.includes("approval")
                      ? "text-amber-200"
                      : line.includes("blocked") || line.includes("held") || line.includes("feedback")
                        ? "text-cyan-100"
                        : line.startsWith("[USER]") || line.startsWith("[AGENTWING] Policy")
                          ? "text-slate-100"
                          : compact
                            ? "text-slate-200"
                            : "text-slate-300"
                }`}
              >
                {line}
              </p>
            );
          })
        )}
        <span className="ml-1 inline-block h-4 w-1.5 translate-y-0.5 bg-cyan-300 cursor-blink" />
      </div>
    </div>
  );
}

function FileTree({ state }: { state: DemoState }) {
  const rolledBack = state.rollback === "complete" || state.rollback === "rolling";
  const authEdited = hasTerminal(state.transactions, "Transaction committed") && !rolledBack;

  return (
    <section className="rounded-lg border border-white/[0.08] bg-[#080b12]">
      <PanelHeader title="Files" subtitle="runtime workspace" />
      <div className="space-y-1 p-2">
        {PROJECT_FILES.map((file) => {
          const modified = file.path === "src/boxArenaConfig.ts" && authEdited;
          const blocked = file.path === ".env";
          return (
            <div
              key={file.path}
              className={`flex items-center justify-between rounded px-2 py-1.5 text-[12px] ${
                modified
                  ? "border border-amber-400/20 bg-amber-400/[0.06] text-amber-100"
                  : blocked
                    ? "text-red-300/80"
                    : "text-slate-400"
              }`}
            >
              <span className="truncate font-mono">{file.path}</span>
              <span className="ml-2 text-[9px] uppercase text-slate-400">
                {modified ? "mod" : blocked ? "blocked" : file.state}
              </span>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function RuntimeStatusBar({ state }: { state: DemoState }) {
  const blocked = state.transactions.filter((tx) => tx.status === "blocked").length;
  const sandboxed = state.transactions.filter((tx) => tx.status === "sandboxed").length;
  const replans = state.planLines.filter((line) => line.isReplacement).length;

  return (
    <footer className="flex h-7 items-center gap-3 overflow-hidden border-t border-white/[0.08] bg-[#080b12] px-3 font-mono text-[10px] text-slate-500">
      <span>transactions {state.transactions.length}</span>
      <span className="text-red-300">blocked {blocked}</span>
      <span className="text-cyan-200">sandboxed {sandboxed}</span>
      <span className="text-amber-200">restore points {state.restorePoints.length}</span>
      <span className="text-slate-400">replans {replans}</span>
      <span className="ml-auto truncate text-slate-600">{state.phaseLabel}</span>
    </footer>
  );
}

export function Stage({ state, dispatch, connectionLost, onBackToLanding }: StageProps) {
  const [userTerminalLines, setUserTerminalLines] = useState<string[]>([]);
  const progressPct = state.totalPhases > 0 ? (state.phase / state.totalPhases) * 100 : 0;
  const terminalLines = buildTerminalLines(state, userTerminalLines);
  const infraLines = buildInfraLogs(state, userTerminalLines);
  const feedLines = buildLiveFeed(state);
  const rollbackHandler = buildRollbackHandler(state.restorePoints, state.rollback, dispatch);

  function handleUserTerminalLine(line: string) {
    setUserTerminalLines((prev) => [
      ...prev,
      `[USER] ${line}`,
      "[AGENTWING] Policy updated: block deploy until tests pass",
    ]);
  }

  return (
    <div className="flex min-h-screen flex-col bg-[#05070d] text-slate-100">
      <header className="sticky top-0 z-20 border-b border-white/[0.08] bg-[#05070d]/95 backdrop-blur">
        <div className="flex h-12 items-center gap-3 px-4">
          <button
            type="button"
            onClick={onBackToLanding}
            className="rounded border border-white/[0.1] bg-white/[0.035] px-2 py-1 text-[10.5px] text-slate-300 transition hover:border-cyan-400/25 hover:text-white"
          >
            &larr; Back to landing
          </button>
          <span className="hidden text-[10.5px] text-slate-500 sm:inline">|</span>
          <span className="text-sm font-semibold text-white">AgentWing Runtime Lab</span>
          <span className="hidden text-[10.5px] text-slate-500 sm:inline">|</span>
          <span className="hidden items-center gap-1.5 text-[11px] text-cyan-200 sm:inline-flex">
            <StatusDot tone="cyan" />
            Agent active
          </span>
          <span className="hidden items-center gap-1.5 text-[11px] text-slate-400 md:inline-flex">
            <StatusDot tone="green" />
            E2B active
          </span>
          <span className="hidden text-[11px] text-slate-500 md:inline">5 policies loaded</span>
          <span className="ml-auto rounded border border-white/[0.08] bg-white/[0.03] px-2 py-1 text-[10.5px] text-slate-300">
            Test run
          </span>
          <span className="rounded border border-white/[0.08] bg-white/[0.03] px-2 py-1 text-[10.5px] text-slate-500">
            {state.mode === "live" ? "Live stream" : "Replay mode"}
          </span>
        </div>
        <div className="h-0.5 bg-white/[0.04]">
          <div
            className="h-full bg-cyan-300 transition-all duration-700"
            style={{ width: `${progressPct}%` }}
          />
        </div>
      </header>

      {connectionLost && (
        <div className="fixed right-4 top-14 z-50 rounded border border-amber-400/25 bg-[#1a1204] px-3 py-2 text-[11px] text-amber-200">
          Connection lost. Replay mode active.
        </div>
      )}

      <main className="grid h-[calc(100vh-56px)] min-h-[720px] flex-none gap-3 overflow-hidden p-3 xl:grid-cols-[250px_minmax(560px,1fr)_390px]">
        <aside className="grid min-h-0 content-start overflow-hidden gap-3 xl:grid-rows-[auto_auto]">
          <FileTree state={state} />
          <RestorePoints
            points={state.restorePoints}
            rollback={state.rollback}
            dispatch={dispatch}
          />
        </aside>

        <section className="grid min-h-0 gap-3 overflow-hidden xl:grid-rows-[auto_360px_minmax(270px,1fr)]">
          <TaskBar />
          <div className="grid min-h-0 gap-3 lg:grid-cols-[1.18fr_0.82fr]">
            <MiniPreview state={state} />
            <CodeDiff state={state} />
          </div>
          <Terminal infraLines={infraLines.length ? infraLines : terminalLines} feedLines={feedLines} />
        </section>

        <aside className="min-h-0 overflow-hidden">
          <AgentWingConsole
            state={state}
            dispatch={dispatch}
            onUserTerminalLine={handleUserTerminalLine}
          />
        </aside>
      </main>

      {state.summary && (
        <div className="border-t border-white/[0.08] px-3 pb-6 pt-3">
          <Summary
            summary={state.summary}
            transactions={state.transactions}
            onRollback={rollbackHandler}
          />
        </div>
      )}

      <RuntimeStatusBar state={state} />
    </div>
  );
}
