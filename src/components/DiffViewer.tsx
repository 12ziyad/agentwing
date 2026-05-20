import type { LatestDiff } from "@/lib/types";
import { GitCompareArrows } from "lucide-react";

export function DiffViewer({ diff }: { diff?: LatestDiff }) {
  return (
    <section className="panel min-h-[285px]">
      <div className="panel-title">
        <GitCompareArrows size={16} />
        Diff Viewer
      </div>
      <div className="mt-4 overflow-hidden rounded-lg border border-white/10 bg-[#080b14]">
        <div className="border-b border-white/10 bg-white/[0.03] px-3 py-2 font-mono text-xs text-cyan-200">
          {diff?.path ?? "No edits yet"}
        </div>
        <pre className="max-h-[220px] overflow-auto py-2 text-xs leading-6">
          {diff ? (
            diff.lines.map((line, index) => {
              const prefix = line.type === "added" ? "+" : line.type === "removed" ? "-" : " ";
              const className =
                line.type === "added"
                  ? "bg-emerald-400/10 text-emerald-100"
                  : line.type === "removed"
                    ? "bg-red-400/10 text-red-100"
                    : "text-slate-400";
              return (
                <div key={`${line.type}-${index}`} className={`grid grid-cols-[2.5rem_1fr] px-3 ${className}`}>
                  <span className="select-none text-slate-600">{prefix}</span>
                  <code className="whitespace-pre font-mono">{line.value || " "}</code>
                </div>
              );
            })
          ) : (
            <div className="px-3 text-slate-500">Run the agent to produce a policy-checked edit.</div>
          )}
        </pre>
      </div>
    </section>
  );
}
