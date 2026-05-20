import type { LatestDiff, ProjectFiles } from "@/lib/types";
import { Braces } from "lucide-react";

type CodeEditorProps = {
  files: ProjectFiles;
  selectedFile: string;
  latestDiff: LatestDiff | undefined;
  modifiedFiles: Set<string>;
};

export function CodeEditor({ files, selectedFile, latestDiff, modifiedFiles }: CodeEditorProps) {
  const hasDiff = latestDiff?.path === selectedFile;
  const isModified = modifiedFiles.has(selectedFile);

  const content =
    selectedFile === ".env"
      ? "/* AgentWing blocked direct secret reads.\n   Select .env.example for safe placeholders. */"
      : files[selectedFile] ?? "";

  return (
    <div className="flex flex-col h-full bg-[#0d1117] overflow-hidden">
      {/* Tab bar */}
      <div className="flex-none flex items-center gap-2.5 px-4 h-9 border-b border-white/[0.07] bg-[#0d1117]">
        <Braces size={12} className="shrink-0 text-cyan-400/70" />
        <span className="font-mono text-xs text-slate-300">{selectedFile}</span>
        {isModified && (
          <span className="rounded border border-amber-400/20 bg-amber-400/10 px-1.5 py-px text-[10px] font-semibold text-amber-300">
            Modified
          </span>
        )}
        {hasDiff ? (
          <span className="ml-auto flex items-center gap-1 text-[10px] text-emerald-300/70">
            <span className="size-1.5 rounded-full bg-emerald-400" />
            Inline diff from latest agent edit
          </span>
        ) : (
          <span className="ml-auto text-[10px] text-slate-600">readonly demo buffer</span>
        )}
      </div>

      {/* Code content */}
      <pre className="flex-1 overflow-auto text-[12px] leading-[1.65] font-mono bg-[#0d1117] py-1">
        {hasDiff
          ? latestDiff.lines.map((line, i) => {
              const prefix =
                line.type === "added" ? "+" : line.type === "removed" ? "-" : " ";
              const rowCls =
                line.type === "added"
                  ? "bg-emerald-950/50 text-emerald-100"
                  : line.type === "removed"
                    ? "bg-red-950/40 text-red-200"
                    : "text-slate-400";
              const numCls =
                line.type === "added"
                  ? "text-emerald-600"
                  : line.type === "removed"
                    ? "text-red-600"
                    : "text-slate-700";
              const lineNum =
                line.type === "added"
                  ? line.newLine
                  : line.type === "removed"
                    ? line.oldLine
                    : (line.newLine ?? line.oldLine);
              return (
                <div key={i} className={`grid grid-cols-[2.5rem_0.9rem_1fr] px-2 min-w-0 ${rowCls}`}>
                  <span className={`select-none text-right pr-2 text-[11px] ${numCls}`}>
                    {lineNum ?? ""}
                  </span>
                  <span className={`select-none text-[11px] ${numCls}`}>{prefix}</span>
                  <code className="whitespace-pre">{line.value || " "}</code>
                </div>
              );
            })
          : content.split("\n").map((line, index) => (
              <div
                key={`${selectedFile}-${index}`}
                className="grid grid-cols-[2.5rem_1fr] px-2 text-slate-400 hover:bg-white/[0.015]"
              >
                <span className="select-none text-right pr-3 text-[11px] text-slate-700">
                  {index + 1}
                </span>
                <code className="whitespace-pre">{line || " "}</code>
              </div>
            ))}
      </pre>
    </div>
  );
}
