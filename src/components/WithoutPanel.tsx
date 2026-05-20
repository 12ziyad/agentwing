import type { WithoutLine } from "@/lib/demoTypes";

const OUTCOMES = [
  "secret leaked",
  "47 lines changed without diff",
  "force push overwrote main",
  "staging deploy fired without approval",
  "no restore point",
];

export function WithoutPanel({ lines, frozen }: { lines: WithoutLine[]; frozen: boolean }) {
  return (
    <section className="min-h-0 overflow-hidden rounded-lg border border-red-400/20 bg-[#0b080a]">
      <div className="flex h-9 items-center justify-between border-b border-red-400/15 px-3">
        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-red-200">
          Without AgentWing outcome
        </p>
        <span className="text-[10px] text-red-300/70">{frozen ? "frozen" : "running"}</span>
      </div>

      <div className="h-full overflow-auto p-3">
        {!frozen ? (
          <div className="space-y-2">
            {lines.length === 0 ? (
              <p className="text-[11px] text-slate-600">Running direct agent flow...</p>
            ) : (
              lines.map((line) => (
                <div key={line.id} className="incident-line rounded border border-white/[0.06] bg-white/[0.025] px-2.5 py-2">
                  <p className="font-mono text-[10px] text-slate-600">{line.timestamp}</p>
                  <p className={line.kind === "bad" ? "text-[11px] text-red-200" : "text-[11px] text-amber-200"}>
                    {line.text}
                  </p>
                </div>
              ))
            )}
          </div>
        ) : (
          <div className="space-y-2">
            {OUTCOMES.map((outcome) => (
              <div key={outcome} className="flex items-start gap-2 rounded border border-red-400/15 bg-red-400/[0.06] px-2.5 py-2">
                <span className="mt-1 size-1.5 rounded-full bg-red-400" />
                <p className="text-[11.5px] leading-5 text-red-100">{outcome}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
