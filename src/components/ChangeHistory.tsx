import type { ChangeHistoryEntry } from "@/lib/types";
import { CheckCircle2, History } from "lucide-react";

export function ChangeHistory({ history }: { history: ChangeHistoryEntry[] }) {
  return (
    <section className="panel">
      <div className="panel-title">
        <History size={16} />
        Committed Changes
      </div>
      <div className="mt-3 space-y-2 max-h-[200px] overflow-auto pr-1">
        {history.length === 0 ? (
          <p className="rounded-lg border border-dashed border-white/10 p-3 text-xs text-slate-500">
            No committed changes yet. Run the agent to make incremental changes.
          </p>
        ) : (
          [...history].reverse().map((entry) => (
            <div
              key={entry.id}
              className="flex items-start gap-2 rounded-lg border border-emerald-300/15 bg-emerald-400/5 px-3 py-2"
            >
              <CheckCircle2 size={12} className="mt-0.5 shrink-0 text-emerald-400" />
              <div className="min-w-0">
                <p className="truncate text-xs font-semibold text-emerald-200">{entry.summary}</p>
                <p className="mt-0.5 text-[10px] text-slate-500">{entry.timestamp}</p>
              </div>
            </div>
          ))
        )}
      </div>
    </section>
  );
}
