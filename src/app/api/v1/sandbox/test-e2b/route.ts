import { hasSavedE2BKey } from "@/lib/agentwingStore";

export const runtime = "nodejs";

export async function POST() {
  if (!(await hasSavedE2BKey()) && !process.env.E2B_API_KEY) {
    return Response.json(
      {
        ok: false,
        provider: "e2b-byok",
        message: "No E2B API key is saved server-side. Save a BYOK key first.",
      },
      { status: 400 },
    );
  }

  return Response.json({
    ok: true,
    provider: "e2b-byok",
    message: "E2B BYOK configuration is present server-side. Live sandbox execution can be enabled from this abstraction.",
  });
}
