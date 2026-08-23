import { describe, expect, it } from "vitest";
import {
  buildEntry,
  canonicalize,
  checkpointBody,
  entryHash,
  GENESIS_HASH,
  receiptChainPayload,
  signCheckpoint,
  bytesToBase64url,
} from "@/lib/receiptChain";
import {
  canonicalize as verifierCanonicalize,
  entryHash as verifierEntryHash,
  verifyChain,
} from "../../packages/receipt-verifier/src/index.js";
import type { ChainedReceipt } from "../../packages/receipt-verifier/src/index.js";

/**
 * The server writes the chain; a separate package verifies it.
 *
 * That separation is the entire value: a log you can only check by asking its
 * author is an assertion, not evidence. These tests hold the two
 * implementations to the same bytes, then try to get a tampered log past the
 * verifier.
 */

const payload = (overrides: Record<string, unknown> = {}) =>
  receiptChainPayload({
    actionType: "shell_command",
    tool: "terminal",
    target: undefined,
    decision: "block",
    risk: "critical",
    policy: "block-destructive-shell-command",
    createdAt: "2026-08-23T00:00:00.000Z",
    ...overrides,
  });

async function buildChain(count: number, workspaceId = "ws_1"): Promise<ChainedReceipt[]> {
  const entries: ChainedReceipt[] = [];
  let prevHash = GENESIS_HASH;

  for (let seq = 1; seq <= count; seq += 1) {
    const entry = await buildEntry({
      seq,
      receiptId: `rcp_${seq}`,
      workspaceId,
      prevHash,
      payload: payload({ sessionId: `s_${seq}` }),
    });
    entries.push(entry as ChainedReceipt);
    prevHash = entry.hash;
  }

  return entries;
}

describe("the two implementations agree", () => {
  it("canonicalises identically", () => {
    const value = { b: 1, a: { d: [3, 2], c: null }, z: "x" };
    expect(canonicalize(value)).toBe(verifierCanonicalize(value));
  });

  it("sorts keys, so encoding order cannot change the hash", () => {
    expect(canonicalize({ b: 1, a: 2 })).toBe(canonicalize({ a: 2, b: 1 }));
  });

  it("produces identical entry hashes", async () => {
    const input = { seq: 1, receiptId: "rcp_1", workspaceId: "ws_1", prevHash: GENESIS_HASH, payload: payload() };
    expect(await entryHash(input)).toBe(await verifierEntryHash(input));
  });

  it("agrees on the checkpoint body", async () => {
    const body = {
      version: "awchain1" as const,
      workspaceId: "ws_1",
      treeSize: 3,
      headHash: "a".repeat(64),
      issuedAt: "2026-08-23T00:00:00.000Z",
      keyId: "default",
    };
    const { checkpointBody: verifierCheckpointBody } = await import("../../packages/receipt-verifier/src/index.js");
    expect(checkpointBody(body)).toBe(verifierCheckpointBody(body));
  });
});

describe("a well-formed chain verifies", () => {
  it("accepts a chain the server produced", async () => {
    const result = await verifyChain({ receipts: await buildChain(5) });
    expect(result.ok).toBe(true);
    expect(result.entriesVerified).toBe(5);
    expect(result.problems).toEqual([]);
  });

  it("verifies a single-entry chain", async () => {
    const result = await verifyChain({ receipts: await buildChain(1) });
    expect(result.ok).toBe(true);
  });

  it("rejects an empty log rather than trivially passing it", async () => {
    const result = await verifyChain({ receipts: [] });
    expect(result.ok).toBe(false);
    expect(result.problems[0]?.code).toBe("empty_log");
  });
});

describe("tampering is detected", () => {
  it("catches an altered decision", async () => {
    const receipts = await buildChain(5);
    // The exact edit someone would make: turn a block into an allow.
    (receipts[2]!.payload as Record<string, unknown>).decision = "allow";

    const result = await verifyChain({ receipts });
    expect(result.ok).toBe(false);
    expect(result.problems.some((p) => p.code === "hash_mismatch" && p.seq === 3)).toBe(true);
  });

  it("catches a deleted entry", async () => {
    const receipts = await buildChain(5);
    receipts.splice(2, 1);

    const result = await verifyChain({ receipts });
    expect(result.ok).toBe(false);
    expect(result.problems.some((p) => p.code === "sequence_gap" || p.code === "prev_hash_mismatch")).toBe(true);
  });

  it("does not care what order the export happens to list entries in", async () => {
    // Array order is transport, not evidence. The verifier sorts by seq, so a
    // differently-ordered export of the same log still verifies — otherwise
    // every consumer would have to preserve our row order to check anything.
    const receipts = await buildChain(5);
    const shuffled = [receipts[3]!, receipts[0]!, receipts[4]!, receipts[1]!, receipts[2]!];

    expect((await verifyChain({ receipts: shuffled })).ok).toBe(true);
  });

  it("catches two entries whose positions were swapped", async () => {
    // Genuine reordering: the entries claim each other's places, so neither
    // hash matches the position it now occupies.
    const receipts = await buildChain(5);
    const a = receipts[1]!;
    const b = receipts[2]!;
    [a.seq, b.seq] = [b.seq, a.seq];

    const result = await verifyChain({ receipts });
    expect(result.ok).toBe(false);
    expect(result.problems.some((p) => p.code === "hash_mismatch")).toBe(true);
  });

  it("catches an entry rewritten together with its own hash", async () => {
    // The sophisticated attempt: change the payload AND recompute the hash, so
    // the entry is internally consistent. It still fails, because the next
    // entry's prevHash no longer matches.
    const receipts = await buildChain(5);
    const target = receipts[2]!;
    (target.payload as Record<string, unknown>).decision = "allow";
    target.hash = await entryHash({
      seq: target.seq,
      receiptId: target.receiptId,
      workspaceId: target.workspaceId,
      prevHash: target.prevHash,
      payload: target.payload,
    });

    const result = await verifyChain({ receipts });
    expect(result.ok).toBe(false);
    expect(result.problems.some((p) => p.code === "prev_hash_mismatch" && p.seq === 4)).toBe(true);
  });

  it("catches a chain that does not start at genesis", async () => {
    const receipts = await buildChain(3);
    receipts[0]!.prevHash = "f".repeat(64);

    const result = await verifyChain({ receipts });
    expect(result.problems.some((p) => p.code === "genesis_mismatch")).toBe(true);
  });

  it("catches entries spliced in from another workspace", async () => {
    const receipts = await buildChain(3, "ws_1");
    const foreign = await buildChain(1, "ws_2");
    receipts.push({ ...foreign[0]!, seq: 4 });

    const result = await verifyChain({ receipts });
    expect(result.problems.some((p) => p.code === "workspace_mismatch")).toBe(true);
  });
});

describe("signed checkpoints", () => {
  async function keyPair() {
    const pair = await crypto.subtle.generateKey({ name: "ECDSA", namedCurve: "P-256" }, true, ["sign", "verify"]);
    const pkcs8 = await crypto.subtle.exportKey("pkcs8", pair.privateKey);
    const spki = await crypto.subtle.exportKey("spki", pair.publicKey);
    return {
      privateKey: bytesToBase64url(new Uint8Array(pkcs8)),
      publicKey: bytesToBase64url(new Uint8Array(spki)),
    };
  }

  it("verifies a checkpoint the server signed", async () => {
    const receipts = await buildChain(4);
    const { privateKey, publicKey } = await keyPair();

    const checkpoint = await signCheckpoint(
      {
        version: "awchain1",
        workspaceId: "ws_1",
        treeSize: 4,
        headHash: receipts[3]!.hash,
        issuedAt: "2026-08-23T00:00:00.000Z",
        keyId: "default",
      },
      privateKey,
    );

    const result = await verifyChain({ receipts, checkpoint, publicKey });
    expect(result.ok).toBe(true);
    expect(result.checkpointVerified).toBe(true);
  });

  it("catches a log rewritten after it was signed", async () => {
    const receipts = await buildChain(4);
    const { privateKey, publicKey } = await keyPair();

    const checkpoint = await signCheckpoint(
      {
        version: "awchain1",
        workspaceId: "ws_1",
        treeSize: 4,
        headHash: receipts[3]!.hash,
        issuedAt: "2026-08-23T00:00:00.000Z",
        keyId: "default",
      },
      privateKey,
    );

    // Rewrite the whole tail so the chain is internally consistent again —
    // which a log operator with full database access could do. The signed
    // checkpoint is what makes it detectable anyway.
    const rewritten = await buildChain(3);
    const tampered = await buildEntry({
      seq: 4,
      receiptId: "rcp_4",
      workspaceId: "ws_1",
      prevHash: rewritten[2]!.hash,
      payload: payload({ decision: "allow", sessionId: "s_4" }),
    });

    const result = await verifyChain({
      receipts: [...rewritten, tampered as ChainedReceipt],
      checkpoint,
      publicKey,
    });

    expect(result.ok).toBe(false);
    expect(result.problems.some((p) => p.code === "checkpoint_head_mismatch")).toBe(true);
  });

  it("rejects a checkpoint signed by a different key", async () => {
    const receipts = await buildChain(2);
    const signer = await keyPair();
    const other = await keyPair();

    const checkpoint = await signCheckpoint(
      {
        version: "awchain1",
        workspaceId: "ws_1",
        treeSize: 2,
        headHash: receipts[1]!.hash,
        issuedAt: "2026-08-23T00:00:00.000Z",
        keyId: "default",
      },
      signer.privateKey,
    );

    const result = await verifyChain({ receipts, checkpoint, publicKey: other.publicKey });
    expect(result.problems.some((p) => p.code === "checkpoint_bad_signature")).toBe(true);
  });

  it("says so when no key was supplied rather than silently passing", async () => {
    const receipts = await buildChain(2);
    const { privateKey } = await keyPair();
    const checkpoint = await signCheckpoint(
      {
        version: "awchain1",
        workspaceId: "ws_1",
        treeSize: 2,
        headHash: receipts[1]!.hash,
        issuedAt: "2026-08-23T00:00:00.000Z",
        keyId: "default",
      },
      privateKey,
    );

    const result = await verifyChain({ receipts, checkpoint });
    expect(result.checkpointVerified).toBe(false);
    expect(result.problems.some((p) => p.code === "checkpoint_key_missing")).toBe(true);
  });
});
