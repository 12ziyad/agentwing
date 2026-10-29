import { describe, expect, it } from "vitest";
import { evaluateAgentAction } from "@/lib/agentwingPolicy";
import { PLAYGROUND_PRESETS } from "@/lib/playgroundPresets";

/**
 * The public playground and the landing page show these presets as real
 * engine output. If the engine's answer for one changes, the page would be
 * wrong, so the preset has to be updated on purpose.
 */
describe("playground presets", () => {
  it.each(PLAYGROUND_PRESETS.map((p) => [p.label, p] as const))("%s", (_label, preset) => {
    expect(evaluateAgentAction(preset.action).decision).toBe(preset.expected);
  });

  it("covers all five decisions", () => {
    const seen = new Set(PLAYGROUND_PRESETS.map((p) => p.expected));
    expect([...seen].sort()).toEqual(
      ["allow", "approval_required", "block", "restore_point_required", "sandbox_required"],
    );
  });
});
