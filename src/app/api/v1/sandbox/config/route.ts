import { getSandboxConfig } from "@/lib/agentwingStore";

export const runtime = "nodejs";

export async function GET() {
  return Response.json({
    sandbox: await getSandboxConfig(),
  });
}
