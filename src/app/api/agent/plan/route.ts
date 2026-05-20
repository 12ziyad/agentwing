// TODO: add 3 demo runs per IP/session for public abuse protection.
import type {
  AgentPlan,
  AgentPlanFailure,
  ChangeHistoryEntry,
  MetricTone,
  PreviewMetric,
  PreviewModel,
  RepairContext,
  SecondaryButton,
  StatusColor,
  ButtonSize,
  CardsRounded,
} from "@/lib/types";
import { generateAppJsx, generateStylesCss } from "@/lib/previewModel";

export const runtime = "nodejs";

type PlanRequest = {
  task?: unknown;
  previewModel?: unknown;
  currentPreviewModel?: unknown;
  files?: unknown;
  changeHistory?: unknown;
  repairContext?: unknown;
};

const METRIC_TONES = new Set<string>(["default", "success", "warning", "danger"]);
const STATUS_COLORS = new Set<string>(["green", "blue", "red", "yellow"]);
const BUTTON_SIZES = new Set<string>(["sm", "md", "lg"]);
const CARDS_ROUNDED = new Set<string>(["md", "lg", "xl", "2xl"]);

function parseMetric(raw: unknown): PreviewMetric | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const m = raw as Record<string, unknown>;
  if (typeof m.label !== "string" || typeof m.value !== "string") return null;
  return {
    label: m.label,
    value: m.value,
    tone: (m.tone != null && typeof m.tone === "string" && METRIC_TONES.has(m.tone))
      ? (m.tone as MetricTone)
      : undefined,
    badge: (m.badge != null && typeof m.badge === "string") ? m.badge : undefined,
  };
}

function parseSecondaryButton(raw: unknown): SecondaryButton | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const b = raw as Record<string, unknown>;
  if (typeof b.text !== "string" || typeof b.visible !== "boolean") return null;
  return { text: b.text, visible: b.visible };
}

function isPreviewModel(value: unknown): value is PreviewModel {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const m = value as Record<string, unknown>;
  if (
    typeof m.title !== "string" ||
    typeof m.subtitle !== "string" ||
    typeof m.eyebrow !== "string" ||
    typeof m.showStatusPill !== "boolean" ||
    typeof m.statusText !== "string" ||
    !STATUS_COLORS.has(m.statusColor as string) ||
    !Array.isArray(m.metrics) ||
    !m.primaryButton || typeof m.primaryButton !== "object" || Array.isArray(m.primaryButton) ||
    !CARDS_ROUNDED.has(m.cardsRounded as string) ||
    !Array.isArray(m.activityItems)
  ) {
    return false;
  }
  const btn = m.primaryButton as Record<string, unknown>;
  if (
    typeof btn.text !== "string" ||
    !BUTTON_SIZES.has(btn.size as string) ||
    typeof btn.visible !== "boolean"
  ) {
    return false;
  }
  return true;
}

function normalizePreviewModel(raw: unknown): PreviewModel | null {
  if (!isPreviewModel(raw)) return null;
  const m = raw as Record<string, unknown>;
  const metrics = (m.metrics as unknown[])
    .map(parseMetric)
    .filter((x): x is PreviewMetric => x !== null);
  const btn = m.primaryButton as Record<string, unknown>;
  const secondaryButtons = Array.isArray(m.secondaryButtons)
    ? (m.secondaryButtons as unknown[])
        .map(parseSecondaryButton)
        .filter((b): b is SecondaryButton => b !== null)
    : [];
  return {
    title: m.title as string,
    subtitle: m.subtitle as string,
    eyebrow: m.eyebrow as string,
    showStatusPill: m.showStatusPill as boolean,
    statusText: m.statusText as string,
    statusColor: m.statusColor as StatusColor,
    metrics,
    primaryButton: {
      text: btn.text as string,
      size: btn.size as ButtonSize,
      visible: btn.visible as boolean,
    },
    secondaryButtons,
    cardsRounded: m.cardsRounded as CardsRounded,
    activityItems: (m.activityItems as unknown[]).filter((x) => typeof x === "string") as string[],
  };
}

function hasSuspiciousContent(model: PreviewModel): boolean {
  const pattern = /<script\b|<\/script>|https?:\/\/|fetch\s*\(|XMLHttpRequest|WebSocket|EventSource|import\s*\(/i;
  const strings = [
    model.title,
    model.subtitle,
    model.eyebrow,
    model.statusText,
    model.primaryButton.text,
    ...model.metrics.flatMap((m) => [m.label, m.value, m.badge ?? ""]),
    ...(model.secondaryButtons ?? []).map((b) => b.text),
    ...model.activityItems,
  ];
  return strings.some((s) => pattern.test(s));
}

function fallbackResponse(error: string, status = 502) {
  const body: AgentPlanFailure = { ok: false, mode: "fallback", error };
  return Response.json(body, { status });
}

function extractOutputText(response: unknown) {
  const outputText = (response as { output_text?: unknown }).output_text;
  if (typeof outputText === "string") return outputText;
  const output = (response as { output?: unknown }).output;
  if (!Array.isArray(output)) return undefined;
  for (const item of output) {
    const content = (item as { content?: unknown }).content;
    if (!Array.isArray(content)) continue;
    for (const part of content) {
      const text = (part as { text?: unknown }).text;
      if (typeof text === "string") return text;
    }
  }
  return undefined;
}

function buildSchema() {
  return {
    type: "object",
    additionalProperties: false,
    required: ["updatedModel", "explanation", "summary", "affectedElements"],
    properties: {
      updatedModel: {
        type: "object",
        additionalProperties: false,
        required: [
          "title", "subtitle", "eyebrow", "showStatusPill", "statusText",
          "statusColor", "metrics", "primaryButton", "secondaryButtons",
          "cardsRounded", "activityItems",
        ],
        properties: {
          title: { type: "string" },
          subtitle: { type: "string" },
          eyebrow: { type: "string" },
          showStatusPill: { type: "boolean" },
          statusText: { type: "string" },
          statusColor: { type: "string", enum: ["green", "blue", "red", "yellow"] },
          metrics: {
            type: "array",
            items: {
              type: "object",
              additionalProperties: false,
              required: ["label", "value", "tone", "badge"],
              properties: {
                label: { type: "string" },
                value: { type: "string" },
                tone: {
                  anyOf: [
                    { type: "string", enum: ["default", "success", "warning", "danger"] },
                    { type: "null" },
                  ],
                },
                badge: { anyOf: [{ type: "string" }, { type: "null" }] },
              },
            },
          },
          primaryButton: {
            type: "object",
            additionalProperties: false,
            required: ["text", "size", "visible"],
            properties: {
              text: { type: "string" },
              size: { type: "string", enum: ["sm", "md", "lg"] },
              visible: { type: "boolean" },
            },
          },
          secondaryButtons: {
            type: "array",
            items: {
              type: "object",
              additionalProperties: false,
              required: ["text", "visible"],
              properties: {
                text: { type: "string" },
                visible: { type: "boolean" },
              },
            },
          },
          cardsRounded: { type: "string", enum: ["md", "lg", "xl", "2xl"] },
          activityItems: { type: "array", items: { type: "string" } },
        },
      },
      explanation: { type: "string" },
      summary: { type: "string" },
      affectedElements: { type: "array", items: { type: "string" } },
    },
  };
}

function parseChangeHistory(raw: unknown): ChangeHistoryEntry[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter(
    (e): e is ChangeHistoryEntry =>
      e && typeof e === "object" &&
      typeof (e as Record<string, unknown>).summary === "string",
  );
}

function parseRepairContext(raw: unknown): RepairContext | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const r = raw as Record<string, unknown>;
  if (typeof r.verifierReason !== "string" || typeof r.task !== "string") return null;
  const previousModel = normalizePreviewModel(r.previousModel);
  const failedModel = normalizePreviewModel(r.failedModel);
  if (!previousModel || !failedModel) return null;
  return {
    verifierReason: r.verifierReason,
    previousModel,
    failedModel,
    task: r.task,
    instruction: typeof r.instruction === "string" ? r.instruction : "Repair while preserving all previous changes.",
  };
}

export async function POST(request: Request) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return fallbackResponse(
      "OPENAI_API_KEY is missing on the server. Add it as a local env var, .dev.vars, or Cloudflare secret.",
      500,
    );
  }

  let body: PlanRequest;
  try {
    body = (await request.json()) as PlanRequest;
  } catch {
    return fallbackResponse("Invalid JSON request body.", 400);
  }

  if (typeof body.task !== "string" || !body.task.trim()) {
    return fallbackResponse("Task is required.", 400);
  }

  // Accept both field names for the current model
  const rawModel = body.currentPreviewModel ?? body.previewModel;
  if (!isPreviewModel(rawModel)) {
    return fallbackResponse("currentPreviewModel must be a valid PreviewModel object.", 400);
  }

  const task = body.task.trim().slice(0, 500);
  const currentModel = normalizePreviewModel(rawModel)!;
  const changeHistory = parseChangeHistory(body.changeHistory);
  const repairContext = parseRepairContext(body.repairContext);
  const model = process.env.OPENAI_MODEL ?? "gpt-4.1-mini";

  const historyBlock = changeHistory.length > 0
    ? `\nPrevious committed changes (must be preserved unless new task overrides them):\n${changeHistory.map((e) => `  - ${e.summary}`).join("\n")}`
    : "";

  const repairBlock = repairContext
    ? `\nREPAIR MODE: Previous attempt failed — "${repairContext.verifierReason}"\nInstruction: ${repairContext.instruction}\nFailed model snapshot: ${JSON.stringify(repairContext.failedModel)}`
    : "";

  const systemPrompt = `You are the UI model brain for AgentWing Live Agent Lab.
You are editing the CURRENT COMMITTED AgentOps dashboard state.
You receive a PreviewModel (the current committed UI state) and a user task.
You return an updated PreviewModel that reflects ONLY the requested visible UI change.
Return strict JSON only — no markdown fences, no extra keys.

CRITICAL PRESERVATION RULES — read carefully:
- Preserve ALL existing metrics unless the task explicitly asks to remove or change them.
- Preserve ALL secondaryButtons (visible ones) unless the task explicitly removes them.
- Preserve primaryButton.text unless the task asks to change it.
- Preserve primaryButton.visible unless the task asks to remove it.
- Preserve showStatusPill unless the task asks to change it.
- Preserve title, subtitle, eyebrow unless explicitly asked.
- Preserve activityItems unless explicitly asked.
- ONLY change the field(s) explicitly mentioned in the task.
- Make MINIMAL, PRECISE changes — do not "helpfully" reset unrelated fields.
${historyBlock}

Specific action rules:
- "remove active button" / "remove status pill": set showStatusPill to false.
- "remove Tasks metric": filter out the metric with label "Tasks".
- "make risk card red" / "risk danger": set Risk metric tone to "danger" and value to "High". Keep all other metrics.
- "add Agents metric card": add { label: "Agents", value: "12", tone: "default", badge: null } to metrics. Keep existing metrics.
- "make primary button bigger": set primaryButton.size to "lg". Keep text and visibility.
- "change button text to X": set primaryButton.text to X. Keep size and visibility.
- "make cards more rounded": set cardsRounded to "2xl".
- "remove primary button": set primaryButton.visible to false.
- "add button called X": add { text: "X", visible: true } to secondaryButtons.
- "remove button called X": set the matching secondaryButton's visible to false.
- If unclear, make a minimal safe visible improvement.${repairBlock}`;

  const userContent = JSON.stringify({
    task,
    currentModel,
  });

  let response: Response;
  try {
    response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        authorization: `Bearer ${apiKey}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model,
        input: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userContent },
        ],
        text: {
          format: {
            type: "json_schema",
            name: "agentwing_ui_model_update",
            strict: true,
            schema: buildSchema(),
          },
        },
        max_output_tokens: 4000,
      }),
    });
  } catch (error) {
    return fallbackResponse(error instanceof Error ? error.message : "OpenAI planning request failed.");
  }

  if (!response.ok) {
    const errorText = await response.text();
    return fallbackResponse(`OpenAI planning failed with ${response.status}: ${errorText.slice(0, 500)}`);
  }

  const rawResponse = (await response.json()) as unknown;
  const outputText = extractOutputText(rawResponse);
  if (!outputText) {
    return fallbackResponse("OpenAI response did not include output text.");
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(outputText);
  } catch {
    return fallbackResponse("OpenAI response was not valid JSON.");
  }

  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    return fallbackResponse("OpenAI response was not an object.");
  }

  const result = parsed as Record<string, unknown>;
  const updatedModel = normalizePreviewModel(result.updatedModel);
  if (!updatedModel) {
    return fallbackResponse("OpenAI response did not contain a valid updatedModel.");
  }

  if (hasSuspiciousContent(updatedModel)) {
    return fallbackResponse("OpenAI model update contained disallowed content.", 422);
  }

  const changedFiles = {
    "src/App.jsx": generateAppJsx(updatedModel),
    "src/styles.css": generateStylesCss(updatedModel),
  };

  const affectedElements = Array.isArray(result.affectedElements)
    ? (result.affectedElements as unknown[]).filter((x): x is string => typeof x === "string")
    : [];

  const plan: AgentPlan = {
    ok: true,
    mode: "llm",
    updatedModel,
    changedFiles,
    explanation: typeof result.explanation === "string" ? result.explanation : "UI model updated.",
    summary: typeof result.summary === "string" ? result.summary : task,
    affectedElements,
    modelUsed: model,
  };

  return Response.json(plan);
}
