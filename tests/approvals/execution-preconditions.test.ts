import { describe, expect, it } from "vitest";
import { RunTransitionError } from "@/lib/actionRunLifecycle";
import type { ActionRunStatus } from "@/lib/agentwingTypes";
import { actionRunStatuses } from "@/lib/agentwingTypes";

/**
 * A run may only report that it executed from a state where executing was
 * authorised.
 *
 * `POST /action-runs/:id/continue` used to accept an execution result from any
 * status at all. A run AgentWing blocked, or one a human explicitly rejected,
 * could be POSTed here and rewritten to `completed` with caller-supplied stdout
 * and exit code -- overwriting the receipt. For a product whose value is the
 * receipt, that let the party being audited author the audit.
 */

// Kept in step with CAN_REPORT_EXECUTION in actionRunLifecycle.ts. Duplicated
// deliberately: if the production set changes, this test should fail and force
// the change to be a considered one.
const MAY_REPORT: ReadonlySet<ActionRunStatus> = new Set([
  "approved",
  "checkpoint_created",
  "external_runner_required",
  "restore_point_required",
]);

describe("execution preconditions", () => {
  it("names the statuses that may report an execution result", () => {
    expect([...MAY_REPORT].sort()).toEqual([
      "approved",
      "checkpoint_created",
      "external_runner_required",
      "restore_point_required",
    ]);
  });

  it("refuses every status where execution was never authorised", () => {
    const refused = actionRunStatuses.filter((status) => !MAY_REPORT.has(status));

    // The two that matter most: a blocked run and a rejected one.
    expect(refused).toContain("blocked");
    expect(refused).toContain("rejected");
    // And the ones that are simply not there yet or already done.
    expect(refused).toContain("waiting_approval");
    expect(refused).toContain("waiting_sandbox");
    expect(refused).toContain("completed");
    expect(refused).toContain("failed");
  });
});

describe("RunTransitionError", () => {
  it("is a conflict, not a missing resource", () => {
    const error = new RunTransitionError("nope", "blocked_action_cannot_execute");
    expect(error.status).toBe(409);
    expect(error.code).toBe("blocked_action_cannot_execute");
    expect(error).toBeInstanceOf(Error);
  });

  it("carries a stable machine-readable code for clients", () => {
    expect(new RunTransitionError("x", "run_not_awaiting_execution").code).toBe("run_not_awaiting_execution");
  });
});
