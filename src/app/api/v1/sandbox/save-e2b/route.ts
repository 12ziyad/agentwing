import { saveE2BKey } from "@/lib/agentwingStore";

export const runtime = "nodejs";

export async function POST(request: Request) {
  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const apiKey =
    body && typeof body === "object" && "apiKey" in body && typeof body.apiKey === "string"
      ? body.apiKey
      : "";

  try {
    const sandbox = await saveE2BKey(apiKey);
    return Response.json({
      ok: true,
      sandbox,
      message: "E2B key saved server-side. The raw key is never returned.",
    });
  } catch (error) {
    return Response.json(
      { ok: false, error: error instanceof Error ? error.message : "Unable to save E2B key." },
      { status: 400 },
    );
  }
}
