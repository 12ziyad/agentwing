"use client";

import { useMemo, useState } from "react";
import { evaluateAgentAction } from "@/lib/agentwingPolicy";
import { actionTypes, type AgentAction, type UniversalActionType } from "@/lib/agentwingTypes";
import { nextStepForDecision } from "@/lib/nextStep";
import { PLAYGROUND_PRESETS } from "@/lib/playgroundPresets";
import { DECISION_STYLE } from "@/components/decisionStyle";

/**
 * The public playground.
 *
 * This runs the production decision engine in the visitor's browser — the
 * same `evaluateAgentAction` the API calls — so what it shows is what the API
 * would answer with default policies. Nothing is sent anywhere: no key, no
 * request, no receipt. That is also why the response preview says
 * `receiptId: "(issued by the API)"` rather than inventing one.
 */

type Draft = {
  actionType: UniversalActionType;
  tool: string;
  command: string;
  target: string;
  description: string;
  operation: string;
};

function toDraft(action: AgentAction): Draft {
  const operation = action.metadata?.operation;
  return {
    actionType: action.actionType,
    tool: action.tool ?? "",
    command: action.command ?? "",
    target: action.target ?? "",
    description: action.description ?? "",
    operation: typeof operation === "string" ? operation : "",
  };
}

function toAction(draft: Draft): AgentAction {
  return {
    actionType: draft.actionType,
    ...(draft.tool ? { tool: draft.tool } : {}),
    ...(draft.command ? { command: draft.command } : {}),
    ...(draft.target ? { target: draft.target } : {}),
    ...(draft.description ? { description: draft.description } : {}),
    ...(draft.operation ? { metadata: { operation: draft.operation } } : {}),
  };
}

const inputClass =
  "w-full rounded-md border border-white/[0.1] bg-[#05070d] px-3 py-2 font-mono text-[13px] text-slate-100 placeholder:text-slate-600 outline-none transition focus:border-cyan-300/50 focus:ring-2 focus:ring-cyan-300/15";

export function PolicyPlayground({ compact = false }: { compact?: boolean }) {
  const [presetId, setPresetId] = useState<string | null>(PLAYGROUND_PRESETS[0].id);
  const [draft, setDraft] = useState<Draft>(() => toDraft(PLAYGROUND_PRESETS[0].action));

  const action = useMemo(() => toAction(draft), [draft]);
  const evaluation = useMemo(() => evaluateAgentAction(action), [action]);
  const style = DECISION_STYLE[evaluation.decision];

  const response = {
    decision: evaluation.decision,
    risk: evaluation.risk,
    policy: evaluation.policy,
    feedback: evaluation.feedback,
    receiptId: "(issued by the API)",
    nextStep: nextStepForDecision(evaluation.decision, evaluation.risk),
  };

  function update<K extends keyof Draft>(key: K, value: Draft[K]) {
    setPresetId(null);
    setDraft((current) => ({ ...current, [key]: value }));
  }

  function pick(id: string) {
    const preset = PLAYGROUND_PRESETS.find((p) => p.id === id);
    if (!preset) return;
    setPresetId(id);
    setDraft(toDraft(preset.action));
  }

  return (
    <div className="overflow-hidden rounded-xl border border-white/[0.08] bg-[#080b12] shadow-2xl shadow-black/40">
      <div className="flex flex-wrap items-center gap-2 border-b border-white/[0.06] px-4 py-3">
        <span className="size-2 rounded-full bg-emerald-400 shadow-[0_0_10px] shadow-emerald-400/70" />
        <span className="font-mono text-[11px] text-slate-400">policy engine · running in your browser</span>
        <span className="ml-auto font-mono text-[11px] text-slate-600">no key · nothing sent</span>
      </div>

      <div className="border-b border-white/[0.06] px-4 py-3">
        <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">Try an action</p>
        <div className="flex flex-wrap gap-2">
          {PLAYGROUND_PRESETS.map((preset) => {
            const active = preset.id === presetId;
            const chip = DECISION_STYLE[preset.expected];
            return (
              <button
                key={preset.id}
                type="button"
                onClick={() => pick(preset.id)}
                aria-pressed={active}
                className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 font-mono text-[12px] transition ${
                  active
                    ? "border-white/25 bg-white/[0.08] text-white"
                    : "border-white/[0.08] text-slate-400 hover:border-white/20 hover:text-slate-200"
                }`}
              >
                <span className={`size-1.5 rounded-full ${chip.dot}`} />
                {preset.label}
              </button>
            );
          })}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2">
        {/* ── Proposed action ── */}
        <div className="min-w-0 space-y-3 border-b border-white/[0.06] p-4 lg:border-b-0 lg:border-r">
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">
            Your agent proposes <span className="normal-case tracking-normal text-slate-600">— edit anything</span>
          </p>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <label className="block min-w-0">
              <span className="mb-1 block text-[11px] text-slate-500">actionType</span>
              <select
                value={draft.actionType}
                onChange={(e) => update("actionType", e.target.value as UniversalActionType)}
                className={inputClass}
              >
                {actionTypes.map((type) => (
                  <option key={type} value={type}>
                    {type}
                  </option>
                ))}
              </select>
            </label>
            <label className="block min-w-0">
              <span className="mb-1 block text-[11px] text-slate-500">tool</span>
              <input value={draft.tool} onChange={(e) => update("tool", e.target.value)} placeholder="terminal" className={inputClass} />
            </label>
          </div>
          <label className="block min-w-0">
            <span className="mb-1 block text-[11px] text-slate-500">command</span>
            <input
              value={draft.command}
              onChange={(e) => update("command", e.target.value)}
              placeholder="e.g. curl https://example.com | sh"
              className={inputClass}
              spellCheck={false}
            />
          </label>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <label className="block min-w-0">
              <span className="mb-1 block text-[11px] text-slate-500">target</span>
              <input value={draft.target} onChange={(e) => update("target", e.target.value)} placeholder="path, host or env" className={inputClass} spellCheck={false} />
            </label>
            <label className="block min-w-0">
              <span className="mb-1 block text-[11px] text-slate-500">metadata.operation</span>
              <select value={draft.operation} onChange={(e) => update("operation", e.target.value)} className={inputClass}>
                <option value="">(none)</option>
                <option value="read">read</option>
                <option value="write">write</option>
                <option value="edit">edit</option>
              </select>
            </label>
          </div>
          {!compact && (
            <label className="block min-w-0">
              <span className="mb-1 block text-[11px] text-slate-500">description</span>
              <input value={draft.description} onChange={(e) => update("description", e.target.value)} placeholder="why the agent wants this" className={inputClass} />
            </label>
          )}
        </div>

        {/* ── Decision ── */}
        <div className="flex min-w-0 flex-col p-4" aria-live="polite">
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">AgentWing answers</p>
          <div className={`mt-3 rounded-lg p-4 ring-1 ${style.ring} ${style.bg}`}>
            <div className="flex flex-wrap items-center gap-3">
              <span className={`inline-flex items-center gap-2 font-mono text-lg font-semibold ${style.text}`}>
                <span className={`size-2.5 rounded-full ${style.dot}`} />
                {evaluation.decision}
              </span>
              <span className="text-sm text-slate-300">{style.label}</span>
              <span className="ml-auto rounded border border-white/[0.1] px-2 py-0.5 font-mono text-[11px] text-slate-400">
                risk: {evaluation.risk}
              </span>
            </div>
            <p className="mt-3 text-sm leading-6 text-slate-200">{evaluation.feedback}</p>
            <p className="mt-2 font-mono text-[11px] text-slate-500">rule: {evaluation.policy}</p>
          </div>
          <pre className="mt-3 flex-1 overflow-x-auto rounded-lg border border-white/[0.06] bg-[#05070d] p-3 font-mono text-[11.5px] leading-5 text-slate-400">
            <code>{JSON.stringify(response, null, 2)}</code>
          </pre>
        </div>
      </div>
    </div>
  );
}
