import { getAgentWingD1 } from "./cloudflareD1";
import { codeChallenge, randomUrlSafe } from "./oidc";

/**
 * In-flight authorization requests.
 *
 * The PKCE verifier and the nonce live server-side, keyed by `state`, rather
 * than in a cookie. A cookie holding the verifier can be read or replaced by
 * anything running in the browser, which defeats the point of PKCE — its whole
 * job is to prove that the party redeeming the code is the party that started
 * the flow.
 *
 * Transactions are single-use and short-lived: a consumed one cannot be
 * replayed, and an abandoned one expires rather than lingering.
 */

export const TRANSACTION_TTL_MS = 10 * 60 * 1000;

export type OAuthTransaction = {
  state: string;
  provider: string;
  connectionId?: string;
  codeVerifier: string;
  nonce: string;
  redirectTo?: string;
};

export type StartedTransaction = OAuthTransaction & { codeChallenge: string };

export async function startTransaction(options: {
  provider: string;
  connectionId?: string;
  redirectTo?: string;
  now?: number;
}): Promise<StartedTransaction> {
  const now = options.now ?? Date.now();
  const transaction: OAuthTransaction = {
    state: randomUrlSafe(24),
    provider: options.provider,
    connectionId: options.connectionId,
    codeVerifier: randomUrlSafe(32),
    nonce: randomUrlSafe(16),
    redirectTo: options.redirectTo,
  };

  const db = await getAgentWingD1();
  if (db) {
    await db
      .prepare(
        `INSERT INTO oauth_transactions
         (state, connection_id, provider, code_verifier, nonce, redirect_to, created_at, expires_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .bind(
        transaction.state,
        transaction.connectionId ?? null,
        transaction.provider,
        transaction.codeVerifier,
        transaction.nonce,
        transaction.redirectTo ?? null,
        new Date(now).toISOString(),
        new Date(now + TRANSACTION_TTL_MS).toISOString(),
      )
      .run();
  }

  return { ...transaction, codeChallenge: await codeChallenge(transaction.codeVerifier) };
}

/**
 * Claim a transaction exactly once.
 *
 * The `consumed_at IS NULL` predicate makes this a compare-and-swap, so a
 * replayed callback finds nothing to claim rather than starting a second
 * session from one authorization.
 */
export async function consumeTransaction(state: string, now = Date.now()): Promise<OAuthTransaction | undefined> {
  const db = await getAgentWingD1();
  if (!db) return undefined;

  const claimed = await db
    .prepare("UPDATE oauth_transactions SET consumed_at = ? WHERE state = ? AND consumed_at IS NULL AND expires_at > ?")
    .bind(new Date(now).toISOString(), state, new Date(now).toISOString())
    .run();

  if ((claimed.meta?.changes ?? 0) === 0) return undefined;

  const row = await db
    .prepare("SELECT state, connection_id, provider, code_verifier, nonce, redirect_to FROM oauth_transactions WHERE state = ?")
    .bind(state)
    .first<{
      state: string;
      connection_id: string | null;
      provider: string;
      code_verifier: string;
      nonce: string;
      redirect_to: string | null;
    }>();

  if (!row) return undefined;

  return {
    state: row.state,
    provider: row.provider,
    connectionId: row.connection_id ?? undefined,
    codeVerifier: row.code_verifier,
    nonce: row.nonce,
    redirectTo: row.redirect_to ?? undefined,
  };
}

/** Remove expired and consumed transactions. Called by the scheduled job. */
export async function sweepTransactions(now = Date.now(), limit = 500): Promise<number> {
  const db = await getAgentWingD1();
  if (!db) return 0;

  const result = await db
    .prepare(
      `DELETE FROM oauth_transactions
       WHERE rowid IN (SELECT rowid FROM oauth_transactions WHERE expires_at <= ? LIMIT ?)`,
    )
    .bind(new Date(now).toISOString(), limit)
    .run();

  return result.meta?.changes ?? 0;
}
