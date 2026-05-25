import type { SandboxResult } from "@/lib/types";

export const runtime = "nodejs";

function jsonResponse(body: SandboxResult, status = 200) {
  return Response.json(body, { status });
}

export async function POST() {
  return jsonResponse(
    {
      ok: false,
      stdout: "",
      stderr: "Legacy demo sandbox route is disabled in production hardening.",
      exitCode: 1,
      error: "Use /api/v1/sandbox/run for AgentWing V1 sandbox routing.",
    },
    410,
  );
}
