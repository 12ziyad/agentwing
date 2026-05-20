"use client";

import { useState } from "react";
import type { AgentWingDecision, ProjectFiles } from "@/lib/types";
import { ChevronDown, FileJson2 } from "lucide-react";
import { FileExplorer } from "./FileExplorer";

type LeftSidebarProps = {
  files: ProjectFiles;
  selectedFile: string;
  onSelect: (path: string) => void;
  modifiedFiles: Set<string>;
  feedback: AgentWingDecision | undefined;
};

const DECISION_COLOR: Record<string, string> = {
  allowed:          "text-emerald-400 border-emerald-400/25 bg-emerald-400/10",
  blocked:          "text-red-400 border-red-400/25 bg-red-400/10",
  sandbox_required: "text-indigo-400 border-indigo-400/25 bg-indigo-400/10",
  needs_approval:   "text-yellow-400 border-yellow-400/25 bg-yellow-400/10",
};

export function LeftSidebar({ files, selectedFile, onSelect, modifiedFiles, feedback }: LeftSidebarProps) {
  const [jsonOpen, setJsonOpen] = useState(false);

  return (
    <div className="flex flex-col h-full bg-[#0c0f1a] overflow-hidden">
      {/* File Explorer fills available space */}
      <div className="flex-1 min-h-0 overflow-hidden">
        <FileExplorer
          files={files}
          selectedFile={selectedFile}
          onSelect={onSelect}
          modifiedFiles={modifiedFiles}
        />
      </div>

      {/* Collapsible AgentWing Last Decision */}
      <div className="flex-none border-t border-white/[0.07]">
        {/* Toggle header */}
        <button
          onClick={() => setJsonOpen((v) => !v)}
          className="flex w-full items-center justify-between px-3 py-2 text-left hover:bg-white/[0.03] transition"
        >
          <div className="flex items-center gap-1.5">
            <FileJson2 size={11} className="text-cyan-500/70" />
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
              Last Decision
            </span>
            {feedback && (
              <span
                className={`rounded border px-1.5 py-px text-[9px] font-bold uppercase ${
                  DECISION_COLOR[feedback.decision] ?? "text-slate-400 border-white/10 bg-white/[0.04]"
                }`}
              >
                {feedback.decision}
              </span>
            )}
          </div>
          <ChevronDown
            size={11}
            className={`shrink-0 text-slate-600 transition-transform ${jsonOpen ? "rotate-180" : ""}`}
          />
        </button>

        {/* JSON content */}
        {jsonOpen && (
          <div className="px-2.5 pb-2.5">
            <pre className="max-h-[180px] overflow-auto rounded-lg border border-white/[0.07] bg-black/40 p-2.5 font-mono text-[9.5px] leading-[1.65] text-cyan-200/80">
              {feedback
                ? JSON.stringify(feedback, null, 2)
                : JSON.stringify({ decision: "pending", reason: "Run the agent to see policy feedback." }, null, 2)}
            </pre>
          </div>
        )}
      </div>
    </div>
  );
}
