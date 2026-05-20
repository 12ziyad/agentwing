CREATE TABLE IF NOT EXISTS api_keys (
  api_key TEXT PRIMARY KEY,
  plan_name TEXT NOT NULL DEFAULT 'Beta',
  action_check_limit INTEGER NOT NULL DEFAULT 1000,
  sandbox_run_limit INTEGER NOT NULL DEFAULT 20,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  disabled_at TEXT
);

CREATE TABLE IF NOT EXISTS usage (
  api_key TEXT PRIMARY KEY,
  plan_name TEXT NOT NULL DEFAULT 'Beta',
  action_checks_used INTEGER NOT NULL DEFAULT 0,
  action_check_limit INTEGER NOT NULL DEFAULT 1000,
  sandbox_runs_used INTEGER NOT NULL DEFAULT 0,
  sandbox_run_limit INTEGER NOT NULL DEFAULT 20,
  receipts_created INTEGER NOT NULL DEFAULT 0,
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  FOREIGN KEY (api_key) REFERENCES api_keys(api_key) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS receipts (
  receipt_id TEXT PRIMARY KEY,
  api_key TEXT,
  project_id TEXT,
  session_id TEXT,
  agent_id TEXT,
  action_type TEXT NOT NULL,
  tool TEXT,
  target TEXT,
  raw_action TEXT NOT NULL,
  decision TEXT NOT NULL,
  risk TEXT NOT NULL,
  policy TEXT NOT NULL,
  feedback TEXT NOT NULL,
  provider TEXT,
  created_at TEXT NOT NULL,
  FOREIGN KEY (api_key) REFERENCES api_keys(api_key) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_receipts_created_at ON receipts(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_receipts_project_id ON receipts(project_id);
CREATE INDEX IF NOT EXISTS idx_receipts_api_key ON receipts(api_key);

CREATE TABLE IF NOT EXISTS sandbox_configs (
  api_key TEXT PRIMARY KEY,
  mode TEXT NOT NULL DEFAULT 'none',
  e2b_key_saved INTEGER NOT NULL DEFAULT 0,
  e2b_key_last4 TEXT,
  e2b_key_encrypted TEXT,
  custom_http_url TEXT,
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  FOREIGN KEY (api_key) REFERENCES api_keys(api_key) ON DELETE CASCADE
);
