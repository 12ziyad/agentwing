import { createCustomPolicy, listCustomPolicies, PolicyStoreUnavailableError, trackEvent } from "@/lib/agentwingStore";
import { authRequiredResponse, getDashboardAuth } from "@/lib/auth";
import { assertHasCriteria, parsePolicyInput, PolicyInputError } from "@/lib/policyInput";

export const runtime = "nodejs";

function errorResponse(error: unknown) {
  if (error instanceof PolicyInputError) {
    return Response.json({ error: error.message, code: error.code }, { status: error.status });
  }
  if (error instanceof PolicyStoreUnavailableError) {
    return Response.json(
      { error: error.message, code: error.code },
      { status: error.status, headers: { "retry-after": "5" } },
    );
  }
  return undefined;
}

export async function GET(request: Request) {
  const auth = await getDashboardAuth(request);
  if (!auth) return authRequiredResponse();

  const { searchParams } = new URL(request.url);
  const projectId = searchParams.get("projectId") ?? undefined;

  try {
    return Response.json({ policies: await listCustomPolicies(auth.workspaceId, projectId) });
  } catch (error) {
    return errorResponse(error) ?? Response.json({ error: "Unable to list policies." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const auth = await getDashboardAuth(request);
  if (!auth) return authRequiredResponse();

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON body.", code: "invalid_json" }, { status: 400 });
  }

  try {
    const input = parsePolicyInput(body);
    assertHasCriteria(input);

    const policy = await createCustomPolicy(auth.workspaceId, {
      projectId: input.projectId,
      name: input.name!,
      description: input.description,
      actionType: input.actionType,
      tool: input.tool,
      targetPattern: input.targetPattern,
      commandPattern: input.commandPattern,
      decision: input.decision!,
      risk: input.risk!,
      priority: input.priority ?? 100,
      feedback: input.feedback,
    });

    await trackEvent("custom_policy_created", {
      workspaceId: auth.workspaceId,
      userId: auth.user.userId,
      projectId: policy.projectId,
      metadata: { policyId: policy.policyId, name: policy.name },
    });

    return Response.json({ policy }, { status: 201 });
  } catch (error) {
    return (
      errorResponse(error) ??
      Response.json(
        { error: error instanceof Error ? error.message : "Unable to create policy.", code: "policy_create_failed" },
        { status: 400 },
      )
    );
  }
}
