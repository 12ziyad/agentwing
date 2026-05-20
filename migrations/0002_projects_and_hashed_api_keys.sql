CREATE TABLE IF NOT EXISTS projects (
  project_id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  created_at TEXT NOT NULL
);

ALTER TABLE api_keys ADD COLUMN api_key_id TEXT;
ALTER TABLE api_keys ADD COLUMN project_id TEXT;
ALTER TABLE api_keys ADD COLUMN key_prefix TEXT;
ALTER TABLE api_keys ADD COLUMN key_hash TEXT;
ALTER TABLE api_keys ADD COLUMN last_used_at TEXT;

CREATE INDEX IF NOT EXISTS idx_api_keys_project_id ON api_keys(project_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_api_keys_key_hash ON api_keys(key_hash);

INSERT OR IGNORE INTO projects (project_id, name, created_at)
VALUES ('proj_demo_runtime_lab', 'Runtime Lab Demo', strftime('%Y-%m-%dT%H:%M:%fZ', 'now'));

UPDATE api_keys
SET
  api_key_id = COALESCE(api_key_id, api_key),
  key_prefix = COALESCE(key_prefix, api_key)
WHERE api_key_id IS NULL OR key_prefix IS NULL;
