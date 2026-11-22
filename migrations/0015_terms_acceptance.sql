CREATE TABLE IF NOT EXISTS terms_acceptances (
  user_id TEXT NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  terms_version TEXT NOT NULL,
  accepted_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  PRIMARY KEY (user_id, terms_version)
);
