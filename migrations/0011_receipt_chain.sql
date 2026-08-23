-- Receipt chaining.
--
-- Receipts were plain mutable rows and nothing stopped a workspace key from
-- rewriting its own history. Each entry now commits to the hash of the one
-- before it, so altering an entry invalidates every entry after it.

-- One entry per receipt, per workspace, in order.
CREATE TABLE IF NOT EXISTS receipt_chain (
  workspace_id TEXT NOT NULL,
  seq          INTEGER NOT NULL,
  receipt_id   TEXT NOT NULL,
  prev_hash    TEXT NOT NULL,
  hash         TEXT NOT NULL,
  payload_json TEXT NOT NULL,
  created_at   TEXT NOT NULL,
  PRIMARY KEY (workspace_id, seq)
);

-- A receipt appears at most once in its workspace's chain. This is the
-- backstop that makes a double-append impossible even if the compare-and-swap
-- below were somehow bypassed.
CREATE UNIQUE INDEX IF NOT EXISTS idx_receipt_chain_receipt
  ON receipt_chain(workspace_id, receipt_id);

CREATE INDEX IF NOT EXISTS idx_receipt_chain_hash
  ON receipt_chain(workspace_id, hash);

-- The current head of each workspace's chain.
--
-- Exists so appending is a compare-and-swap: an appender reads the head, builds
-- the next entry from it, and updates the head only if it has not moved. D1
-- cannot otherwise hand out a monotonic sequence safely under concurrency —
-- SELECT MAX(seq) + 1 races, and two racing appenders would both write seq N.
CREATE TABLE IF NOT EXISTS receipt_chain_head (
  workspace_id TEXT PRIMARY KEY,
  seq          INTEGER NOT NULL,
  hash         TEXT NOT NULL,
  updated_at   TEXT NOT NULL
);

-- Signed statements that a workspace's chain reached a given length and head.
--
-- A hash chain stops someone quietly editing one row. It does not stop an
-- operator with full database access rewriting the whole tail so the chain is
-- internally consistent again. A signed checkpoint does, because the signature
-- covers a head that the rewritten tail no longer produces.
CREATE TABLE IF NOT EXISTS receipt_checkpoints (
  checkpoint_id TEXT PRIMARY KEY,
  workspace_id  TEXT NOT NULL,
  tree_size     INTEGER NOT NULL,
  head_hash     TEXT NOT NULL,
  key_id        TEXT NOT NULL,
  signature     TEXT NOT NULL,
  issued_at     TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_receipt_checkpoints_workspace
  ON receipt_checkpoints(workspace_id, tree_size DESC);
