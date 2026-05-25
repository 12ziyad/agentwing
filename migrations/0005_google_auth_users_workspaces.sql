CREATE TABLE IF NOT EXISTS users (
  user_id TEXT PRIMARY KEY,
  email TEXT NOT NULL,
  name TEXT,
  image TEXT,
  provider TEXT NOT NULL,
  provider_account_id TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  last_login_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_users_provider_account ON users(provider, provider_account_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_email ON users(email);

CREATE TABLE IF NOT EXISTS workspaces (
  workspace_id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  owner_user_id TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  FOREIGN KEY (owner_user_id) REFERENCES users(user_id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS workspace_members (
  workspace_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'member',
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  PRIMARY KEY (workspace_id, user_id),
  FOREIGN KEY (workspace_id) REFERENCES workspaces(workspace_id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS sessions (
  session_id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  token_hash TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_sessions_token_hash ON sessions(token_hash);
CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_expires_at ON sessions(expires_at);

ALTER TABLE projects ADD COLUMN workspace_id TEXT;
ALTER TABLE api_keys ADD COLUMN workspace_id TEXT;
ALTER TABLE receipts ADD COLUMN workspace_id TEXT;
ALTER TABLE sandbox_configs ADD COLUMN workspace_id TEXT;

CREATE INDEX IF NOT EXISTS idx_projects_workspace_id ON projects(workspace_id);
CREATE INDEX IF NOT EXISTS idx_api_keys_workspace_id ON api_keys(workspace_id);
CREATE INDEX IF NOT EXISTS idx_receipts_workspace_id ON receipts(workspace_id);
CREATE INDEX IF NOT EXISTS idx_sandbox_configs_workspace_id ON sandbox_configs(workspace_id);

UPDATE api_keys
SET workspace_id = (
  SELECT projects.workspace_id
  FROM projects
  WHERE projects.project_id = api_keys.project_id
)
WHERE workspace_id IS NULL AND project_id IS NOT NULL;

UPDATE receipts
SET workspace_id = (
  SELECT projects.workspace_id
  FROM projects
  WHERE projects.project_id = receipts.project_id
)
WHERE workspace_id IS NULL AND project_id IS NOT NULL;
