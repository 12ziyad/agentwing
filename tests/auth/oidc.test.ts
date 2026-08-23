import { beforeEach, describe, expect, it } from "vitest";
import { __clearOidcCaches, codeChallenge, discover, OidcError, randomUrlSafe, verifiedEmail, verifyIdToken } from "@/lib/oidc";
import type { Discovery, IdTokenClaims } from "@/lib/oidc";

/**
 * The Google flow this replaces had four defects, each of which turns an id
 * token into a claim anybody can make: no PKCE, the id token discarded entirely
 * in favour of a userinfo call, `email_verified` never read, and no nonce.
 */

beforeEach(() => {
  __clearOidcCaches();
});

// --- test signing key -------------------------------------------------------

async function makeKey() {
  const pair = await crypto.subtle.generateKey(
    { name: "RSASSA-PKCS1-v1_5", modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: "SHA-256" },
    true,
    ["sign", "verify"],
  );
  const jwk = await crypto.subtle.exportKey("jwk", pair.publicKey);
  return { pair, jwk: { ...jwk, kid: "test-key", alg: "RS256", use: "sig" } };
}

function b64url(input: string | Uint8Array): string {
  const bytes = typeof input === "string" ? new TextEncoder().encode(input) : input;
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

async function signToken(privateKey: CryptoKey, claims: Partial<IdTokenClaims>, header: Record<string, unknown> = {}) {
  const h = b64url(JSON.stringify({ alg: "RS256", kid: "test-key", typ: "JWT", ...header }));
  const p = b64url(JSON.stringify(claims));
  const signature = await crypto.subtle.sign(
    "RSASSA-PKCS1-v1_5",
    privateKey,
    new TextEncoder().encode(`${h}.${p}`) as unknown as ArrayBuffer,
  );
  return `${h}.${p}.${b64url(new Uint8Array(signature))}`;
}

const ISSUER = "https://idp.test";

const discovery: Discovery = {
  issuer: ISSUER,
  authorization_endpoint: `${ISSUER}/authorize`,
  token_endpoint: `${ISSUER}/token`,
  jwks_uri: `${ISSUER}/jwks`,
};

function jwksFetch(jwk: JsonWebKey): typeof fetch {
  return (async (url: string) => {
    if (String(url).endsWith("/jwks")) {
      return new Response(JSON.stringify({ keys: [jwk] }), { headers: { "content-type": "application/json" } });
    }
    return new Response("not found", { status: 404 });
  }) as unknown as typeof fetch;
}

const baseClaims = (overrides: Partial<IdTokenClaims> = {}): Partial<IdTokenClaims> => ({
  iss: ISSUER,
  sub: "user-123",
  aud: "client-abc",
  exp: Math.floor(Date.now() / 1000) + 600,
  iat: Math.floor(Date.now() / 1000),
  nonce: "nonce-1",
  email: "person@example.com",
  email_verified: true,
  ...overrides,
});

describe("PKCE", () => {
  it("produces a distinct verifier each time", () => {
    expect(randomUrlSafe()).not.toBe(randomUrlSafe());
  });

  it("derives an S256 challenge that is not the verifier", async () => {
    // `plain` provides no protection at all — the point is that an intercepted
    // code cannot be redeemed without the verifier.
    const verifier = randomUrlSafe();
    const challenge = await codeChallenge(verifier);
    expect(challenge).not.toBe(verifier);
    expect(challenge).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(await codeChallenge(verifier)).toBe(challenge);
  });
});

describe("id token verification", () => {
  it("accepts a properly signed token", async () => {
    const { pair, jwk } = await makeKey();
    const token = await signToken(pair.privateKey, baseClaims());

    const claims = await verifyIdToken(token, {
      discovery,
      clientId: "client-abc",
      nonce: "nonce-1",
      fetchImpl: jwksFetch(jwk),
    });

    expect(claims.sub).toBe("user-123");
  });

  it("rejects a token signed by a different key", async () => {
    const signer = await makeKey();
    const publisher = await makeKey();
    const token = await signToken(signer.pair.privateKey, baseClaims());

    await expect(
      verifyIdToken(token, { discovery, clientId: "client-abc", nonce: "nonce-1", fetchImpl: jwksFetch(publisher.jwk) }),
    ).rejects.toMatchObject({ code: "bad_signature" });
  });

  it("rejects alg: none", async () => {
    // The classic JWT forgery: strip the signature and declare it unsigned.
    const { jwk } = await makeKey();
    const header = b64url(JSON.stringify({ alg: "none", typ: "JWT" }));
    const payload = b64url(JSON.stringify(baseClaims()));

    await expect(
      verifyIdToken(`${header}.${payload}.`, {
        discovery,
        clientId: "client-abc",
        nonce: "nonce-1",
        fetchImpl: jwksFetch(jwk),
      }),
    ).rejects.toMatchObject({ code: "unsupported_algorithm" });
  });

  it("rejects a token from a different issuer", async () => {
    const { pair, jwk } = await makeKey();
    const token = await signToken(pair.privateKey, baseClaims({ iss: "https://evil.test" }));

    await expect(
      verifyIdToken(token, { discovery, clientId: "client-abc", nonce: "nonce-1", fetchImpl: jwksFetch(jwk) }),
    ).rejects.toMatchObject({ code: "issuer_mismatch" });
  });

  it("rejects a token minted for another application", async () => {
    const { pair, jwk } = await makeKey();
    const token = await signToken(pair.privateKey, baseClaims({ aud: "someone-elses-client" }));

    await expect(
      verifyIdToken(token, { discovery, clientId: "client-abc", nonce: "nonce-1", fetchImpl: jwksFetch(jwk) }),
    ).rejects.toMatchObject({ code: "audience_mismatch" });
  });

  it("rejects an expired token", async () => {
    const { pair, jwk } = await makeKey();
    const token = await signToken(pair.privateKey, baseClaims({ exp: Math.floor(Date.now() / 1000) - 3600 }));

    await expect(
      verifyIdToken(token, { discovery, clientId: "client-abc", nonce: "nonce-1", fetchImpl: jwksFetch(jwk) }),
    ).rejects.toMatchObject({ code: "token_expired" });
  });

  it("rejects a token replayed from a different sign-in", async () => {
    // Without the nonce check, a token obtained in one session can be injected
    // into another.
    const { pair, jwk } = await makeKey();
    const token = await signToken(pair.privateKey, baseClaims({ nonce: "some-other-nonce" }));

    await expect(
      verifyIdToken(token, { discovery, clientId: "client-abc", nonce: "nonce-1", fetchImpl: jwksFetch(jwk) }),
    ).rejects.toMatchObject({ code: "nonce_mismatch" });
  });

  it("accepts an audience array containing our client", async () => {
    const { pair, jwk } = await makeKey();
    const token = await signToken(pair.privateKey, baseClaims({ aud: ["other", "client-abc"] }));

    await expect(
      verifyIdToken(token, { discovery, clientId: "client-abc", nonce: "nonce-1", fetchImpl: jwksFetch(jwk) }),
    ).resolves.toMatchObject({ sub: "user-123" });
  });
});

describe("email verification", () => {
  it("accepts a verified address, lowercased", () => {
    expect(verifiedEmail({ email: "Person@Example.com", email_verified: true } as IdTokenClaims)).toBe(
      "person@example.com",
    );
  });

  it("refuses an unverified address", () => {
    // Otherwise anyone who can register at a permissive IdP claiming someone
    // else's address inherits whatever that address is trusted for.
    expect(() => verifiedEmail({ email: "x@y.com", email_verified: false } as IdTokenClaims)).toThrow(
      /not verified/i,
    );
  });

  it("refuses a missing address", () => {
    expect(() => verifiedEmail({} as IdTokenClaims)).toThrow(OidcError);
  });
});

describe("discovery", () => {
  it("refuses a document that names a different issuer", async () => {
    // Otherwise we follow a redirect to a provider we did not choose.
    const fetchImpl = (async () =>
      new Response(JSON.stringify({ ...discovery, issuer: "https://evil.test" }), {
        headers: { "content-type": "application/json" },
      })) as unknown as typeof fetch;

    await expect(discover(ISSUER, fetchImpl)).rejects.toMatchObject({ code: "issuer_mismatch" });
  });

  it("surfaces an unreachable provider rather than continuing", async () => {
    const fetchImpl = (async () => new Response("nope", { status: 500 })) as unknown as typeof fetch;
    await expect(discover(ISSUER, fetchImpl)).rejects.toMatchObject({ code: "discovery_failed" });
  });
});
