/**
 * Generate a checkpoint signing key.
 *
 *   node scripts/generate-checkpoint-key.mjs
 *
 * Store the private key as the AGENTWING_CHECKPOINT_KEY secret. Publish the
 * public key so anyone can verify an exported receipt log without asking you
 * for anything.
 */

const toBase64url = (bytes) => {
  let binary = "";
  for (const byte of new Uint8Array(bytes)) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
};

const pair = await crypto.subtle.generateKey({ name: "ECDSA", namedCurve: "P-256" }, true, ["sign", "verify"]);

const privateKey = toBase64url(await crypto.subtle.exportKey("pkcs8", pair.privateKey));
const publicKey = toBase64url(await crypto.subtle.exportKey("spki", pair.publicKey));

console.log("Private key — set this as a secret, never commit it:\n");
console.log(`  npx wrangler secret put AGENTWING_CHECKPOINT_KEY`);
console.log(`  ${privateKey}\n`);
console.log("Public key — publish this so anyone can verify your receipts:\n");
console.log(`  ${publicKey}\n`);
