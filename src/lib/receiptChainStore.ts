import type { AgentWingD1Database } from "./cloudflareD1";
import { buildEntry, CHAIN_VERSION, GENESIS_HASH, receiptChainPayload, signCheckpoint } from "./receiptChain";
import { checkpointKeyId, checkpointSigningKey } from "./checkpointKey";
import type { ChainEntry, SignedCheckpoint } from "./receiptChain";

/**
 * Appending to a workspace's receipt chain.
 *
 * Each entry commits to the hash of the one before it, so the append must be
 * serialised: two appenders that both read head N and both write N+1 produce a
 * fork, and a forked chain does not verify.
 *
 * D1 cannot hand out a monotonic sequence on its own — `SELECT MAX(seq) + 1`
 * races. So the head is its own row and the append is a compare-and-swap:
 * update the head only if it has not moved since we read it. A loser retries
 * against the new head rather than corrupting the chain.
 *
 * A Durable Object per workspace would serialise this without contention and is
 * the scale path. It is not needed at the volumes a single D1 database serves,
 * and this is correct at any volume — just slower under heavy contention.
 */

/** Bounded so a pathological contention loop cannot hold a request open. */
const MAX_APPEND_ATTEMPTS = 5;

export class ChainAppendError extends Error {
  readonly code = "chain_append_failed";

  constructor(message: string, readonly cause?: unknown) {
    super(message);
    this.name = "ChainAppendError";
  }
}

type ChainHead = { seq: number; hash: string };

async function readHead(db: AgentWingD1Database, workspaceId: string): Promise<ChainHead> {
  const row = await db
    .prepare("SELECT seq, hash FROM receipt_chain_head WHERE workspace_id = ?")
    .bind(workspaceId)
    .first<{ seq: number; hash: string }>();

  return row ? { seq: Number(row.seq), hash: row.hash } : { seq: 0, hash: GENESIS_HASH };
}

/**
 * Claim the next sequence number, or fail because someone else took it.
 *
 * Returns true only when this caller moved the head from exactly the value it
 * read. `meta.changes` is the whole mechanism — `success` is true for any
 * statement that executed, including one that matched no rows.
 */
async function advanceHead(
  db: AgentWingD1Database,
  workspaceId: string,
  from: ChainHead,
  to: ChainHead,
  now: string,
): Promise<boolean> {
  if (from.seq === 0) {
    // First entry: INSERT succeeds only if no head exists, which is the same
    // compare-and-swap expressed as a uniqueness constraint.
    const inserted = await db
      .prepare("INSERT OR IGNORE INTO receipt_chain_head (workspace_id, seq, hash, updated_at) VALUES (?, ?, ?, ?)")
      .bind(workspaceId, to.seq, to.hash, now)
      .run();
    return (inserted.meta?.changes ?? 0) > 0;
  }

  const updated = await db
    .prepare("UPDATE receipt_chain_head SET seq = ?, hash = ?, updated_at = ? WHERE workspace_id = ? AND seq = ?")
    .bind(to.seq, to.hash, now, workspaceId, from.seq)
    .run();

  return (updated.meta?.changes ?? 0) > 0;
}

export type ChainAppendResult = { entry: ChainEntry } | { skipped: "already_chained" };

/**
 * Append one receipt to its workspace's chain.
 *
 * Idempotent by receipt id: a retry that already landed is reported rather than
 * duplicated, because a receipt appearing twice in the chain is itself a
 * verification failure.
 */
export async function appendReceiptToChain(
  db: AgentWingD1Database,
  workspaceId: string,
  receipt: Parameters<typeof receiptChainPayload>[0] & { receiptId: string },
): Promise<ChainAppendResult> {
  const existing = await db
    .prepare("SELECT seq FROM receipt_chain WHERE workspace_id = ? AND receipt_id = ?")
    .bind(workspaceId, receipt.receiptId)
    .first<{ seq: number }>();
  if (existing) return { skipped: "already_chained" };

  const payload = receiptChainPayload(receipt);

  for (let attempt = 0; attempt < MAX_APPEND_ATTEMPTS; attempt += 1) {
    const head = await readHead(db, workspaceId);
    const next = { seq: head.seq + 1, prevHash: head.hash };

    const entry = await buildEntry({
      seq: next.seq,
      receiptId: receipt.receiptId,
      workspaceId,
      prevHash: next.prevHash,
      payload,
    });

    const now = new Date().toISOString();
    const won = await advanceHead(db, workspaceId, head, { seq: entry.seq, hash: entry.hash }, now);
    if (!won) continue; // Someone else appended; rebuild against the new head.

    // The head is ours, so this sequence number is uniquely claimed and the
    // row insert cannot collide.
    await db
      .prepare(
        `INSERT INTO receipt_chain (workspace_id, seq, receipt_id, prev_hash, hash, payload_json, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
      )
      .bind(workspaceId, entry.seq, entry.receiptId, entry.prevHash, entry.hash, JSON.stringify(payload), now)
      .run();

    return { entry };
  }

  throw new ChainAppendError(
    `Could not append to the receipt chain for ${workspaceId} after ${MAX_APPEND_ATTEMPTS} attempts.`,
  );
}

/**
 * Issue a signed checkpoint for a workspace's current head, if one is needed.
 *
 * Called before an export so the exported log is covered by a signature rather
 * than only by its own internal consistency. Skips when signing is not
 * configured, and when the head has not moved since the last checkpoint —
 * re-signing an unchanged head adds nothing but rows.
 */
export async function issueCheckpointIfNeeded(
  db: AgentWingD1Database,
  workspaceId: string,
): Promise<SignedCheckpoint | undefined> {
  const privateKey = checkpointSigningKey();
  if (!privateKey) return undefined;

  const head = await readHead(db, workspaceId);
  if (head.seq === 0) return undefined;

  const latest = await db
    .prepare("SELECT tree_size FROM receipt_checkpoints WHERE workspace_id = ? ORDER BY tree_size DESC LIMIT 1")
    .bind(workspaceId)
    .first<{ tree_size: number }>();

  if (latest && Number(latest.tree_size) >= head.seq) return undefined;

  const checkpoint = await signCheckpoint(
    {
      version: CHAIN_VERSION,
      workspaceId,
      treeSize: head.seq,
      headHash: head.hash,
      issuedAt: new Date().toISOString(),
      keyId: checkpointKeyId(),
    },
    privateKey,
  );

  await db
    .prepare(
      `INSERT OR IGNORE INTO receipt_checkpoints
       (checkpoint_id, workspace_id, tree_size, head_hash, key_id, signature, issued_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
    )
    .bind(
      `ckpt_${workspaceId}_${checkpoint.treeSize}`,
      workspaceId,
      checkpoint.treeSize,
      checkpoint.headHash,
      checkpoint.keyId,
      checkpoint.signature,
      checkpoint.issuedAt,
    )
    .run();

  return checkpoint;
}

export type ExportedChain = {
  workspaceId: string;
  receipts: Array<{
    seq: number;
    receiptId: string;
    workspaceId: string;
    prevHash: string;
    hash: string;
    payload: Record<string, unknown>;
  }>;
  checkpoint?: {
    version: "awchain1";
    workspaceId: string;
    treeSize: number;
    headHash: string;
    issuedAt: string;
    keyId: string;
    signature: string;
  };
};

/** Read a workspace's chain in the shape `@agentwing/receipt-verifier` expects. */
export async function exportChain(
  db: AgentWingD1Database,
  workspaceId: string,
  limit = 5000,
): Promise<ExportedChain> {
  const rows = await db
    .prepare(
      `SELECT seq, receipt_id, prev_hash, hash, payload_json
       FROM receipt_chain
       WHERE workspace_id = ?
       ORDER BY seq ASC
       LIMIT ?`,
    )
    .bind(workspaceId, limit)
    .all<{ seq: number; receipt_id: string; prev_hash: string; hash: string; payload_json: string }>();

  const receipts = (rows.results ?? []).map((row) => ({
    seq: Number(row.seq),
    receiptId: row.receipt_id,
    workspaceId,
    prevHash: row.prev_hash,
    hash: row.hash,
    payload: JSON.parse(row.payload_json) as Record<string, unknown>,
  }));

  const checkpointRow = await db
    .prepare(
      `SELECT tree_size, head_hash, key_id, signature, issued_at
       FROM receipt_checkpoints
       WHERE workspace_id = ?
       ORDER BY tree_size DESC
       LIMIT 1`,
    )
    .bind(workspaceId)
    .first<{ tree_size: number; head_hash: string; key_id: string; signature: string; issued_at: string }>();

  return {
    workspaceId,
    receipts,
    checkpoint: checkpointRow
      ? {
          version: "awchain1",
          workspaceId,
          treeSize: Number(checkpointRow.tree_size),
          headHash: checkpointRow.head_hash,
          issuedAt: checkpointRow.issued_at,
          keyId: checkpointRow.key_id,
          signature: checkpointRow.signature,
        }
      : undefined,
  };
}
