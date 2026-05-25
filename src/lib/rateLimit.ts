import type { ApiKeyUsage } from "./agentwingTypes";

export function actionCheckLimitExceeded(usage: ApiKeyUsage) {
  return usage.actionChecksUsed > usage.actionCheckLimit;
}

export function sandboxRunLimitExceeded(usage: ApiKeyUsage) {
  return usage.sandboxRunsUsed > usage.sandboxRunLimit;
}

export function actionCheckLimitResponse(usage: ApiKeyUsage) {
  return Response.json(
    {
      decision: "block",
      risk: "medium",
      policy: "plan-limit-action-checks",
      feedback: "Action check limit reached for this API key.",
      usage,
    },
    { status: 429 },
  );
}

export function sandboxRunLimitResponse(usage: ApiKeyUsage) {
  return Response.json(
    {
      ok: false,
      provider: "e2b-byok",
      mode: "dev-simulated",
      decision: "block",
      risk: "medium",
      policy: "plan-limit-sandbox-runs",
      feedback: "Sandbox run limit reached for this API key.",
      message: "Sandbox run limit reached for this API key.",
      usage,
    },
    { status: 429 },
  );
}
