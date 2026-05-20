import type { PlanLine } from "@/lib/demoTypes";

export function PlanDiff({ lines }: { lines: PlanLine[] }) {
  const redirectedSecret = lines.some((line) => line.id === "L1_R");
  const blockedForcePush = lines.some((line) => line.id === "L4_R");
  const gatedDeploy = lines.some((line) => line.id === "L5_R");

  return (
    <section className="overflow-hidden rounded-lg border border-white/[0.08] bg-[#080b12]">
      <div className="border-b border-white/[0.08] px-3 py-2">
        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-200">
          Feedback loop
        </p>
      </div>

      <div className="space-y-3 p-3">
        <p className="text-[11px] leading-5 text-slate-300">
          AgentWing returns a safer alternative to the Mini Code Agent when a
          risky action is blocked.
        </p>
        <div className="rounded border border-white/[0.07] bg-[#05070d] p-2 font-mono text-[11px] leading-5">
          <p className={redirectedSecret ? "text-red-300" : "text-slate-400"}>
            Blocked: read .env
          </p>
          <p className={redirectedSecret ? "text-emerald-300" : "text-slate-400"}>
            Returned: {redirectedSecret ? "use .env.example instead" : "waiting for policy feedback"}
          </p>
        </div>
        {(blockedForcePush || gatedDeploy) && (
          <div className="grid gap-2 text-[11px] sm:grid-cols-2">
            {blockedForcePush && (
              <div className="rounded border border-red-400/15 bg-red-400/[0.04] px-2 py-1.5 text-red-100">
                force push redirected to safe branch
              </div>
            )}
            {gatedDeploy && (
              <div className="rounded border border-amber-400/15 bg-amber-400/[0.04] px-2 py-1.5 text-amber-100">
                deploy moved behind approval
              </div>
            )}
          </div>
        )}
      </div>
    </section>
  );
}
