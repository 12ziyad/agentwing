"use client";

import { useState } from "react";
import { ArrowRight, Terminal } from "lucide-react";
import { DECISION_STYLE } from "@/components/decisionStyle";
import { evaluateAgentAction } from "@/lib/agentwingPolicy";
import { PLAYGROUND_PRESETS } from "@/lib/playgroundPresets";
import styles from "./landing.module.css";

const cases = [
  { id: "git-status", label: "Check repo status" },
  { id: "read-env", label: "Read a secret file" },
  { id: "deploy", label: "Deploy to production" },
  { id: "npm-install", label: "Install a package" },
  { id: "edit-auth", label: "Edit a source file" },
] as const;

const examples = cases.map(({ id, label }) => {
  const preset = PLAYGROUND_PRESETS.find((preset) => preset.id === id);
  if (!preset) throw new Error(`Missing playground preset: ${id}`);
  return {
    id,
    label,
    action: preset.action.command ?? preset.label,
    evaluation: evaluateAgentAction(preset.action),
  };
});

export function PolicyDemo() {
  const [selected, setSelected] = useState(examples[0]);
  const { decision, feedback, policy } = selected.evaluation;
  const decisionStyle = DECISION_STYLE[decision];

  return (
    <div className={styles.demo}>
      <div className={styles.panelBar}>
        <Terminal size={16} aria-hidden />
        <span>Policy engine</span>
        <span className={styles.panelMeta}>Default rules</span>
      </div>
      <div className={styles.demoBody}>
        <div className={styles.demoOptions} role="group" aria-label="Example tool calls">
          {examples.map((example) => (
            <button
              key={example.id}
              type="button"
              aria-pressed={selected.id === example.id}
              onClick={() => setSelected(example)}
            >
              {example.label}
              <ArrowRight size={14} aria-hidden />
            </button>
          ))}
        </div>
        <div className={styles.demoOutput} aria-live="polite" aria-atomic="true">
          <p className={styles.fieldLabel}>Proposed action</p>
          <div className={styles.actionLine}><code>{selected.action}</code></div>
          <p className={styles.fieldLabel}>Decision</p>
          <div className={`${styles.verdict} ${decisionStyle.text}`} data-decision={decision}>
            <span className={decisionStyle.dot} aria-hidden />
            <code>{decision}</code>
          </div>
          <p className={styles.feedback}>{feedback}</p>
          <p className={styles.rule}>Rule <code>{policy}</code></p>
        </div>
      </div>
    </div>
  );
}
