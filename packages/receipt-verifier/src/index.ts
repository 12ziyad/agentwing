/**
 * Offline receipt verifier.
 *
 * Verifies an exported AgentWing receipt log without contacting AgentWing and
 * without importing any AgentWing server code. That independence is the whole
 * point: a log you can only check by asking its author is not evidence, it is
 * an assertion.
 *
 * Everything here runs on Web Crypto, so it works in Node 18+, browsers, Deno,
 * Bun and Workers alike.
 */

export const CHAIN_VERSION = "awchain1";

/** A single link in a workspace's receipt chain. */
export type ChainedReceipt = {
  /** Position in the chain. Starts at 1 and increases by exactly one. */
  seq: number;
  receiptId: string;
  workspaceId: string;
  /** Hash of the previous entry, or the genesis value for seq 1. */
  prevHash: string;
  /** SHA-256 over the canonical payload joined to prevHash. */
  hash: string;
  /** The recorded facts. Anything here is covered by `hash`. */
  payload: Record<string, unknown>;
};

/** A signed statement that the chain reached a given length and head. */
export type Checkpoint = {
  version: typeof CHAIN_VERSION;
  workspaceId: string;
  /** Number of entries covered. */
  treeSize: number;
  /** Hash of entry number `treeSize`. */
  headHash: string;
  issuedAt: string;
  keyId: string;
  /** Base64url ECDSA P-256 signature over the canonical checkpoint body. */
  signature: string;
};

export type VerifyInput = {
  receipts: ChainedReceipt[];
  checkpoint?: Checkpoint;
  /** Base64url SPKI public key. Required to verify a checkpoint. */
  publicKey?: string;
};

export type VerifyProblem = {
  code:
    | "empty_log"
    | "sequence_gap"
    | "workspace_mismatch"
    | "genesis_mismatch"
    | "prev_hash_mismatch"
    | "hash_mismatch"
    | "checkpoint_size_mismatch"
    | "checkpoint_head_mismatch"
    | "checkpoint_workspace_mismatch"
    | "checkpoint_unsigned"
    | "checkpoint_bad_signature"
    | "checkpoint_key_missing";
  message: string;
  seq?: number;
};

export type VerifyResult = {
  ok: boolean;
  entriesVerified: number;
  headHash?: string;
  checkpointVerified: boolean;
  problems: VerifyProblem[];
};

/** The `prevHash` of the first entry in any chain. */
export const GENESIS_HASH = "0".repeat(64);

/**
 * RFC 8785-style canonical JSON.
 *
 * Object keys sorted, no insignificant whitespace. Without a canonical form,
 * two byte-different encodings of the same object hash differently and
 * verification fails for reasons that have nothing to do with tampering.
 */
export function canonicalize(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value) ?? "null";
  if (Array.isArray(value)) return `[${value.map(canonicalize).join(",")}]`;

  const entries = Object.entries(value as Record<string, unknown>)
    .filter(([, v]) => v !== undefined)
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));

  return `{${entries.map(([k, v]) => `${JSON.stringify(k)}:${canonicalize(v)}`).join(",")}}`;
}

function toHex(buffer: ArrayBuffer): string {
  return Array.from(new Uint8Array(buffer), (b) => b.toString(16).padStart(2, "0")).join("");
}

async function sha256Hex(input: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(input));
  return toHex(digest);
}

/**
 * The hash for one entry.
 *
 * Binding `prevHash` into the digest is what makes the log a chain: changing
 * any earlier entry changes every hash after it, so a single tampered row
 * cannot be repaired without rewriting everything that followed.
 */
export function entryHash(input: {
  seq: number;
  receiptId: string;
  workspaceId: string;
  prevHash: string;
  payload: Record<string, unknown>;
}): Promise<string> {
  const body = canonicalize({
    v: CHAIN_VERSION,
    seq: input.seq,
    receiptId: input.receiptId,
    workspaceId: input.workspaceId,
    payload: input.payload,
  });
  return sha256Hex(`${body}\n${input.prevHash}`);
}

/** The bytes a checkpoint signature covers. */
export function checkpointBody(checkpoint: Omit<Checkpoint, "signature">): string {
  return canonicalize({
    version: checkpoint.version,
    workspaceId: checkpoint.workspaceId,
    treeSize: checkpoint.treeSize,
    headHash: checkpoint.headHash,
    issuedAt: checkpoint.issuedAt,
    keyId: checkpoint.keyId,
  });
}

function base64urlToBytes(value: string): Uint8Array {
  const padded = value.replace(/-/g, "+").replace(/_/g, "/");
  const binary = atob(padded + "=".repeat((4 - (padded.length % 4)) % 4));
  return Uint8Array.from(binary, (c) => c.charCodeAt(0));
}

export function bytesToBase64url(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

async function importVerifyKey(spkiBase64url: string): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    "spki",
    base64urlToBytes(spkiBase64url) as unknown as ArrayBuffer,
    { name: "ECDSA", namedCurve: "P-256" },
    false,
    ["verify"],
  );
}

/**
 * Verify a chain, and optionally the checkpoint that covers it.
 *
 * Collects every problem rather than stopping at the first, because "your log
 * broke at entry 4" is far less useful than knowing whether that is one bad
 * row or the point where a rewrite began.
 */
export async function verifyChain(input: VerifyInput): Promise<VerifyResult> {
  const problems: VerifyProblem[] = [];
  const receipts = [...input.receipts].sort((a, b) => a.seq - b.seq);

  if (receipts.length === 0) {
    return { ok: false, entriesVerified: 0, checkpointVerified: false, problems: [{ code: "empty_log", message: "The log contains no entries." }] };
  }

  const workspaceId = receipts[0]!.workspaceId;
  let expectedPrev = GENESIS_HASH;
  let expectedSeq = receipts[0]!.seq;
  let verified = 0;

  for (const entry of receipts) {
    if (entry.workspaceId !== workspaceId) {
      problems.push({
        code: "workspace_mismatch",
        seq: entry.seq,
        message: `Entry ${entry.seq} belongs to workspace ${entry.workspaceId}, not ${workspaceId}. A chain covers one workspace.`,
      });
    }

    if (entry.seq !== expectedSeq) {
      problems.push({
        code: "sequence_gap",
        seq: entry.seq,
        message: `Expected entry ${expectedSeq} but found ${entry.seq}. Entries are missing or reordered.`,
      });
      expectedSeq = entry.seq;
    }

    if (entry.seq === 1 && entry.prevHash !== GENESIS_HASH) {
      problems.push({
        code: "genesis_mismatch",
        seq: entry.seq,
        message: "The first entry does not start from the genesis hash.",
      });
    } else if (entry.seq !== 1 && entry.prevHash !== expectedPrev) {
      problems.push({
        code: "prev_hash_mismatch",
        seq: entry.seq,
        message: `Entry ${entry.seq} does not follow entry ${entry.seq - 1}. The chain is broken here.`,
      });
    }

    const computed = await entryHash({
      seq: entry.seq,
      receiptId: entry.receiptId,
      workspaceId: entry.workspaceId,
      prevHash: entry.prevHash,
      payload: entry.payload,
    });

    if (computed !== entry.hash) {
      problems.push({
        code: "hash_mismatch",
        seq: entry.seq,
        message: `Entry ${entry.seq} has been altered since it was written. Its contents do not match its hash.`,
      });
    } else {
      verified += 1;
    }

    expectedPrev = entry.hash;
    expectedSeq += 1;
  }

  const headHash = receipts[receipts.length - 1]!.hash;
  let checkpointVerified = false;

  if (input.checkpoint) {
    const checkpoint = input.checkpoint;

    if (checkpoint.workspaceId !== workspaceId) {
      problems.push({ code: "checkpoint_workspace_mismatch", message: "The checkpoint covers a different workspace." });
    }

    const covering = receipts.find((r) => r.seq === checkpoint.treeSize);
    if (!covering) {
      problems.push({
        code: "checkpoint_size_mismatch",
        message: `The checkpoint covers ${checkpoint.treeSize} entries, which this export does not contain.`,
      });
    } else if (covering.hash !== checkpoint.headHash) {
      problems.push({
        code: "checkpoint_head_mismatch",
        message: `The checkpoint's head does not match entry ${checkpoint.treeSize}. The log has been rewritten since it was signed.`,
      });
    }

    if (!checkpoint.signature) {
      problems.push({ code: "checkpoint_unsigned", message: "The checkpoint carries no signature." });
    } else if (!input.publicKey) {
      problems.push({ code: "checkpoint_key_missing", message: "No public key was supplied, so the signature cannot be checked." });
    } else {
      const { signature, ...body } = checkpoint;
      const valid = await crypto.subtle.verify(
        { name: "ECDSA", hash: "SHA-256" },
        await importVerifyKey(input.publicKey),
        base64urlToBytes(signature) as unknown as ArrayBuffer,
        new TextEncoder().encode(checkpointBody(body)) as unknown as ArrayBuffer,
      );
      if (valid) checkpointVerified = true;
      else problems.push({ code: "checkpoint_bad_signature", message: "The checkpoint signature is not valid for this key." });
    }
  }

  return {
    ok: problems.length === 0,
    entriesVerified: verified,
    headHash,
    checkpointVerified,
    problems,
  };
}
