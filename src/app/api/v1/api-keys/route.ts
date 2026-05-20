import { generateApiKey, listApiKeys } from "@/lib/agentwingStore";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const projectId = searchParams.get("projectId") ?? undefined;

  return Response.json({
    apiKeys: await listApiKeys(projectId),
  });
}

export async function POST(request: Request) {
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
    const result = await generateApiKey(projectId);
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
