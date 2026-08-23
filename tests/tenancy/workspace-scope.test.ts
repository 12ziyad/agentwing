import { describe, expect, it } from "vitest";
import {
  getActionRun,
  getActionRunStats,
  getReceipt,
  getReceiptStats,
  getUsageForWorkspace,
  listActionRuns,
  listApiKeys,
  listProjects,
  listReceipts,
  revokeApiKey,
  updateActionRun,
  updateReceiptExecutionResult,
} from "@/lib/agentwingStore";

/**
 * Tenant scope is not optional.
 *
 * Every function below used to accept an absent workspace and answer by
 * dropping its `WHERE workspace_id = ?` predicate, which returned every
 * tenant's rows to whoever asked. The type signatures now make that a compile
 * error; these tests cover the paths types cannot reach — a value that arrives
 * as `undefined` through `JSON.parse`, an `any` cast, or plain JavaScript.
 *
 * The required behaviour is to throw. Returning an empty list would be worse
 * than useless: it would look like "this tenant has no data" and hide the fact
 * that the query lost its scope.
 */

type UnscopedCall = readonly [name: string, call: (workspaceId: string) => Promise<unknown>];

const scopedReads: UnscopedCall[] = [
  ["listProjects", (ws) => listProjects(ws)],
  ["listApiKeys", (ws) => listApiKeys(ws)],
  ["listReceipts", (ws) => listReceipts(ws)],
  ["getReceipt", (ws) => getReceipt("rcp_1", ws)],
  ["listActionRuns", (ws) => listActionRuns(ws)],
  ["getActionRun", (ws) => getActionRun("run_1", ws)],
  ["getUsageForWorkspace", (ws) => getUsageForWorkspace(ws)],
  ["getReceiptStats", (ws) => getReceiptStats(ws)],
  ["getActionRunStats", (ws) => getActionRunStats(ws)],
];

const scopedWrites: UnscopedCall[] = [
  ["updateActionRun", (ws) => updateActionRun("run_1", { status: "completed" }, ws)],
  ["updateReceiptExecutionResult", (ws) => updateReceiptExecutionResult("rcp_1", ws, { exitCode: 0 })],
  ["revokeApiKey", (ws) => revokeApiKey("key_1", ws)],
];

const missingScopes: ReadonlyArray<readonly [string, unknown]> = [
  ["undefined", undefined],
  ["null", null],
  ["an empty string", ""],
];

describe("tenant scope is required", () => {
  for (const [group, calls] of [
    ["reads", scopedReads],
    ["writes", scopedWrites],
  ] as const) {
    describe(group, () => {
      for (const [name, call] of calls) {
        for (const [label, value] of missingScopes) {
          it(`${name} refuses ${label}`, async () => {
            // Deliberately bypassing the type system: this is the runtime
            // backstop for callers the compiler cannot see.
            await expect(call(value as string)).rejects.toThrow(/workspace/i);
          });
        }
      }
    });
  }
});

describe("the error explains the invariant", () => {
  it("names the operation and says scope is required", async () => {
    await expect(listReceipts(undefined as unknown as string)).rejects.toThrow(
      /listReceipts was called without a workspace id/,
    );
  });
});
