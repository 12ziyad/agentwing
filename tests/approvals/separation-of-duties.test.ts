import { describe, expect, it } from "vitest";
import { createApprovalHandoff } from "@/lib/actionRunLifecycle";
import type { ActionRun } from "@/lib/agentwingTypes";

/**
 * An agent must not be able to approve its own action.
 *
 * `POST /api/v1/execute-action` is called *by the agent whose action is being
 * gated*. Its response used to include the single-use token that approves that
 * action, and the approve endpoint required nothing else. Two calls -- propose,
 * then approve with the token you were just handed -- flipped the run to
 * approved, and the trail recorded "Human approval was recorded."
 *
 * The audit log did not merely fail to notice. It asserted something false.
 *
 * The response is now a handoff: where a human can approve, and how to poll.
 * No credential crosses back to the principal being policed.
 */

const pendingRun = {
  runId: "run_abc123",
  workspaceId: "ws_1",
  approvalId: "apr_1",
  status: "waiting_approval",
  decision: "approval_required",
} as unknown as ActionRun;

describe("the approval handoff", () => {
  it("carries no credential of any kind", async () => {
    const handoff = await createApprovalHandoff({
      run: pendingRun,
      origin: "https://agentwing.example",
      surface: "cli",
      runnerId: "my-runner",
    });

    const serialized = JSON.stringify(handoff);

    // Nothing token-shaped, under any key name.
    expect(serialized).not.toMatch(/aw_rat_/);
    expect(serialized).not.toMatch(/aw_live_/);
    expect(Object.keys(handoff)).not.toContain("runnerApprovalToken");
    expect(Object.keys(handoff)).not.toContain("token");
    expect(Object.keys(handoff)).not.toContain("approveEndpoint");
    expect(Object.keys(handoff)).not.toContain("rejectEndpoint");
  });

  it("tells the agent where a human can approve and how to wait", async () => {
    const handoff = await createApprovalHandoff({
      run: pendingRun,
      origin: "https://agentwing.example/",
      surface: "cli",
    });

    expect(handoff.approvalUrl).toBe("https://agentwing.example/dashboard/runs/run_abc123");
    expect(handoff.statusUrl).toBe("https://agentwing.example/api/v1/action-runs/run_abc123");
    expect(handoff.surface).toBe("dashboard");
    expect(handoff.instructions).toMatch(/human/i);
  });

  it("preserves the requested surface for the operator's context without acting on it", async () => {
    const handoff = await createApprovalHandoff({
      run: pendingRun,
      origin: "https://agentwing.example",
      surface: "ide",
      runnerId: "vscode-1",
    });

    expect(handoff.requestedSurface).toBe("ide");
    expect(handoff.runnerId).toBe("vscode-1");
    // Requesting a surface does not grant one.
    expect(handoff.surface).toBe("dashboard");
  });
});
