import { createProject, listProjects, trackEvent } from "@/lib/agentwingStore";
import { authRequiredResponse, getDashboardAuth } from "@/lib/auth";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const auth = await getDashboardAuth(request);
  if (!auth) return authRequiredResponse();

  return Response.json({
    projects: await listProjects(auth.workspaceId),
  });
}

export async function POST(request: Request) {
  const auth = await getDashboardAuth(request);
  if (!auth) return authRequiredResponse();

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
      userId: auth.mode === "user" ? auth.user.userId : undefined,
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
