import { useEffect, useRef } from "react";

export function TerminalBlock({ lines, txId }: { lines: string[]; txId: string }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (ref.current) ref.current.scrollTop = ref.current.scrollHeight;
  }, [lines.length]);

  if (lines.length === 0) return null;

  return (
    <div
      ref={ref}
      className="mt-2.5 rounded-lg border border-white/[0.07] bg-[#02040a] px-3 py-2.5 font-mono text-[11px] leading-[1.75] max-h-[160px] overflow-y-auto"
    >
      {lines.map((line, i) => (
        <div
          key={`${txId}-${i}`}
          className={`term-line ${
            line.includes("✓") || line.includes("passed")
              ? "text-emerald-400"
              : line.includes("ROLLBACK")
                ? "text-violet-300"
                : line.startsWith("agentwing@")
                  ? "text-cyan-300"
                  : line.startsWith("[TX-")
                    ? "text-slate-300"
                    : "text-slate-400"
          }`}
          style={{ animationDelay: `${i * 0.05}s` }}
        >
          {line}
        </div>
      ))}
      <div className="inline-block w-1.5 h-3 bg-cyan-400 ml-0.5 cursor-blink align-middle" />
    </div>
  );
}
