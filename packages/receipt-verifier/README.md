# @agentwing/receipt-verifier

Verify an AgentWing receipt log **without trusting AgentWing**.

```bash
npx @agentwing/receipt-verifier export.json
```

```
✓ 4 entries verified
  head 028648ee3184242b7bfa500d29a54cfb76e8266f42dde5b41d59575859992dc9
  checkpoint signature valid
```

If someone has altered the log, it says where:

```
✗ this log does not verify (1 problem)

  [hash_mismatch] entry 2
    Entry 2 has been altered since it was written. Its contents do not match its hash.

  3 of 4 entries hashed correctly.
```

Exit code `0` if it verifies, `1` if it does not, `2` if the input could not be
read — so it drops straight into CI.

## Why this is a separate package

It contacts nothing and imports no AgentWing server code. That is the entire
point: a log you can only check by asking the party that wrote it is an
assertion, not evidence.

Every other agent control plane's "immutable audit trail" is a database table.
This one you can check yourself, offline, with software we do not control at the
moment you run it.

## What it checks

**The chain.** Each entry commits to the hash of the one before it, so altering
an entry invalidates every entry after it. A single edited row cannot be
repaired without rewriting the whole tail.

**The checkpoint.** Every so often AgentWing signs a statement — *this workspace's
log is N entries long and ends with this hash* — using ECDSA P-256. Rewriting
the tail to make the chain internally consistent again is still caught, because
the signed head no longer matches.

Detected: altered payloads, deleted entries, swapped positions, chains not
starting at genesis, entries spliced in from another workspace, entries
rewritten together with their own hash, and any rewrite after a checkpoint.

## Use it as a library

```ts
import { verifyChain } from "@agentwing/receipt-verifier";

const result = await verifyChain({ receipts, checkpoint, publicKey });

if (!result.ok) {
  for (const problem of result.problems) {
    console.error(problem.code, problem.seq, problem.message);
  }
}
```

Runs on Web Crypto, so it works in Node 18+, browsers, Deno, Bun and Workers.

## Export format

```json
{
  "workspaceId": "ws_...",
  "receipts": [
    {
      "seq": 1,
      "receiptId": "rcp_...",
      "workspaceId": "ws_...",
      "prevHash": "000…0",
      "hash": "028648ee…",
      "payload": { "decision": "block", "policy": "block-secret-file-access", "…": "…" }
    }
  ],
  "checkpoint": {
    "version": "awchain1",
    "workspaceId": "ws_...",
    "treeSize": 4,
    "headHash": "028648ee…",
    "issuedAt": "2026-08-23T00:00:00.000Z",
    "keyId": "default",
    "signature": "…"
  },
  "publicKey": "…"
}
```

`hash` is `SHA-256(canonical_json(entry) + "\n" + prevHash)`, where the canonical
form sorts object keys and omits insignificant whitespace — so two encodings of
the same object always hash identically.

Pass the public key with `--key` if it is not embedded in the export. Getting it
from somewhere other than the export is stronger: it means the log's author did
not choose the key you checked it against.

## What this does not do yet

No Merkle inclusion proofs, no external anchoring to a public transparency log.
Those raise the bar from *"you cannot quietly edit a row"* to *"you cannot
rewrite history even with full control of your own infrastructure"*. Documented
as the next step rather than implied by the current claim.

## Licence

Apache-2.0
