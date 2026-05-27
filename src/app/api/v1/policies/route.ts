import { createCustomPolicy, listCustomPolicies, trackEvent } from "@/lib/agentwingStore";
import { authRequiredResponse, getDashboardAuth } from "@/lib/auth";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const auth = await getDashboardAuth(request);
  if (!auth) return authRequiredResponse();
  if (!auth.workspaceId) return Response.json({ policies: [] });

  const { searchParams } = new URL(request.url);
  const projectId = searchParams.get("projectId") ?? undefined;

  return Response.json({
    policies: await listCustomPolicies(auth.workspaceId, projectId),
  });
}

export async function POST(request: Request) {
  const auth = await getDashboardAuth(request);
  if (!auth) return authRequiredResponse();
  if (!auth.workspaceId) {
    return Response.json({ error: "Workspace required." }, { status: 400 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  if (!body || typeof body !== "object") {
    return Response.json({ error: "Invalid request body." }, { status: 400 });
  }

  const b = body as Record<string, unknown>;
  const name = typeof b.name === "string" ? b.name.trim() : "";
  if (!name) return Response.json({ error: "Policy name is required." }, { status: 400 });

  const decision = typeof b.decision === "string" ? b.decision : "allow";
  const validDecisions = ["allow", "block", "approval_required", "sandbox_required", "restore_point_required"];
  if (!validDecisions.includes(decision)) {
    return Response.json({ error: "Invalid decision value." }, { status: 400 });
  }

  const risk = typeof b.risk === "string" ? b.risk : "low";
  const validRisks = ["low", "medium", "high", "critical"];
  if (!validRisks.includes(risk)) {
    return Response.json({ error: "Invalid risk value." }, { status: 400 });
  }

  try {
    const policy = await createCustomPolicy(auth.workspaceId, {
      projectId: typeof b.projectId === "string" ? b.projectId : undefined,
      name,
      description: typeof b.description === "string" ? b.description : undefined,
      actionType: typeof b.actionType === "string" ? b.actionType : undefined,
      tool: typeof b.tool === "string" ? b.tool : undefined,
      targetPattern: typeof b.targetPattern === "string" ? b.targetPattern : undefined,
      commandPattern: typeof b.commandPattern === "string" ? b.commandPattern : undefined,
      decision,
      risk,
      priority: typeof b.priority === "number" ? b.priority : 100,
      feedback: typeof b.feedback === "string" ? b.feedback : undefined,
    });

    await trackEvent("custom_policy_created", {
      workspaceId: auth.workspaceId,
      userId: auth.mode === "user" ? auth.user.userId : undefined,
      projectId: policy.projectId,
      metadata: { policyId: policy.policyId, name: policy.name },
    });

    return Response.json({ policy }, { status: 201 });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Unable to create policy." },
      { status: 400 },
    );
  }
}
