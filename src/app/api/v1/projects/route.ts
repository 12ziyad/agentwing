import { createProject, listProjects, trackEvent } from "@/lib/agentwingStore";
import { authRequiredResponse, getDashboardAuth } from "@/lib/auth";
import { ForbiddenError, forbiddenResponse, requireCapability } from "@/lib/rbac";
import { withRoute } from "@/lib/withRoute";

export const runtime = "nodejs";

async function handleGET(request: Request) {
  const auth = await getDashboardAuth(request);
  if (!auth) return authRequiredResponse();

  return Response.json({
    projects: await listProjects(auth.workspaceId),
  });
}

async function handlePOST(request: Request) {
  const auth = await getDashboardAuth(request);
  if (!auth) return authRequiredResponse();

  try {
    requireCapability(auth, "project:write");
  } catch (error) {
    if (error instanceof ForbiddenError) return forbiddenResponse(error);
    throw error;
  }

  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const name = body && typeof body === "object" && "name" in body && typeof body.name === "string" ? body.name : "";

  try {
    const project = await createProject(name, auth.workspaceId);
    await trackEvent("project_created", {
      workspaceId: auth.workspaceId,
      userId: auth.user.userId,
      projectId: project.projectId,
      metadata: { name: project.name },
    });
    return Response.json({ project }, { status: 201 });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Unable to create project." },
      { status: 400 },
    );
  }
}

export const GET = withRoute("v1/projects", handleGET);

export const POST = withRoute("v1/projects", handlePOST);
