-- API key revocation
ALTER TABLE api_keys ADD COLUMN revoked_at TEXT;

-- Custom policies
CREATE TABLE IF NOT EXISTS custom_policies (
  policy_id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL,
  project_id TEXT,
  name TEXT NOT NULL,
  description TEXT,
  action_type TEXT,
  tool TEXT,
  target_pattern TEXT,
  command_pattern TEXT,
  decision TEXT NOT NULL DEFAULT 'allow',
  risk TEXT NOT NULL DEFAULT 'low',
  priority INTEGER NOT NULL DEFAULT 100,
  enabled INTEGER NOT NULL DEFAULT 1,
  feedback TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE INDEX IF NOT EXISTS idx_custom_policies_workspace_id ON custom_policies(workspace_id);
CREATE INDEX IF NOT EXISTS idx_custom_policies_project_id ON custom_policies(project_id);
CREATE INDEX IF NOT EXISTS idx_custom_policies_enabled ON custom_policies(enabled);

-- Product events
CREATE TABLE IF NOT EXISTS events (
  event_id TEXT PRIMARY KEY,
  workspace_id TEXT,
  user_id TEXT,
  project_id TEXT,
  event_type TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'ok',
  metadata_json TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE INDEX IF NOT EXISTS idx_events_workspace_id ON events(workspace_id);
CREATE INDEX IF NOT EXISTS idx_events_event_type ON events(event_type);
CREATE INDEX IF NOT EXISTS idx_events_created_at ON events(created_at DESC);
