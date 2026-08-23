-- Outbound webhooks and request idempotency.

-- Where a workspace wants events delivered.
CREATE TABLE IF NOT EXISTS webhook_endpoints (
  endpoint_id   TEXT PRIMARY KEY,
  workspace_id  TEXT NOT NULL,
  url           TEXT NOT NULL,
  -- HMAC-SHA256 signing secret, shown once at creation.
  secret_hash   TEXT NOT NULL,
  secret_prefix TEXT NOT NULL,
  -- JSON array of event types, or NULL for everything.
  event_types   TEXT,
  description   TEXT,
  enabled       INTEGER NOT NULL DEFAULT 1,
  created_at    TEXT NOT NULL,
  updated_at    TEXT NOT NULL,
  -- Set when deliveries keep failing, so one dead endpoint cannot consume the
  -- delivery budget of every other one forever.
  disabled_at   TEXT,
  disabled_reason TEXT
);

CREATE INDEX IF NOT EXISTS idx_webhook_endpoints_workspace
  ON webhook_endpoints(workspace_id, enabled);

-- Every delivery attempt, kept so an operator can answer "did they get it".
CREATE TABLE IF NOT EXISTS webhook_deliveries (
  delivery_id   TEXT PRIMARY KEY,
  endpoint_id   TEXT NOT NULL,
  workspace_id  TEXT NOT NULL,
  event_id      TEXT NOT NULL,
  event_type    TEXT NOT NULL,
  status        TEXT NOT NULL,          -- pending | delivered | failed | dead
  attempts      INTEGER NOT NULL DEFAULT 0,
  response_status INTEGER,
  error         TEXT,
  payload_json  TEXT NOT NULL,
  created_at    TEXT NOT NULL,
  updated_at    TEXT NOT NULL,
  next_attempt_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_webhook_deliveries_pending
  ON webhook_deliveries(status, next_attempt_at);

CREATE INDEX IF NOT EXISTS idx_webhook_deliveries_workspace
  ON webhook_deliveries(workspace_id, created_at DESC);

-- Idempotency for mutating requests.
--
-- Without this a retried execute-action creates a second run AND a second
-- receipt for one real intent, which corrupts the audit trail the product
-- exists to produce. The UNIQUE key is what makes a replay a replay.
CREATE TABLE IF NOT EXISTS idempotency_keys (
  workspace_id  TEXT NOT NULL,
  idempotency_key TEXT NOT NULL,
  -- Guards against the same key being reused for a different request.
  request_hash  TEXT NOT NULL,
  response_status INTEGER NOT NULL,
  response_json TEXT NOT NULL,
  created_at    TEXT NOT NULL,
  expires_at    TEXT NOT NULL,
  PRIMARY KEY (workspace_id, idempotency_key)
);

CREATE INDEX IF NOT EXISTS idx_idempotency_expiry
  ON idempotency_keys(expires_at);
