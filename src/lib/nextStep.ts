/**
 * What the agent should do after a decision. Pure, so the public playground
 * can show the exact sentence the API returns without importing storage.
 */
export function nextStepForDecision(decision: string, risk: string): string {
  switch (decision) {
    case "allow":
      return "Action cleared. Proceed with execution.";
    case "block":
      return risk === "critical" || risk === "high"
        ? "Stop this action immediately and re-plan without attempting this operation."
        : "Do not execute this action. Re-plan using a safer alternative.";
    case "approval_required":
      return "Pause execution. Wait for a human to approve or reject this action in the AgentWing dashboard before continuing.";
    case "sandbox_required":
      return "Do not execute in the main environment. Route this action through the connected sandbox first. Check the sandbox result before proceeding.";
    case "restore_point_required":
      return "Create and verify a checkpoint or restore point before any external runner continues.";
    default:
      return "Review the decision before continuing.";
  }
}
