import { useEffect, useRef } from "react";
import type { Dispatch } from "react";
import type { DemoEvent, Transaction, DemoState } from "@/lib/demoTypes";
import { TransactionCard } from "./TransactionCard";
import { TerminalBlock } from "./TerminalBlock";

type WithPanelProps = {
  transactions: Transaction[];
  rollback: DemoState["rollback"];
  rollbackLines: string[];
  wispMessage: string;
  dispatch: Dispatch<DemoEvent>;
};

export function WithPanel({ transactions, rollback, rollbackLines, wispMessage, dispatch }: WithPanelProps) {
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [transactions.length, rollbackLines.length]);

  return (
    <div className="flex flex-col h-full rounded-xl border border-cyan-400/20 bg-[#060c18] overflow-hidden">
      {/* Header */}
      <div className="flex-none px-4 py-3 border-b border-cyan-400/15 bg-cyan-950/20">
        <div className="flex items-center gap-2">
          <span className="text-base">🛡</span>
          <span className="font-semibold text-cyan-200">With AgentWing</span>
        </div>
        <p className="text-[10.5px] text-cyan-400/70 mt-0.5 truncate">{wispMessage}</p>
      </div>

      {/* Transactions */}
      <div className="flex-1 overflow-y-auto px-3 py-3 space-y-2.5">
        {transactions.length === 0 && (
          <p className="text-[11px] text-slate-600 italic mt-2">Waiting for first agent action…</p>
        )}
        {transactions.map((tx) => (
          <TransactionCard key={tx.id} tx={tx} dispatch={dispatch} />
        ))}

        {/* Rollback terminal */}
        {rollback !== "idle" && (
          <div className="rounded-xl border border-violet-400/30 bg-violet-950/20 p-3">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-[10px] font-bold uppercase text-violet-300 tracking-wide">Rollback in progress</span>
              {rollback === "complete" && (
                <span className="text-[10px] text-emerald-300">✓ complete</span>
              )}
            </div>
            <TerminalBlock lines={rollbackLines} txId="ROLLBACK" />
          </div>
        )}

        <div ref={endRef} />
      </div>
    </div>
  );
}
