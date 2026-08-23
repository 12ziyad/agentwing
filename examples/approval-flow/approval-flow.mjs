/**
 * Approval flow — the real one.
 *
 * Proposes a production deploy, which AgentWing holds for a human. The agent is
 * told where a human can approve and waits; it is not given anything that would
 * let it approve itself.
 *
 * Run:
 *   npm install @agentwing/sdk
 *   AGENTWING_API_KEY=aw_live_... node approval-flow.mjs
 */

import { AgentWing, AgentWingError } from "@agentwing/sdk";

const apiKey = process.env.AGENTWING_API_KEY;
if (!apiKey) {
  console.error(
    ["AGENTWING_API_KEY is not set.", "", "Create a key in the AgentWing dashboard, then:", "", "  export AGENTWING_API_KEY=aw_live_...", ""].join(
      "\n",
    ),
  );
  process.exit(1);
}

const aw = new AgentWing({
  apiKey,
  baseUrl: process.env.AGENTWING_BASE_URL,
  timeoutMs: 15_000,
  maxRetries: 3,
});

const action = {
  actionType: "deploy_action",
  tool: "deploy",
  target: "production",
  description: "Deploy the current build to production.",
  sessionId: `approval-flow-${Date.now()}`,
  agentId: "example-agent",
};

console.log("→ proposing:", action.description);

try {
  const { run, handoff, timedOut } = await aw.executeAction(action, {
    runtime: { surface: "cli", runnerId: "approval-flow-example" },

    // Called once, as soon as the run is held. Surface this to your operator
    // however you like — print it, post it to Slack, open a browser.
    onApprovalRequired: ({ handoff: h }) => {
      console.log("\n⏸  A human needs to approve this.");
      console.log("   Approve at:", h?.approvalUrl ?? "(your AgentWing dashboard)");
      console.log("   Waiting…\n");
    },

    pollIntervalMs: 3_000,
    maxWaitMs: 5 * 60 * 1000,
  });

  if (timedOut) {
    console.log("⌛ Nobody decided within the wait window. The run is still held.");
    console.log("   Status:", run.status);
    process.exit(2);
  }

  switch (run.status) {
    case "rejected":
      console.log("✗ An operator rejected this action. Not deploying.");
      process.exit(1);
      break;
    case "blocked":
      console.log("✗ Policy blocked this action outright:", run.policy);
      process.exit(1);
      break;
    default:
      console.log("✓ Approved. Final status:", run.status);
      console.log("  Receipt:", run.receiptId ?? "(none)");
  }
} catch (error) {
  if (error instanceof AgentWingError) {
    console.error(`✗ AgentWing error [${error.code}]${error.requestId ? ` (request ${error.requestId})` : ""}: ${error.message}`);
    process.exit(1);
  }
  throw error;
}
