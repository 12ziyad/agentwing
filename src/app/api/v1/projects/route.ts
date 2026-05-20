import { createProject, listProjects } from "@/lib/agentwingStore";

export const runtime = "nodejs";

export async function GET() {
  return Response.json({
    projects: await listProjects(),
  });
}

export async function POST(request: Request) {
  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const name = body && typeof body === "object" && "name" in body && typeof body.name === "string" ? body.name : "";

  try {
    const project = await createProject(name);
    return Response.json({ project }, { status: 201 });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Unable to create project." },
      { status: 400 },
    );
  }
}
