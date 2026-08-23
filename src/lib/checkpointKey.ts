import { base64urlToBytes, bytesToBase64url } from "./receiptChain";

/**
 * The checkpoint signing key.
 *
 * Held as a base64url PKCS#8 private key in `AGENTWING_CHECKPOINT_KEY`.
 * Checkpoint signing is optional: without a key the chain still works and still
 * detects a quietly edited row. What the signature adds is detection of a
 * *wholesale rewrite* by someone with full database access — which is a real
 * threat precisely because it is the operator's own infrastructure.
 *
 * Generate one with:
 *   node scripts/generate-checkpoint-key.mjs
 *
 * The private key must not be rotatable by the same code path that writes
 * receipts. Anyone who can both sign checkpoints and rewrite the log can
 * produce a self-consistent forgery, so the signing key belongs in a secret
 * store the request path can read and nothing else can change.
 */

let cachedPublicKey: string | null | undefined;

export function checkpointSigningKey(): string | undefined {
  return process.env.AGENTWING_CHECKPOINT_KEY || undefined;
}

export function checkpointKeyId(): string {
  return process.env.AGENTWING_CHECKPOINT_KEY_ID || "default";
}

export function checkpointsEnabled(): boolean {
  return Boolean(checkpointSigningKey());
}

/**
 * The public half, derived from the configured private key.
 *
 * Derived rather than separately configured so the two cannot drift — a
 * published public key that does not match the signing key produces
 * verification failures that look like tampering.
 */
export async function checkpointPublicKey(): Promise<string | undefined> {
  if (cachedPublicKey !== undefined) return cachedPublicKey ?? undefined;

  const privateKey = checkpointSigningKey();
  if (!privateKey) {
    cachedPublicKey = null;
    return undefined;
  }

  try {
    const key = await globalThis.crypto.subtle.importKey(
      "pkcs8",
      base64urlToBytes(privateKey) as unknown as ArrayBuffer,
      { name: "ECDSA", namedCurve: "P-256" },
      true,
      ["sign"],
    );

    // WebCrypto cannot export a public key from a private CryptoKey directly,
    // so round-trip through JWK and re-import the public half.
    const jwk = await globalThis.crypto.subtle.exportKey("jwk", key);
    delete jwk.d;
    jwk.key_ops = ["verify"];

    const publicKey = await globalThis.crypto.subtle.importKey(
      "jwk",
      jwk,
      { name: "ECDSA", namedCurve: "P-256" },
      true,
      ["verify"],
    );

    const spki = await globalThis.crypto.subtle.exportKey("spki", publicKey);
    cachedPublicKey = bytesToBase64url(new Uint8Array(spki));
    return cachedPublicKey;
  } catch {
    // A malformed key must not break receipt export. The absence of a public
    // key in the export tells the verifier it cannot check a signature, which
    // is accurate.
    cachedPublicKey = null;
    return undefined;
  }
}

/** Tests only. */
export function __resetCheckpointKeyCache() {
  cachedPublicKey = undefined;
}
