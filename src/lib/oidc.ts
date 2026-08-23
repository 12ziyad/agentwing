/**
 * OpenID Connect.
 *
 * The existing Google flow had four defects, all of which this replaces:
 *
 *  - No PKCE. An intercepted authorization code could be redeemed by whoever
 *    intercepted it.
 *  - The id token was discarded entirely — the profile came from calling the
 *    userinfo endpoint with the access token, so nothing was ever verified
 *    against the issuer's signing keys.
 *  - `email_verified` was declared on the profile type and never read, so an
 *    unverified address was as good as a verified one.
 *  - No nonce, so a token minted for a different session could be replayed in.
 *
 * Everything here uses only Web Crypto, so it runs unchanged on Workers.
 */

export type Discovery = {
  issuer: string;
  authorization_endpoint: string;
  token_endpoint: string;
  jwks_uri: string;
  userinfo_endpoint?: string;
};

export type IdTokenClaims = {
  iss: string;
  sub: string;
  aud: string | string[];
  exp: number;
  iat: number;
  nonce?: string;
  email?: string;
  email_verified?: boolean;
  name?: string;
  picture?: string;
  groups?: string[];
  [claim: string]: unknown;
};

export class OidcError extends Error {
  readonly code: string;

  constructor(message: string, code: string) {
    super(message);
    this.name = "OidcError";
    this.code = code;
  }
}

// ---------------------------------------------------------------------------
// PKCE
// ---------------------------------------------------------------------------

function base64url(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function base64urlToBytes(value: string): Uint8Array {
  const padded = value.replace(/-/g, "+").replace(/_/g, "/");
  const binary = atob(padded + "=".repeat((4 - (padded.length % 4)) % 4));
  return Uint8Array.from(binary, (c) => c.charCodeAt(0));
}

export function randomUrlSafe(byteLength = 32): string {
  const bytes = new Uint8Array(byteLength);
  globalThis.crypto.getRandomValues(bytes);
  return base64url(bytes);
}

/** S256, the only method worth using — `plain` provides no protection at all. */
export async function codeChallenge(verifier: string): Promise<string> {
  const digest = await globalThis.crypto.subtle.digest("SHA-256", new TextEncoder().encode(verifier));
  return base64url(new Uint8Array(digest));
}

// ---------------------------------------------------------------------------
// Discovery and JWKS
// ---------------------------------------------------------------------------

const discoveryCache = new Map<string, { value: Discovery; expiresAt: number }>();
const jwksCache = new Map<string, { keys: JsonWebKey[]; expiresAt: number }>();

const CACHE_TTL_MS = 10 * 60 * 1000;

export async function discover(issuer: string, fetchImpl: typeof fetch = fetch): Promise<Discovery> {
  const normalized = issuer.replace(/\/+$/, "");
  const cached = discoveryCache.get(normalized);
  if (cached && cached.expiresAt > Date.now()) return cached.value;

  const response = await fetchImpl(`${normalized}/.well-known/openid-configuration`, {
    signal: AbortSignal.timeout(5_000),
  });
  if (!response.ok) {
    throw new OidcError(`Could not read OpenID configuration from ${normalized}.`, "discovery_failed");
  }

  const value = (await response.json()) as Discovery;

  // The issuer in the document must match the one we asked about, or we are
  // being redirected to a provider we did not choose.
  if (value.issuer.replace(/\/+$/, "") !== normalized) {
    throw new OidcError(
      `The provider at ${normalized} identifies itself as ${value.issuer}.`,
      "issuer_mismatch",
    );
  }

  discoveryCache.set(normalized, { value, expiresAt: Date.now() + CACHE_TTL_MS });
  return value;
}

async function fetchJwks(jwksUri: string, fetchImpl: typeof fetch): Promise<JsonWebKey[]> {
  const cached = jwksCache.get(jwksUri);
  if (cached && cached.expiresAt > Date.now()) return cached.keys;

  const response = await fetchImpl(jwksUri, { signal: AbortSignal.timeout(5_000) });
  if (!response.ok) throw new OidcError("Could not fetch the provider's signing keys.", "jwks_failed");

  const body = (await response.json()) as { keys?: JsonWebKey[] };
  const keys = body.keys ?? [];
  jwksCache.set(jwksUri, { keys, expiresAt: Date.now() + CACHE_TTL_MS });
  return keys;
}

// ---------------------------------------------------------------------------
// id_token verification
// ---------------------------------------------------------------------------

type JwtHeader = { alg: string; kid?: string; typ?: string };

function decodeSegment<T>(segment: string): T {
  return JSON.parse(new TextDecoder().decode(base64urlToBytes(segment))) as T;
}

const ALGORITHMS: Record<string, { name: string; hash: string; namedCurve?: string }> = {
  RS256: { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
  RS384: { name: "RSASSA-PKCS1-v1_5", hash: "SHA-384" },
  RS512: { name: "RSASSA-PKCS1-v1_5", hash: "SHA-512" },
  ES256: { name: "ECDSA", hash: "SHA-256", namedCurve: "P-256" },
};

/**
 * Verify an id token properly.
 *
 * Signature against the issuer's published keys, then issuer, audience,
 * expiry, and nonce. Skipping any one of these turns the token into a claim
 * anybody can make.
 */
export async function verifyIdToken(
  idToken: string,
  options: {
    discovery: Discovery;
    clientId: string;
    nonce: string;
    fetchImpl?: typeof fetch;
    now?: number;
    clockSkewSeconds?: number;
  },
): Promise<IdTokenClaims> {
  const fetchImpl = options.fetchImpl ?? fetch;
  const now = options.now ?? Date.now();
  const skew = options.clockSkewSeconds ?? 60;

  const parts = idToken.split(".");
  if (parts.length !== 3) throw new OidcError("The id token is malformed.", "malformed_token");

  const [headerSegment, payloadSegment, signatureSegment] = parts as [string, string, string];
  const header = decodeSegment<JwtHeader>(headerSegment);

  // `alg: none` is the classic JWT forgery. An algorithm we do not explicitly
  // support is refused rather than trusted.
  const algorithm = ALGORITHMS[header.alg];
  if (!algorithm) throw new OidcError(`Unsupported id token algorithm: ${header.alg}.`, "unsupported_algorithm");

  const keys = await fetchJwks(options.discovery.jwks_uri, fetchImpl);
  const candidates = header.kid ? keys.filter((k) => (k as { kid?: string }).kid === header.kid) : keys;
  if (candidates.length === 0) throw new OidcError("No matching signing key was published by the provider.", "no_signing_key");

  const signature = base64urlToBytes(signatureSegment);
  const signed = new TextEncoder().encode(`${headerSegment}.${payloadSegment}`);

  let verified = false;
  for (const jwk of candidates) {
    try {
      const key = await globalThis.crypto.subtle.importKey(
        "jwk",
        jwk,
        algorithm.namedCurve
          ? { name: algorithm.name, namedCurve: algorithm.namedCurve }
          : { name: algorithm.name, hash: algorithm.hash },
        false,
        ["verify"],
      );

      const ok = await globalThis.crypto.subtle.verify(
        algorithm.namedCurve ? { name: algorithm.name, hash: algorithm.hash } : algorithm.name,
        key,
        signature as unknown as ArrayBuffer,
        signed as unknown as ArrayBuffer,
      );

      if (ok) {
        verified = true;
        break;
      }
    } catch {
      // Wrong key for this token; try the next.
    }
  }

  if (!verified) throw new OidcError("The id token signature is not valid.", "bad_signature");

  const claims = decodeSegment<IdTokenClaims>(payloadSegment);

  if (claims.iss.replace(/\/+$/, "") !== options.discovery.issuer.replace(/\/+$/, "")) {
    throw new OidcError("The id token was issued by a different provider.", "issuer_mismatch");
  }

  const audiences = Array.isArray(claims.aud) ? claims.aud : [claims.aud];
  if (!audiences.includes(options.clientId)) {
    // A token minted for another client is not ours to accept.
    throw new OidcError("The id token was issued for a different application.", "audience_mismatch");
  }

  if (typeof claims.exp !== "number" || claims.exp + skew < now / 1000) {
    throw new OidcError("The id token has expired.", "token_expired");
  }

  if (typeof claims.iat === "number" && claims.iat - skew > now / 1000) {
    throw new OidcError("The id token is dated in the future.", "token_not_yet_valid");
  }

  // Binds the token to the authorization request we started, so one obtained
  // for a different session cannot be replayed into this one.
  if (claims.nonce !== options.nonce) {
    throw new OidcError("The id token does not match this sign-in attempt.", "nonce_mismatch");
  }

  if (!claims.sub) throw new OidcError("The id token carries no subject.", "missing_subject");

  return claims;
}

/**
 * The email an identity may be associated with.
 *
 * An unverified address is refused. Without this, anyone who can register an
 * account at a permissive IdP claiming someone else's address inherits whatever
 * that address is trusted for.
 */
export function verifiedEmail(claims: IdTokenClaims): string {
  if (!claims.email) throw new OidcError("The provider returned no email address.", "missing_email");
  if (claims.email_verified !== true) {
    throw new OidcError(
      "That email address is not verified with your identity provider. Verify it there, then sign in again.",
      "email_not_verified",
    );
  }
  return claims.email.toLowerCase();
}

/** Tests only. */
export function __clearOidcCaches() {
  discoveryCache.clear();
  jwksCache.clear();
}
