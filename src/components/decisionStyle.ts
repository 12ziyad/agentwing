import type { AgentWingDecision } from "@/lib/agentwingTypes";

export const DECISION_STYLE: Record<AgentWingDecision, { dot: string; text: string; ring: string; bg: string; label: string }> = {
  allow: { dot: "bg-emerald-400", text: "text-emerald-300", ring: "ring-emerald-400/25", bg: "bg-emerald-400/[0.06]", label: "Proceed" },
  block: { dot: "bg-rose-400", text: "text-rose-300", ring: "ring-rose-400/25", bg: "bg-rose-400/[0.06]", label: "Never runs" },
  approval_required: { dot: "bg-violet-400", text: "text-violet-300", ring: "ring-violet-400/25", bg: "bg-violet-400/[0.06]", label: "A human decides" },
  sandbox_required: { dot: "bg-cyan-400", text: "text-cyan-300", ring: "ring-cyan-400/25", bg: "bg-cyan-400/[0.06]", label: "Runs in a sandbox" },
  restore_point_required: { dot: "bg-amber-400", text: "text-amber-300", ring: "ring-amber-400/25", bg: "bg-amber-400/[0.06]", label: "Checkpoint first" },
};
