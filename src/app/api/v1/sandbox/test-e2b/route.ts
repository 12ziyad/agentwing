import { getE2BApiKeyForExecution, getSandboxConfig } from "@/lib/agentwingStore";

export const runtime = "nodejs";

export async function POST() {
  const [apiKey, sandbox] = await Promise.all([getE2BApiKeyForExecution(), getSandboxConfig()]);

  if (!apiKey) {
    return Response.json(
      {
        ok: false,
        provider: "e2b-byok",
        sandbox,
        message: "No E2B API key is saved server-side. Save a BYOK key first.",
      },
      { status: 400 },
    );
  }

  return Response.json({
    ok: true,
    provider: "e2b-byok",
    sandbox,
    message: "E2B BYOK configuration is present server-side. Runtime sandbox execution is enabled.",
  });
}
