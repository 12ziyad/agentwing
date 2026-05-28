CREATE TABLE IF NOT EXISTS action_runs (
  run_id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL,
  project_id TEXT,
  api_key_id TEXT,
  receipt_id TEXT,
  approval_id TEXT,
  action_json TEXT NOT NULL,
  decision TEXT NOT NULL,
  risk TEXT NOT NULL,
  policy TEXT NOT NULL,
  feedback TEXT,
  next_step TEXT,
  status TEXT NOT NULL,
  execution_target TEXT,
  sandbox_provider TEXT,
  sandbox_run_id TEXT,
  stdout TEXT,
  stderr TEXT,
  exit_code INTEGER,
  execution_logs_json TEXT,
  error_message TEXT,
  duration_ms INTEGER,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  completed_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_action_runs_workspace_id ON action_runs(workspace_id);
CREATE INDEX IF NOT EXISTS idx_action_runs_project_id ON action_runs(project_id);
CREATE INDEX IF NOT EXISTS idx_action_runs_receipt_id ON action_runs(receipt_id);
CREATE INDEX IF NOT EXISTS idx_action_runs_approval_id ON action_runs(approval_id);
CREATE INDEX IF NOT EXISTS idx_action_runs_status ON action_runs(status);
CREATE INDEX IF NOT EXISTS idx_action_runs_created_at ON action_runs(created_at DESC);

CREATE TABLE IF NOT EXISTS execution_events (
  event_id TEXT PRIMARY KEY,
  run_id TEXT NOT NULL,
  event_type TEXT NOT NULL,
  message TEXT,
  metadata_json TEXT,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_execution_events_run_id ON execution_events(run_id);
CREATE INDEX IF NOT EXISTS idx_execution_events_created_at ON execution_events(created_at);
