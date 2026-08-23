import { getApiKeyFromRequest, getUsageForApiKey, getUsageForWorkspace, unauthorizedResponse, validateApiKeyFromRequest } from "@/lib/agentwingStore";
import { authRequiredResponse, getDashboardAuth } from "@/lib/auth";
import { withRoute } from "@/lib/withRoute";

export const runtime = "nodejs";

async function handleGET(request: Request) {
  if (getApiKeyFromRequest(request)) {
    const auth = await validateApiKeyFromRequest(request);
    if (!auth) return unauthorizedResponse();

    return Response.json({
      usage: await getUsageForApiKey(auth.apiKeyId),
    });
  }

  const dashboardAuth = await getDashboardAuth(request);
  if (!dashboardAuth) return authRequiredResponse();

  return Response.json({
    usage: await getUsageForWorkspace(dashboardAuth.workspaceId),
  });
}

export const GET = withRoute("v1/usage", handleGET);
