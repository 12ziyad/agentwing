import { authRequiredResponse, getDashboardAuth } from "@/lib/auth";
import { getE2BApiKeyForExecution, getSandboxConfig, recordE2BTestResult, sandboxOwnerKeyForWorkspace } from "@/lib/agentwingStore";
import type { AgentAction } from "@/lib/agentwingTypes";
import { runE2BSandbox } from "@/lib/sandbox/providers/e2b";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const auth = await getDashboardAuth(request);
  if (!auth) return authRequiredResponse();

  const sandboxOwnerId = sandboxOwnerKeyForWorkspace(auth.workspaceId);
  const [apiKey, sandbox] = await Promise.all([
    getE2BApiKeyForExecution(sandboxOwnerId, auth.workspaceId),
    getSandboxConfig(sandboxOwnerId),
  ]);

  if (!apiKey || !sandbox.connected) {
    const nextSandbox = await recordE2BTestResult("failed", sandboxOwnerId);
    return Response.json(
      {
        ok: false,
        provider: "e2b-byok",
        sandbox: nextSandbox,
        message: "No E2B API key is saved server-side. Save a BYOK key first.",
      },
      { status: 400 },
    );
  }

  const action: AgentAction = {
    projectId: "runtime-lab",
    sessionId: "e2b-provider-test",
    agentId: "agentwing-dashboard",
    actionType: "shell_command",
    tool: "terminal",
    target: "e2b sandbox",
    command: "node -e \"console.log('agentwing-e2b-ok')\"",
    description: "Test E2B BYOK sandbox connection",
  };

  try {
    const result = await runE2BSandbox({
      apiKey,
      command: action.command!,
      action,
      projectId: action.projectId,
      sessionId: action.sessionId,
    });
    const testStatus = result.exitCode === 0 ? "success" : "failed";
    const testError = result.exitCode !== 0 ? (result.error ?? "Non-zero exit code") : undefined;
    const nextSandbox = await recordE2BTestResult(testStatus, sandboxOwnerId, testError);

    if (result.exitCode !== 0 || result.error) {
      return Response.json(
        {
          ok: false,
          provider: "e2b-byok",
          sandbox: nextSandbox,
          message: result.error ?? "E2B test command completed with a non-zero exit code.",
        },
        { status: 502 },
      );
    }

    return Response.json({
      ok: true,
      provider: "e2b-byok",
      sandbox: nextSandbox,
      message: "E2B BYOK connection test succeeded. Runtime sandbox execution is enabled.",
    });
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : "E2B connection test failed.";
    const nextSandbox = await recordE2BTestResult("failed", sandboxOwnerId, errMsg);
    return Response.json(
      {
        ok: false,
        provider: "e2b-byok",
        sandbox: nextSandbox,
        message: errMsg,
      },
      { status: 502 },
    );
  }
}
