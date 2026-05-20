import { evaluateAgentAction } from "@/lib/agentwingPolicy";
import {
  createReceipt,
  hasSavedE2BKey,
  incrementSandboxRunUsage,
  unauthorizedResponse,
  validateApiKeyFromRequest,
} from "@/lib/agentwingStore";
import type { AgentAction } from "@/lib/agentwingTypes";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const auth = await validateApiKeyFromRequest(request);
  if (!auth) return unauthorizedResponse();

  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const rawAction = body && typeof body === "object" && "action" in body ? (body.action as AgentAction) : undefined;
  const action = rawAction && auth.projectId ? { ...rawAction, projectId: auth.projectId } : rawAction;
  if (!action?.actionType) {
    return Response.json({ error: "Sandbox run requires an action." }, { status: 400 });
  }

  const usage = await incrementSandboxRunUsage(auth.apiKeyId);
  if (usage.sandboxRunsUsed > usage.sandboxRunLimit) {
    return Response.json(
      {
        ok: false,
        provider: "e2b-byok",
        mode: "dev-simulated",
        message: "Sandbox run limit reached for this API key.",
        usage,
      },
      { status: 429 },
    );
  }

  const evaluation = evaluateAgentAction(action);
  const receipt = await createReceipt(
    action,
    {
      ...evaluation,
      decision: "sandbox_required",
      provider: evaluation.provider ?? "e2b-byok",
    },
    auth.apiKeyId,
  );

  return Response.json({
    ok: (await hasSavedE2BKey(auth.apiKeyId)) || Boolean(process.env.E2B_API_KEY),
    provider: "e2b-byok",
    mode: "dev-simulated",
    receiptId: receipt.receiptId,
    stdout: "Sandbox run accepted by AgentWing dev abstraction.",
    stderr: "",
    message: "TODO: invoke the configured E2B or custom sandbox provider from this route.",
  });
}
