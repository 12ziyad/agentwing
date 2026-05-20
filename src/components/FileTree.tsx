import { demoFileOrder } from "@/lib/demoProject";
import type { ProjectFiles } from "@/lib/types";
import { FileCode2, Folder, LockKeyhole } from "lucide-react";

type FileTreeProps = {
  files: ProjectFiles;
  selectedFile: string;
  onSelect: (path: string) => void;
  modifiedFiles: Set<string>;
};

export function FileTree({ files, selectedFile, onSelect, modifiedFiles }: FileTreeProps) {
  return (
    <section className="panel">
      <div className="panel-title">
        <Folder size={16} />
        Project Files
      </div>
      <div className="mt-4 space-y-1">
        {demoFileOrder.filter((path) => files[path]).map((path) => {
          const isSecret = path === ".env";
          const active = selectedFile === path;
          return (
            <button
              key={path}
              onClick={() => !isSecret && onSelect(path)}
              className={`flex w-full items-center justify-between rounded-md px-3 py-2 text-left text-xs transition ${
                active
                  ? "border border-indigo-300/30 bg-indigo-400/15 text-indigo-100"
                  : "border border-transparent text-slate-300 hover:border-white/10 hover:bg-white/[0.04]"
              } ${isSecret ? "cursor-not-allowed opacity-70" : ""}`}
            >
              <span className="flex min-w-0 items-center gap-2">
                {isSecret ? <LockKeyhole size={14} className="text-red-300" /> : <FileCode2 size={14} />}
                <span className="truncate">{path}</span>
              </span>
              {modifiedFiles.has(path) ? (
                <span className="rounded bg-yellow-300/15 px-1.5 py-0.5 text-[10px] font-bold text-yellow-200">
                  MOD
                </span>
              ) : null}
            </button>
          );
        })}
      </div>
    </section>
  );
}
