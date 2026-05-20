"use client";

import { useEffect, useRef } from "react";
import { Terminal } from "lucide-react";

type TerminalStatus = "idle" | "connecting" | "running" | "passed" | "failed";

function deriveStatus(lines: string[], isRunning: boolean): TerminalStatus {
  if (lines.length === 0) return isRunning ? "connecting" : "idle";
  const all = lines.join(" ").toLowerCase();
  if (all.includes("passed") || all.includes("ok agentwing") || all.includes("ok primary")) return "passed";
  if (all.includes("failed") || all.includes("error")) return "failed";
  if (isRunning || all.includes("creating e2b") || all.includes("running npm")) return "running";
  return "idle";
}

const STATUS: Record<TerminalStatus, { label: string; dot: string; pill: string }> = {
  idle:       { label: "E2B connected",  dot: "bg-slate-500",                   pill: "border-slate-400/20 bg-slate-400/10 text-slate-400" },
  connecting: { label: "Connecting…",   dot: "bg-yellow-400 animate-pulse",    pill: "border-yellow-400/20 bg-yellow-400/10 text-yellow-300" },
  running:    { label: "Running",        dot: "bg-blue-400 animate-pulse",      pill: "border-blue-400/20 bg-blue-400/10 text-blue-300" },
  passed:     { label: "Tests passed",  dot: "bg-emerald-400",                 pill: "border-emerald-400/20 bg-emerald-400/10 text-emerald-300" },
  failed:     { label: "Tests failed",  dot: "bg-red-400",                     pill: "border-red-400/20 bg-red-400/10 text-red-300" },
};

function lineClass(line: string): string {
  if (line.startsWith("$ ")) return "text-slate-100";
  const l = line.toLowerCase();
  if (l.includes("error") || l.includes("failed")) return "text-red-300";
  if (l.includes("passed") || l.startsWith("ok ")) return "text-emerald-300";
  if (line.startsWith("[agent]")) return "text-indigo-300";
  if (line.startsWith("[") && line.includes("s]")) return "text-slate-500";
  return "text-slate-300";
}

function LineContent({ line }: { line: string }) {
  if (line.startsWith("$ ")) {
    return (
      <>
        <span className="text-indigo-400">agentwing@sandbox</span>
        <span className="text-slate-600">:~$ </span>
        <span className="text-white">{line.slice(2)}</span>
      </>
    );
  }
  return <>{line}</>;
}

export function SandboxTerminal({ lines, isRunning }: { lines: string[]; isRunning: boolean }) {
  const bodyRef = useRef<HTMLDivElement>(null);
  const status = deriveStatus(lines, isRunning);
  const sc = STATUS[status];

  useEffect(() => {
    if (bodyRef.current) {
      bodyRef.current.scrollTop = bodyRef.current.scrollHeight;
    }
  }, [lines.length]);

  return (
    <div className="flex-none flex flex-col border-t border-white/[0.07] bg-[#090c17]" style={{ height: "160px" }}>
      {/* Header */}
      <div className="flex-none flex items-center justify-between px-4 h-9 border-b border-white/[0.06]">
        <div className="flex items-center gap-2">
          <Terminal size={12} className="text-slate-500" />
          <span className="text-xs font-semibold text-slate-300">Sandbox Terminal</span>
          <span className="hidden text-[10px] text-slate-600 sm:block">
            Commands replayed in isolated E2B sandbox
          </span>
        </div>
        <div className={`flex items-center gap-1.5 rounded-full border px-2.5 py-[3px] text-[10px] font-semibold ${sc.pill}`}>
          <span className={`size-1.5 rounded-full ${sc.dot}`} />
          {sc.label}
        </div>
      </div>

      {/* Output */}
      <div
        ref={bodyRef}
        className="flex-1 overflow-y-auto px-4 py-2 font-mono text-[11.5px] leading-[1.75]"
      >
        {lines.length === 0 ? (
          <span className="italic text-slate-600">Waiting for agent command…</span>
        ) : (
          lines.map((line, i) => (
            <div key={i} className={lineClass(line)}>
              <LineContent line={line} />
            </div>
          ))
        )}
        {isRunning && (
          <span className="cursor-blink inline-block w-2 h-[1em] bg-emerald-400 ml-0.5 align-middle" />
        )}
      </div>
    </div>
  );
}
