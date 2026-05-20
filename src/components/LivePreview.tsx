import type { PreviewModel } from "@/lib/types";
import { Eye } from "lucide-react";

const STATUS_STYLES: Record<
  PreviewModel["statusColor"],
  { border: string; bg: string; text: string }
> = {
  green:  { border: "#bbf7d0", bg: "#f0fdf4", text: "#15803d" },
  blue:   { border: "#bae6fd", bg: "#f0f9ff", text: "#0369a1" },
  red:    { border: "#fecaca", bg: "#fef2f2", text: "#dc2626" },
  yellow: { border: "#fde68a", bg: "#fefce8", text: "#b45309" },
};

const CARD_RADIUS: Record<PreviewModel["cardsRounded"], string> = {
  md: "8px", lg: "14px", xl: "18px", "2xl": "24px",
};

const WORKSPACE_RADIUS: Record<PreviewModel["cardsRounded"], string> = {
  md: "12px", lg: "18px", xl: "22px", "2xl": "26px",
};

const BUTTON_SIZE: Record<
  PreviewModel["primaryButton"]["size"],
  { fontSize: string; padding: string }
> = {
  sm: { fontSize: "11px", padding: "5px 9px" },
  md: { fontSize: "13px", padding: "7px 12px" },
  lg: { fontSize: "16px", padding: "10px 18px" },
};

const TONE_STYLES: Record<
  string,
  { border: string; bg: string; valueColor: string }
> = {
  danger:  { border: "#fecaca", bg: "#fef2f2", valueColor: "#dc2626" },
  warning: { border: "#fde68a", bg: "#fefce8", valueColor: "#b45309" },
  success: { border: "#e2e8f0", bg: "#f8fafc",  valueColor: "#15803d" },
  default: { border: "#e2e8f0", bg: "#f8fafc",  valueColor: "#0f172a" },
};

const DOT_COLORS = ["#22c55e", "#38bdf8", "#f59e0b", "#6366f1"];

export function LivePreview({ previewModel }: { previewModel: PreviewModel }) {
  const {
    title, subtitle, eyebrow, showStatusPill, statusText, statusColor,
    metrics, primaryButton, secondaryButtons, cardsRounded, activityItems,
  } = previewModel;

  const statusStyle = STATUS_STYLES[statusColor];
  const cardRadius = CARD_RADIUS[cardsRounded];
  const wsRadius = WORKSPACE_RADIUS[cardsRounded];
  const btnSize = BUTTON_SIZE[primaryButton.size];
  const visibleSecondary = (secondaryButtons ?? []).filter((b) => b.visible);

  return (
    <div className="flex flex-col h-full bg-[#070a16] overflow-hidden">
      {/* Section header strip */}
      <div className="flex-none flex items-center justify-between px-4 h-9 border-b border-white/[0.07]">
        <div className="flex items-center gap-2">
          <Eye size={12} className="text-slate-500" />
          <span className="text-xs font-semibold text-slate-300">Live App Preview</span>
          <span className="hidden text-[10px] text-slate-600 md:block">
            The mini app being edited by the agent
          </span>
        </div>
        <span className="text-[9px] text-slate-700">Preview from committed model</span>
      </div>

      {/* Scrollable preview area */}
      <div
        className="flex-1 overflow-y-auto flex justify-center py-4 px-4"
        style={{
          background:
            "radial-gradient(circle at 50% 0%, rgba(59,130,246,0.12) 0%, transparent 50%), linear-gradient(160deg, #0d1424, #0e1528 50%, #101830)",
        }}
      >
        <div
          className="w-full max-w-[340px] bg-white text-slate-900 shadow-[0_24px_80px_rgba(0,0,0,0.5)]"
          style={{ borderRadius: wsRadius, padding: "20px" }}
        >
          {/* Header */}
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="mb-1.5 text-[11px] font-extrabold uppercase text-indigo-600">
                {eyebrow}
              </p>
              <h2 className="text-2xl font-bold text-slate-950">{title}</h2>
              <p className="mt-1 text-xs text-slate-500">{subtitle}</p>
            </div>
            {showStatusPill && (
              <span
                className="shrink-0 rounded-full border text-[11px] font-extrabold"
                style={{
                  borderColor: statusStyle.border,
                  background: statusStyle.bg,
                  color: statusStyle.text,
                  padding: "5px 9px",
                }}
              >
                {statusText}
              </span>
            )}
          </div>

          {/* Metrics */}
          {metrics.length > 0 && (
            <div
              className="my-4 grid gap-2"
              style={{
                gridTemplateColumns: `repeat(${Math.min(metrics.length, 4)}, minmax(0, 1fr))`,
              }}
            >
              {metrics.map((m, i) => {
                const tone = m.tone ?? "default";
                const ts = TONE_STYLES[tone] ?? TONE_STYLES.default;
                return (
                  <div
                    key={`${m.label}-${i}`}
                    className="border"
                    style={{
                      background: ts.bg,
                      borderColor: ts.border,
                      borderRadius: cardRadius,
                      padding: "10px 10px",
                    }}
                  >
                    <span className="block text-[11px] font-bold text-slate-500">{m.label}</span>
                    <strong className="mt-1.5 block text-xl" style={{ color: ts.valueColor }}>
                      {m.value}
                    </strong>
                    {m.badge && (
                      <span className="mt-1.5 inline-flex rounded-full bg-amber-100 px-1.5 py-0.5 text-[9px] font-extrabold text-amber-800">
                        {m.badge}
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* Buttons */}
          {(primaryButton.visible || visibleSecondary.length > 0) && (
            <div className="flex flex-wrap gap-2 mb-1">
              {primaryButton.visible && (
                <button
                  style={{
                    border: 0,
                    borderRadius: "9px",
                    fontSize: btnSize.fontSize,
                    padding: btnSize.padding,
                    background: "#4f46e5",
                    color: "white",
                    fontWeight: 800,
                    cursor: "default",
                    boxShadow: "0 8px 20px rgba(79,70,229,0.3)",
                  }}
                >
                  {primaryButton.text}
                </button>
              )}
              {visibleSecondary.map((btn, i) => (
                <button
                  key={`${btn.text}-${i}`}
                  style={{
                    border: "2px solid #4f46e5",
                    borderRadius: "9px",
                    fontSize: btnSize.fontSize,
                    padding: btnSize.padding,
                    background: "transparent",
                    color: "#4f46e5",
                    fontWeight: 800,
                    cursor: "default",
                  }}
                >
                  {btn.text}
                </button>
              ))}
            </div>
          )}

          {/* Activity */}
          <div className="mt-4 grid gap-2">
            {activityItems.map((label, index) => (
              <div
                key={`${label}-${index}`}
                className="flex items-center gap-2 text-xs font-semibold text-slate-700"
              >
                <span
                  className="size-1.5 shrink-0 rounded-full"
                  style={{ background: DOT_COLORS[index % DOT_COLORS.length] }}
                />
                {label}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
