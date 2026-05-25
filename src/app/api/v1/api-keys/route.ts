import { generateApiKey, listApiKeys } from "@/lib/agentwingStore";
import { authRequiredResponse, getDashboardAuth } from "@/lib/auth";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const auth = await getDashboardAuth(request);
  if (!auth) return authRequiredResponse();

  const { searchParams } = new URL(request.url);
  const projectId = searchParams.get("projectId") ?? undefined;

  return Response.json({
    apiKeys: await listApiKeys(projectId, auth.workspaceId),
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

  const projectId =
    body && typeof body === "object" && "projectId" in body && typeof body.projectId === "string"
      ? body.projectId
      : "";

  try {
    const result = await generateApiKey(projectId, auth.workspaceId);
    return Response.json(
      {
        apiKey: result.apiKey,
        apiKeyRecord: result.record,
      },
      { status: 201 },
    );
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Unable to generate API key." },
      { status: 400 },
    );
  }
}
