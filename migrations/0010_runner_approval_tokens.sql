ALTER TABLE action_runs ADD COLUMN approval_source TEXT;

CREATE TABLE IF NOT EXISTS runner_approval_tokens (
  token_id TEXT PRIMARY KEY,
  run_id TEXT NOT NULL,
  workspace_id TEXT NOT NULL,
  token_hash TEXT NOT NULL,
  surface TEXT NOT NULL,
  runner_id TEXT,
  expires_at TEXT NOT NULL,
  used_at TEXT,
  created_at TEXT NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_runner_approval_tokens_hash ON runner_approval_tokens(token_hash);
CREATE INDEX IF NOT EXISTS idx_runner_approval_tokens_run_id ON runner_approval_tokens(run_id);
CREATE INDEX IF NOT EXISTS idx_runner_approval_tokens_workspace_id ON runner_approval_tokens(workspace_id);
CREATE INDEX IF NOT EXISTS idx_runner_approval_tokens_expires_at ON runner_approval_tokens(expires_at);
