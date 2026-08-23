-- Federated identity.
--
-- Two problems this fixes.
--
-- 1. Account takeover. upsertGoogleUserAndWorkspace matched an existing user by
--    EMAIL and overwrote provider_account_id with the new subject. Anyone who
--    could get an id token for a matching email took over the account, and the
--    legitimate owner was locked out of their own. Identity is now keyed on
--    (provider, subject) in its own table, which is the only pair an IdP
--    actually guarantees.
--
-- 2. Google was the only way in.

CREATE TABLE IF NOT EXISTS user_identities (
  identity_id  TEXT PRIMARY KEY,
  user_id      TEXT NOT NULL,
  provider     TEXT NOT NULL,          -- 'google' | 'oidc:<connection_id>'
  subject      TEXT NOT NULL,          -- the IdP's `sub`, stable per user
  email        TEXT,
  email_verified INTEGER NOT NULL DEFAULT 0,
  created_at   TEXT NOT NULL,
  last_login_at TEXT
);

-- The identity key. One subject at one provider is exactly one user, and no
-- amount of email collision changes that.
CREATE UNIQUE INDEX IF NOT EXISTS idx_user_identities_provider_subject
  ON user_identities(provider, subject);

CREATE INDEX IF NOT EXISTS idx_user_identities_user
  ON user_identities(user_id);

-- Per-workspace OIDC connections, so an organisation signs in with its own IdP.
CREATE TABLE IF NOT EXISTS sso_connections (
  connection_id TEXT PRIMARY KEY,
  workspace_id  TEXT NOT NULL,
  -- Issuer URL. Discovery is fetched from <issuer>/.well-known/openid-configuration.
  issuer        TEXT NOT NULL,
  client_id     TEXT NOT NULL,
  client_secret_encrypted TEXT NOT NULL,
  -- Email domains routed to this connection, JSON array, lowercased.
  domains       TEXT NOT NULL,
  -- Optional claim -> role mapping, JSON object.
  role_mapping  TEXT,
  enabled       INTEGER NOT NULL DEFAULT 1,
  created_at    TEXT NOT NULL,
  updated_at    TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_sso_connections_workspace
  ON sso_connections(workspace_id);

-- In-flight authorization requests.
--
-- PKCE verifier and nonce live server-side rather than in a cookie, so neither
-- can be read or replaced by anything running in the browser. Single-use, and
-- short-lived.
CREATE TABLE IF NOT EXISTS oauth_transactions (
  state         TEXT PRIMARY KEY,
  connection_id TEXT,
  provider      TEXT NOT NULL,
  code_verifier TEXT NOT NULL,
  nonce         TEXT NOT NULL,
  redirect_to   TEXT,
  created_at    TEXT NOT NULL,
  expires_at    TEXT NOT NULL,
  consumed_at   TEXT
);

CREATE INDEX IF NOT EXISTS idx_oauth_transactions_expiry
  ON oauth_transactions(expires_at);
