import { getUsageForApiKey, unauthorizedResponse, validateApiKeyFromRequest } from "@/lib/agentwingStore";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const auth = await validateApiKeyFromRequest(request);
  if (!auth) return unauthorizedResponse();

  return Response.json({
    usage: await getUsageForApiKey(auth.apiKeyId),
  });
}
