import { demoFileOrder } from "@/lib/demoProject";
import type { ProjectFiles } from "@/lib/types";
import { Braces, Code2, File, FileCode2, FileText, FolderOpen, LockKeyhole, Palette } from "lucide-react";

type FileExplorerProps = {
  files: ProjectFiles;
  selectedFile: string;
  onSelect: (path: string) => void;
  modifiedFiles: Set<string>;
};

function fileIcon(path: string) {
  if (path === ".env") return <LockKeyhole size={13} className="shrink-0 text-red-400" />;
  if (path.endsWith(".jsx") || path.endsWith(".tsx")) return <Code2 size={13} className="shrink-0 text-yellow-300" />;
  if (path.endsWith(".css")) return <Palette size={13} className="shrink-0 text-blue-400" />;
  if (path.endsWith(".json")) return <Braces size={13} className="shrink-0 text-yellow-500" />;
  if (path.endsWith(".js")) return <FileCode2 size={13} className="shrink-0 text-yellow-400" />;
  if (path.endsWith(".md")) return <FileText size={13} className="shrink-0 text-slate-400" />;
  return <File size={13} className="shrink-0 text-slate-400" />;
}

function getFolder(path: string) {
  const parts = path.split("/");
  return parts.length > 1 ? parts[0] : null;
}

function baseName(path: string) {
  const parts = path.split("/");
  return parts[parts.length - 1];
}

function FileRow({
  path,
  displayName,
  active,
  modified,
  onSelect,
  indent,
}: {
  path: string;
  displayName: string;
  active: boolean;
  modified: boolean;
  onSelect: (path: string) => void;
  indent: boolean;
}) {
  const isSecret = path === ".env";
  return (
    <button
      onClick={() => !isSecret && onSelect(path)}
      className={`flex w-full items-center gap-1.5 py-[5px] pr-3 text-left text-[12px] transition-colors ${
        indent ? "pl-8" : "pl-3"
      } ${
        active
          ? "bg-indigo-500/20 text-slate-100"
          : "text-slate-400 hover:bg-white/[0.04] hover:text-slate-200"
      } ${isSecret ? "cursor-not-allowed" : "cursor-pointer"}`}
    >
      {fileIcon(path)}
      <span className="flex-1 truncate">{displayName}</span>
      {isSecret && (
        <span className="text-[9px] font-bold text-red-400 border border-red-400/30 bg-red-400/10 rounded px-1 py-px">
          BLOCKED
        </span>
      )}
      {modified && !isSecret && (
        <span className="size-[7px] rounded-full bg-amber-400 shrink-0" title="Modified by agent" />
      )}
    </button>
  );
}

export function FileExplorer({ files, selectedFile, onSelect, modifiedFiles }: FileExplorerProps) {
  const folders = new Set<string>();
  demoFileOrder.forEach((p) => {
    const f = getFolder(p);
    if (f) folders.add(f);
  });

  return (
    <div className="flex flex-col h-full bg-[#0c0f1a] select-none overflow-hidden">
      <div className="px-3 py-2 text-[10px] font-bold uppercase tracking-widest text-slate-600 border-b border-white/[0.06]">
        Explorer
      </div>
      <div className="flex items-center gap-1.5 px-3 py-2 text-[11px] font-semibold text-slate-500">
        <FolderOpen size={13} className="text-yellow-500/70" />
        mini-workspace
      </div>
      <div className="flex-1 overflow-y-auto pb-4">
        {Array.from(folders).map((folder) => (
          <div key={folder}>
            <div className="flex items-center gap-1.5 px-3 py-[5px] text-[11px] text-slate-500">
              <FolderOpen size={12} className="text-yellow-500/60 shrink-0" />
              {folder}
            </div>
            {demoFileOrder
              .filter((p) => files[p] && getFolder(p) === folder)
              .map((path) => (
                <FileRow
                  key={path}
                  path={path}
                  displayName={baseName(path)}
                  active={selectedFile === path}
                  modified={modifiedFiles.has(path)}
                  onSelect={onSelect}
                  indent
                />
              ))}
          </div>
        ))}
        {demoFileOrder
          .filter((p) => files[p] && !getFolder(p))
          .map((path) => (
            <FileRow
              key={path}
              path={path}
              displayName={baseName(path)}
              active={selectedFile === path}
              modified={modifiedFiles.has(path)}
              onSelect={onSelect}
              indent={false}
            />
          ))}
      </div>
    </div>
  );
}
