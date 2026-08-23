/**
 * Receipt chaining.
 *
 * Receipts were plain mutable rows: `updateReceiptExecutionResult` rewrote them
 * in place, and nothing stopped a workspace key from rewriting its own history.
 * For a product whose value is the receipt, "trust our database" is not a claim
 * anyone should accept.
 *
 * Each entry now carries the hash of the one before it, so altering an entry
 * invalidates every entry after it. A single tampered row cannot be repaired
 * without rewriting the whole tail — and a signed checkpoint pins the tail.
 *
 * The hashing here must agree byte for byte with `@agentwing/receipt-verifier`,
 * which is a separate package precisely so a customer can check the log without
 * running our code. `tests/receipts/chain.test.ts` asserts the two agree.
 */

export const CHAIN_VERSION = "awchain1";
export const GENESIS_HASH = "0".repeat(64);

export type ChainPayload = Record<string, unknown>;

export type ChainEntryInput = {
  seq: number;
  receiptId: string;
  workspaceId: string;
  prevHash: string;
  payload: ChainPayload;
};

export type ChainEntry = ChainEntryInput & { hash: string };

/**
 * RFC 8785-style canonical JSON: keys sorted, no insignificant whitespace.
 *
 * Without a canonical form, two byte-different encodings of the same object
 * hash differently, and verification fails for reasons that have nothing to do
 * with tampering.
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

export async function entryHash(input: ChainEntryInput): Promise<string> {
  const body = canonicalize({
    v: CHAIN_VERSION,
    seq: input.seq,
    receiptId: input.receiptId,
    workspaceId: input.workspaceId,
    payload: input.payload,
  });
  const digest = await globalThis.crypto.subtle.digest("SHA-256", new TextEncoder().encode(`${body}\n${input.prevHash}`));
  return toHex(digest);
}

export async function buildEntry(input: ChainEntryInput): Promise<ChainEntry> {
  return { ...input, hash: await entryHash(input) };
}

/**
 * The subset of a receipt the chain commits to.
 *
 * Deliberately explicit rather than hashing the whole row: a chain over "every
 * column we happen to have" breaks the moment a migration adds one, and
 * verification failures that mean "we added a column" teach people to ignore
 * verification failures.
 *
 * What is here is what an auditor needs — what was asked, what was decided,
 * which rule decided it, and what happened.
 */
export function receiptChainPayload(receipt: {
  actionType?: string;
  tool?: string;
  target?: string;
  decision: string;
  risk: string;
  policy: string;
  projectId?: string;
  sessionId?: string;
  agentId?: string;
  createdAt: string;
  exitCode?: number;
  mode?: string;
  provider?: string;
}): ChainPayload {
  return {
    actionType: receipt.actionType ?? null,
    tool: receipt.tool ?? null,
    target: receipt.target ?? null,
    decision: receipt.decision,
    risk: receipt.risk,
    policy: receipt.policy,
    projectId: receipt.projectId ?? null,
    sessionId: receipt.sessionId ?? null,
    agentId: receipt.agentId ?? null,
    createdAt: receipt.createdAt,
    exitCode: receipt.exitCode ?? null,
    mode: receipt.mode ?? null,
    provider: receipt.provider ?? null,
  };
}

// ---------------------------------------------------------------------------
// Checkpoints
// ---------------------------------------------------------------------------

export type CheckpointBody = {
  version: typeof CHAIN_VERSION;
  workspaceId: string;
  treeSize: number;
  headHash: string;
  issuedAt: string;
  keyId: string;
};

export type SignedCheckpoint = CheckpointBody & { signature: string };

export function checkpointBody(body: CheckpointBody): string {
  return canonicalize({
    version: body.version,
    workspaceId: body.workspaceId,
    treeSize: body.treeSize,
    headHash: body.headHash,
    issuedAt: body.issuedAt,
    keyId: body.keyId,
  });
}

export function bytesToBase64url(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export function base64urlToBytes(value: string): Uint8Array {
  const padded = value.replace(/-/g, "+").replace(/_/g, "/");
  const binary = atob(padded + "=".repeat((4 - (padded.length % 4)) % 4));
  return Uint8Array.from(binary, (c) => c.charCodeAt(0));
}

/**
 * Sign a checkpoint.
 *
 * ECDSA P-256 because Workers' SubtleCrypto supports it natively. Ed25519
 * exists there only via the non-standard `NODE-ED25519` algorithm, which
 * disallows raw private-key import — so P-256 is the choice that works rather
 * than the choice that reads best.
 */
export async function signCheckpoint(body: CheckpointBody, privateKeyPkcs8Base64url: string): Promise<SignedCheckpoint> {
  const key = await globalThis.crypto.subtle.importKey(
    "pkcs8",
    base64urlToBytes(privateKeyPkcs8Base64url) as unknown as ArrayBuffer,
    { name: "ECDSA", namedCurve: "P-256" },
    false,
    ["sign"],
  );

  const signature = await globalThis.crypto.subtle.sign(
    { name: "ECDSA", hash: "SHA-256" },
    key,
    new TextEncoder().encode(checkpointBody(body)) as unknown as ArrayBuffer,
  );

  return { ...body, signature: bytesToBase64url(new Uint8Array(signature)) };
}
