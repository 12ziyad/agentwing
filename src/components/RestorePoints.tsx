"use client";

import type { Dispatch } from "react";
import type { DemoEvent, RestorePoint, DemoState } from "@/lib/demoTypes";

type RestorePointsProps = {
  points: RestorePoint[];
  rollback: DemoState["rollback"];
  dispatch: Dispatch<DemoEvent>;
  onRollbackBegin?: () => void;
};

const ROLLBACK_LINES = [
  "[ROLLBACK] Rewinding to RP-002",
  "[ROLLBACK] boxArenaConfig.ts restored",
  "[ROLLBACK] Preview state restored",
  "[ROLLBACK] Audit event added",
];

export function RestorePoints({ points, rollback, dispatch, onRollbackBegin }: RestorePointsProps) {
  const currentIdx = points.findIndex((p) => p.current);
  const rollbackTarget = currentIdx > 0 ? points[currentIdx - 1] : null;

  function handleRollback(targetId: string) {
    onRollbackBegin?.();
    dispatch({ type: "rollback_start", restore_point_id: targetId });
    ROLLBACK_LINES.forEach((text, i) => {
      setTimeout(() => dispatch({ type: "rollback_line", text }), (i + 1) * 380);
    });
    setTimeout(
      () => dispatch({ type: "rollback_complete", restore_point_id: targetId }),
      ROLLBACK_LINES.length * 380 + 420,
    );
  }

  return (
    <section className="rounded-lg border border-amber-400/15 bg-[#0b0905] px-3 py-3">
      <div className="mb-3 flex items-center justify-between gap-2">
        <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-amber-300/80">
          Restore Points
        </p>
        {rollback === "idle" && rollbackTarget && (
          <button
            onClick={() => handleRollback(rollbackTarget.id)}
            className="rounded border border-amber-400/25 bg-amber-400/10 px-2 py-1 text-[10.5px] font-semibold text-amber-200 transition hover:bg-amber-400/15 active:scale-95"
          >
            Rollback to {rollbackTarget.id}
          </button>
        )}
        {rollback === "rolling" && (
          <span className="text-[10.5px] text-amber-300">Rolling back...</span>
        )}
        {rollback === "complete" && (
          <span className="text-[10.5px] text-emerald-300">Rollback complete</span>
        )}
      </div>

      {points.length === 0 ? (
        <p className="text-[11px] text-slate-400">
          Restore Points will appear as AgentWing captures them...
        </p>
      ) : (
        <div className="flex flex-wrap items-start gap-y-3">
          {points.map((rp, i) => (
            <div key={rp.id} className="flex items-center">
              <div className="flex flex-col items-center">
                <div
                  className={`size-3 rounded-full border-2 transition-all duration-500 ${
                    rp.current
                      ? "border-cyan-300 bg-cyan-300 shadow-[0_0_10px_rgba(103,232,249,0.35)]"
                      : "border-slate-600 bg-slate-800"
                  } ${rollback === "rolling" && rp.id === rollbackTarget?.id ? "rollback-ring" : ""}`}
                />
                <span className="mt-1.5 font-mono text-[9px] text-slate-300">{rp.id}</span>
                <span className="max-w-[74px] text-center text-[9px] leading-3 text-slate-400">
                  {rp.desc}
                </span>
              </div>
              {i < points.length - 1 && (
                <div className="mx-1 mb-5 mt-[6px] h-px w-7 self-start bg-slate-700" />
              )}
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
