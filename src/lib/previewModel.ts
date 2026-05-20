import type { CardsRounded, ButtonSize, StatusColor, PreviewModel, MetricTone } from "./types";

const WORKSPACE_RADIUS: Record<CardsRounded, string> = {
  md: "12px",
  lg: "20px",
  xl: "24px",
  "2xl": "28px",
};

const METRIC_RADIUS: Record<CardsRounded, string> = {
  md: "8px",
  lg: "14px",
  xl: "18px",
  "2xl": "24px",
};

const BUTTON_RADIUS: Record<CardsRounded, string> = {
  md: "8px",
  lg: "11px",
  xl: "14px",
  "2xl": "18px",
};

const STATUS_COLORS: Record<StatusColor, { border: string; bg: string; text: string }> = {
  green:  { border: "#bbf7d0", bg: "#f0fdf4", text: "#15803d" },
  blue:   { border: "#bae6fd", bg: "#f0f9ff", text: "#0369a1" },
  red:    { border: "#fecaca", bg: "#fef2f2", text: "#dc2626" },
  yellow: { border: "#fde68a", bg: "#fefce8", text: "#b45309" },
};

const BUTTON_SIZE: Record<ButtonSize, { fontSize: string; padding: string }> = {
  sm: { fontSize: "12px", padding: "6px 10px" },
  md: { fontSize: "14px", padding: "8px 12px" },
  lg: { fontSize: "18px", padding: "12px 20px" },
};

const DOT_CLASSES = ["completed", "passed", "pending", "completed"];

export function defaultPreviewModel(): PreviewModel {
  return {
    title: "AgentOps Console",
    subtitle: "Live automation health",
    eyebrow: "AgentWing Runtime",
    showStatusPill: true,
    statusText: "Active",
    statusColor: "green",
    metrics: [
      { label: "Tasks", value: "24", tone: "default" },
      { label: "Success", value: "98%", tone: "success" },
      { label: "Risk", value: "Low", tone: "default" },
    ],
    primaryButton: { text: "Run Workflow", size: "md", visible: true },
    secondaryButtons: [],
    cardsRounded: "lg",
    activityItems: ["Code scan completed", "Sandbox replay passed", "Approval pending"],
  };
}

export function generateAppJsx(model: PreviewModel): string {
  const pillJsx = model.showStatusPill
    ? `\n          <span className="status-pill">${model.statusText}</span>`
    : "";

  const buttonJsx = model.primaryButton.visible
    ? `\n        <button className="primary-button">${model.primaryButton.text}</button>`
    : "";

  const secondaryJsx = (model.secondaryButtons ?? [])
    .filter((b) => b.visible)
    .map((b) => `\n        <button className="secondary-button">${b.text}</button>`)
    .join("");

  const metricsJsx = model.metrics
    .map((m) => {
      const isRisk = m.label.toLowerCase() === "risk" || m.tone === "danger";
      const cls = isRisk ? "metric-card risk-card" : "metric-card";
      const badge = m.badge
        ? `\n            <span className="warning-badge">${m.badge}</span>`
        : "";
      return `          <article className="${cls}">
            <span>${m.label}</span>
            <strong>${m.value}</strong>${badge}
          </article>`;
    })
    .join("\n");

  const activityJsx = model.activityItems
    .map(
      (item, i) =>
        `          <div className="activity-row">
            <span className="activity-dot ${DOT_CLASSES[i % DOT_CLASSES.length]}" />
            ${item}
          </div>`,
    )
    .join("\n");

  return `import "./styles.css";

export default function App() {
  return (
    <main className="workspace-shell">
      <section className="workspace-card">
        <div className="console-header">
          <div>
            <p className="eyebrow">${model.eyebrow}</p>
            <h1>${model.title}</h1>
            <p className="subtitle">${model.subtitle}</p>
          </div>${pillJsx}
        </div>

        <div className="metrics-grid">
${metricsJsx}
        </div>

        <div className="button-row">${buttonJsx}${secondaryJsx}
        </div>

        <div className="activity-list">
${activityJsx}
        </div>
      </section>
    </main>
  );
}
`;
}

export function generateStylesCss(model: PreviewModel): string {
  const wRadius = WORKSPACE_RADIUS[model.cardsRounded];
  const mRadius = METRIC_RADIUS[model.cardsRounded];
  const bRadius = BUTTON_RADIUS[model.cardsRounded];
  const sc = STATUS_COLORS[model.statusColor];
  const bs = BUTTON_SIZE[model.primaryButton.size];

  const riskMetric = model.metrics.find((m) => m.label.toLowerCase() === "risk");
  const riskDanger = riskMetric?.tone === "danger";
  const riskCardBlock = riskDanger
    ? `
.risk-card {
  border-color: #fecaca;
  background: #fef2f2;
}
`
    : "";
  const riskStrongColor = riskDanger ? "#dc2626" : "#15803d";
  const btnDisplay = model.primaryButton.visible ? "" : "\n  display: none;";

  return `.workspace-shell {
  min-height: 100vh;
  display: grid;
  place-items: center;
  background: #0f172a;
  font-family: Inter, system-ui, sans-serif;
}

.workspace-card {
  width: 380px;
  border-radius: ${wRadius};
  padding: 26px;
  background: #ffffff;
  box-shadow: 0 28px 90px rgba(15, 23, 42, 0.34);
}

.console-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 18px;
}

.eyebrow {
  margin: 0 0 8px;
  font-size: 12px;
  font-weight: 800;
  color: #4f46e5;
  letter-spacing: 0;
  text-transform: uppercase;
}

.workspace-card h1 {
  margin: 0;
  color: #111827;
  font-size: 28px;
}

.subtitle {
  margin: 7px 0 0;
  color: #64748b;
}

.status-pill {
  border: 1px solid ${sc.border};
  border-radius: 999px;
  padding: 6px 10px;
  background: ${sc.bg};
  color: ${sc.text};
  font-size: 12px;
  font-weight: 800;
}

.metrics-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 10px;
  margin: 24px 0 18px;
}

.metric-card {
  border: 1px solid #e2e8f0;
  border-radius: ${mRadius};
  padding: 14px 12px;
  background: #f8fafc;
}

.metric-card span {
  display: block;
  color: #64748b;
  font-size: 12px;
  font-weight: 700;
}

.metric-card strong {
  display: block;
  margin-top: 8px;
  color: #0f172a;
  font-size: 22px;
}
${riskCardBlock}
.risk-card strong {
  color: ${riskStrongColor};
}

.warning-badge {
  display: inline-flex;
  margin-top: 8px;
  border-radius: 999px;
  padding: 3px 7px;
  background: #fef3c7;
  color: #92400e;
  font-size: 10px;
  font-weight: 800;
}

.button-row {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
  margin-bottom: 4px;
}

.primary-button {
  border: 0;
  border-radius: ${bRadius};
  font-size: ${bs.fontSize};
  padding: ${bs.padding};
  background: #4f46e5;
  color: white;
  font-weight: 800;
  cursor: pointer;
  box-shadow: 0 14px 30px rgba(79, 70, 229, 0.26);${btnDisplay}
}

.secondary-button {
  border: 2px solid #4f46e5;
  border-radius: ${bRadius};
  font-size: ${bs.fontSize};
  padding: ${bs.padding};
  background: transparent;
  color: #4f46e5;
  font-weight: 800;
  cursor: pointer;
}

.activity-list {
  display: grid;
  gap: 10px;
  margin-top: 20px;
}

.activity-row {
  display: flex;
  align-items: center;
  gap: 9px;
  color: #334155;
  font-size: 13px;
  font-weight: 650;
}

.activity-dot {
  width: 8px;
  height: 8px;
  border-radius: 999px;
}

.activity-dot.completed {
  background: #22c55e;
}

.activity-dot.passed {
  background: #38bdf8;
}

.activity-dot.pending {
  background: #f59e0b;
}
`;
}

export function applyTaskToModel(model: PreviewModel, task: string): PreviewModel {
  const lower = task.toLowerCase();
  const next: PreviewModel = {
    ...model,
    metrics: model.metrics.map((m) => ({ ...m })),
    primaryButton: { ...model.primaryButton },
    secondaryButtons: (model.secondaryButtons ?? []).map((b) => ({ ...b })),
    activityItems: [...model.activityItems],
  };

  // Add secondary button: "add [a/another/one more] button called X"
  const addBtnMatch = lower.match(
    /add (?:a |an |another |one more |new )?button (?:called |named )?["']?([a-z0-9]+)["']?/,
  );
  if (addBtnMatch) {
    const raw = addBtnMatch[1];
    if (raw && !["bigger", "primary", "workflow", "text", "size"].includes(raw)) {
      const text = raw.charAt(0).toUpperCase() + raw.slice(1);
      if (!next.secondaryButtons.some((b) => b.text.toLowerCase() === text.toLowerCase())) {
        next.secondaryButtons = [...next.secondaryButtons, { text, visible: true }];
      }
      return next;
    }
  }

  // Remove named secondary button: "remove button called X" or "remove X button"
  const removeBtnMatch = lower.match(
    /remove (?:(?:the )?button (?:called |named )?["']?([a-z0-9]+)["']?|["']?([a-z0-9]+)["']? button)/,
  );
  if (removeBtnMatch) {
    const name = (removeBtnMatch[1] ?? removeBtnMatch[2] ?? "").toLowerCase();
    if (name && !["active", "primary", "workflow", "run", "launch"].includes(name)) {
      next.secondaryButtons = next.secondaryButtons.map((b) =>
        b.text.toLowerCase() === name ? { ...b, visible: false } : b,
      );
      return next;
    }
  }

  // Remove/hide status pill
  if (
    (lower.includes("remove") || lower.includes("hide")) &&
    (lower.includes("active") || lower.includes("status pill") || lower.includes("status badge"))
  ) {
    next.showStatusPill = false;
    return next;
  }

  // Remove Tasks metric card
  if (
    lower.includes("remove") &&
    (lower.includes("task box") ||
      lower.includes("task metric") ||
      lower.includes("task card") ||
      (lower.includes("task") && lower.includes("card")) ||
      (lower.includes("tasks") && lower.includes("remove")))
  ) {
    next.metrics = next.metrics.filter((m) => m.label.toLowerCase() !== "tasks");
    return next;
  }

  // Risk card to red/danger
  if (lower.includes("risk") && (lower.includes("red") || lower.includes("alert") || lower.includes("danger"))) {
    next.metrics = next.metrics.map((m) =>
      m.label.toLowerCase() === "risk"
        ? { ...m, tone: "danger" as MetricTone, value: "High" }
        : m,
    );
    return next;
  }

  // Add Agents metric card
  if (
    lower.includes("agents") &&
    (lower.includes("add") || lower.includes("metric") || lower.includes("card") || lower.includes("one more"))
  ) {
    if (!next.metrics.some((m) => m.label.toLowerCase() === "agents")) {
      next.metrics = [...next.metrics, { label: "Agents", value: "12", tone: "default" as MetricTone }];
    }
    return next;
  }

  // Add generic named metric card: "add metric card called X" or "add X card"
  const addMetricMatch = lower.match(
    /add (?:a |an |another |one more )?(?:metric )?card (?:called |named )?["']?([a-z0-9]+)["']?/,
  );
  if (addMetricMatch) {
    const label = addMetricMatch[1].charAt(0).toUpperCase() + addMetricMatch[1].slice(1);
    if (!next.metrics.some((m) => m.label.toLowerCase() === label.toLowerCase())) {
      next.metrics = [...next.metrics, { label, value: "0", tone: "default" as MetricTone }];
    }
    return next;
  }

  // Make primary button bigger
  if (
    lower.includes("button bigger") ||
    lower.includes("primary button bigger") ||
    (lower.includes("make") && lower.includes("bigger"))
  ) {
    next.primaryButton = { ...next.primaryButton, size: "lg" };
    return next;
  }

  // Change button text: "change button text to X"
  if (lower.includes("change") && lower.includes("button") && lower.includes("text")) {
    const toMatch = lower.match(/to\s+["']?([a-z0-9 ]+)["']?\s*$/);
    if (toMatch) {
      const text = toMatch[1].trim().replace(/\b\w/g, (c) => c.toUpperCase());
      next.primaryButton = { ...next.primaryButton, text };
      return next;
    }
  }

  // "Launch Workflow" keyword in any rename context
  if (lower.includes("launch workflow") && (lower.includes("change") || lower.includes("rename") || lower.includes("to"))) {
    next.primaryButton = { ...next.primaryButton, text: "Launch Workflow" };
    return next;
  }

  // Remove primary button
  if (lower.includes("remove") && lower.includes("primary button")) {
    next.primaryButton = { ...next.primaryButton, visible: false };
    return next;
  }

  // Make cards more rounded
  if (lower.includes("rounded") || lower.includes("rounder")) {
    next.cardsRounded = "2xl";
    return next;
  }

  // Warning badge on risk card
  if (lower.includes("warning badge") || (lower.includes("risk") && lower.includes("badge"))) {
    next.metrics = next.metrics.map((m) =>
      m.label.toLowerCase() === "risk"
        ? { ...m, badge: "Warning", tone: "warning" as MetricTone }
        : m,
    );
    return next;
  }

  // Default: make button bigger
  next.primaryButton = { ...next.primaryButton, size: "lg" };
  return next;
}
