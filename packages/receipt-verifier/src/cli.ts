/**
 * agentwing-verify — check an exported receipt log.
 *
 * Reads an export from a file or stdin, verifies the chain and any checkpoint,
 * and exits non-zero if anything is wrong. Contacts nothing.
 *
 *   agentwing-verify export.json
 *   agentwing-verify export.json --key <base64url-spki>
 *   cat export.json | agentwing-verify
 */

import { readFileSync } from "node:fs";
import { verifyChain } from "./index.js";
import type { ChainedReceipt, Checkpoint } from "./index.js";

type ExportFile = {
  workspaceId?: string;
  receipts: ChainedReceipt[];
  checkpoint?: Checkpoint;
  publicKey?: string;
};

function readInput(path?: string): string {
  if (path && path !== "-") return readFileSync(path, "utf8");
  return readFileSync(0, "utf8");
}

function fail(message: string): never {
  process.stderr.write(`agentwing-verify: ${message}\n`);
  process.exit(2);
}

const args = process.argv.slice(2);

if (args.includes("--help") || args.includes("-h")) {
  process.stdout.write(
    [
      "agentwing-verify — verify an AgentWing receipt log offline",
      "",
      "Usage:",
      "  agentwing-verify [file] [--key <base64url-spki>]",
      "  cat export.json | agentwing-verify",
      "",
      "Exit codes:",
      "  0  the log verifies",
      "  1  the log does not verify",
      "  2  the input could not be read",
      "",
    ].join("\n"),
  );
  process.exit(0);
}

const keyIndex = args.indexOf("--key");
const keyFromFlag = keyIndex === -1 ? undefined : args[keyIndex + 1];
// The index of the flag's *value*, or -1 when there is no flag. Using
// `keyIndex + 1` directly makes that 0 when the flag is absent, which excludes
// the first positional argument and silently sends the CLI to wait on stdin.
const keyValueIndex = keyIndex === -1 ? -1 : keyIndex + 1;
const filePath = args.find((arg, i) => !arg.startsWith("-") && i !== keyValueIndex);

let parsed: ExportFile;
try {
  parsed = JSON.parse(readInput(filePath)) as ExportFile;
} catch (error) {
  fail(`could not read input — ${error instanceof Error ? error.message : "unknown error"}`);
}

if (!Array.isArray(parsed.receipts)) {
  fail("the export has no `receipts` array");
}

const result = await verifyChain({
  receipts: parsed.receipts,
  checkpoint: parsed.checkpoint,
  publicKey: keyFromFlag ?? parsed.publicKey,
});

const out = process.stdout;

if (result.ok) {
  out.write(`✓ ${result.entriesVerified} entries verified\n`);
  out.write(`  head ${result.headHash}\n`);
  out.write(
    result.checkpointVerified
      ? "  checkpoint signature valid\n"
      : "  no checkpoint checked (supply --key to verify one)\n",
  );
  process.exit(0);
}

out.write(`✗ this log does not verify (${result.problems.length} problem${result.problems.length === 1 ? "" : "s"})\n\n`);
for (const problem of result.problems) {
  out.write(`  [${problem.code}]${problem.seq !== undefined ? ` entry ${problem.seq}` : ""}\n    ${problem.message}\n`);
}
out.write(`\n  ${result.entriesVerified} of ${parsed.receipts.length} entries hashed correctly.\n`);
process.exit(1);
