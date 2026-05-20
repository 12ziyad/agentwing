import type { ProjectFiles } from "@/lib/types";
import { Braces } from "lucide-react";

type CodeViewerProps = {
  files: ProjectFiles;
  selectedFile: string;
  changedLines: Set<number>;
};

export function CodeViewer({ files, selectedFile, changedLines }: CodeViewerProps) {
  const content =
    selectedFile === ".env"
      ? "/* AgentWing blocked direct secret reads. Select .env.example for safe placeholders. */"
      : files[selectedFile] ?? "";

  return (
    <section className="panel min-h-[395px]">
      <div className="panel-title">
        <Braces size={16} />
        Code Editor
      </div>
      <div className="mt-4 overflow-hidden rounded-lg border border-white/10 bg-[#080b14]">
        <div className="flex items-center justify-between border-b border-white/10 bg-white/[0.03] px-3 py-2">
          <span className="font-mono text-xs text-cyan-200">{selectedFile}</span>
          <span className="rounded bg-white/[0.06] px-2 py-1 text-[10px] font-bold uppercase text-slate-400">
            readonly demo buffer
          </span>
        </div>
        <pre className="max-h-[320px] overflow-auto p-0 text-xs leading-6">
          {content.split("\n").map((line, index) => {
            const lineNumber = index + 1;
            const changed = changedLines.has(lineNumber);
            return (
              <div
                key={`${selectedFile}-${lineNumber}`}
                className={`grid grid-cols-[3rem_1fr] px-3 ${
                  changed ? "bg-yellow-300/10 text-yellow-50" : "text-slate-300"
                }`}
              >
                <span className="select-none pr-3 text-right text-slate-600">{lineNumber}</span>
                <code className="whitespace-pre font-mono">{line || " "}</code>
              </div>
            );
          })}
        </pre>
      </div>
    </section>
  );
}
