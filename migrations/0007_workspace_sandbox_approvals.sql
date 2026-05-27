-- Workspace-scoped sandbox configs (replaces api_key-keyed sandbox_configs for workspace BYOK)
-- No FK to api_keys so workspace:xxx synthetic keys don't trigger constraint failures
CREATE TABLE IF NOT EXISTS workspace_sandbox_configs (
  workspace_id TEXT PRIMARY KEY,
  mode TEXT NOT NULL DEFAULT 'none',
  e2b_key_saved INTEGER NOT NULL DEFAULT 0,
  e2b_key_prefix TEXT,
  e2b_key_last4 TEXT,
  e2b_key_encrypted TEXT,
  connected_at TEXT,
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  last_test_status TEXT,
  last_tested_at TEXT,
  last_error TEXT
);

CREATE INDEX IF NOT EXISTS idx_workspace_sandbox_configs_workspace_id ON workspace_sandbox_configs(workspace_id);

-- Approvals table for approval_required decisions
CREATE TABLE IF NOT EXISTS approvals (
  approval_id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL,
  project_id TEXT,
  receipt_id TEXT,
  action_json TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  decision TEXT NOT NULL DEFAULT 'approval_required',
  risk TEXT NOT NULL DEFAULT 'medium',
  policy TEXT,
  reason TEXT,
  requested_by_agent TEXT,
  resolved_by TEXT,
  resolved_reason TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  resolved_at TEXT,
  expires_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_approvals_workspace_id ON approvals(workspace_id);
CREATE INDEX IF NOT EXISTS idx_approvals_status ON approvals(status);
CREATE INDEX IF NOT EXISTS idx_approvals_created_at ON approvals(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_approvals_receipt_id ON approvals(receipt_id);
