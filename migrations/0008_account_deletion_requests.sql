-- Safe account deletion request / soft-delete fields.
-- V1 records requests for review; it does not hard-delete tenant data.

ALTER TABLE users ADD COLUMN status TEXT NOT NULL DEFAULT 'active';
ALTER TABLE users ADD COLUMN delete_requested_at TEXT;
ALTER TABLE users ADD COLUMN deleted_at TEXT;

CREATE INDEX IF NOT EXISTS idx_users_status ON users(status);
CREATE INDEX IF NOT EXISTS idx_users_delete_requested_at ON users(delete_requested_at);
CREATE INDEX IF NOT EXISTS idx_users_deleted_at ON users(deleted_at);

ALTER TABLE workspaces ADD COLUMN status TEXT NOT NULL DEFAULT 'active';
ALTER TABLE workspaces ADD COLUMN delete_requested_at TEXT;
ALTER TABLE workspaces ADD COLUMN deleted_at TEXT;

CREATE INDEX IF NOT EXISTS idx_workspaces_status ON workspaces(status);
CREATE INDEX IF NOT EXISTS idx_workspaces_delete_requested_at ON workspaces(delete_requested_at);
CREATE INDEX IF NOT EXISTS idx_workspaces_deleted_at ON workspaces(deleted_at);
