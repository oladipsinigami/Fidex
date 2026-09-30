/**
 * Live verification of the attestation path against a DEPLOYED site and the
 * real registry on chain.
 *
 * Checks four things that can only be proven against a live deployment:
 *
 *   1. NEXT_PUBLIC_FIDEX_REGISTRY_ADDRESS reached the BUILD. NEXT_PUBLIC_ values
 *      are inlined at build time, so a missing one yields 503
 *      registry_not_configured rather than any runtime error.
 *   2. The deployed contract's ATTESTATION_EXPIRY still equals the TypeScript
 *      constant. They are duplicated deliberately, and silent drift would mean
 *      the API accepts signatures the chain rejects.
 *   3. The rules the API is responsible for: allowlist, replay, expiry,
 *      future-dating.
 *   4. That a rejected request stored nothing.
 *
 * Run:
 *   npm run verify:attest:live
 *   SITE_URL=... REGISTRY_ADDRESS=... CHAIN_ID=... npm run verify:attest:live
 */
import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { createPublicClient, http } from "viem";
import { arc, arcTestnet } from "viem/chains";
import { privateKeyToAccount } from "viem/accounts";
// Imported for real rather than re-declared, so the expiry constant has one
// source of truth. Type stripping is why this script needs the flag below.
import { ATTESTATION_EXPIRY_SECONDS, ATTESTATION_DOMAIN, ATTESTATION_TYPES } from "../lib/attestation.ts";

const SITE = process.env.SITE_URL || "https://fidex-beta.vercel.app";
const REGISTRY = process.env.REGISTRY_ADDRESS || "0x15A64501Bdd5b1755B96b3CCa6208a643B899424";
const CHAIN_ID = Number(process.env.CHAIN_ID || 5042002);
const IS_TESTNET = CHAIN_ID === 5042002;
const SLUG = "cirbtc";

// Anvil account #0, allowlisted on the testnet registry.
const ANALYST_KEY = "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80";
const analyst = privateKeyToAccount(ANALYST_KEY);
const stranger = privateKeyToAccount("0x" + randomBytes(32).toString("hex"));

const client = createPublicClient({
  chain: IS_TESTNET ? arcTestnet : arc,
  transport: http(IS_TESTNET ? "https://rpc.testnet.arc.io" : "https://rpc.mainnet.arc.io"),
});

const DOMAIN = {
  name: ATTESTATION_DOMAIN.name,
  version: ATTESTATION_DOMAIN.version,
  chainId: CHAIN_ID,
  verifyingContract: REGISTRY,
};

let failures = 0;
const check = (name, fn) => {
  try { fn(); console.log(`  PASS  ${name}`); }
  catch (e) { failures++; console.error(`  FAIL  ${name}\n        ${e.message}`); }
};

async function sign(account, { slug = SLUG, letter = "A", score = 80, timestamp }) {
  const ts = timestamp ?? Math.floor(Date.now() / 1000);
  const message = { slug, letter, score: BigInt(score), analyst: account.address, timestamp: BigInt(ts) };
  const signature = await account.signTypedData({
    domain: DOMAIN, types: ATTESTATION_TYPES, primaryType: "RatingAttestation", message,
  });
  return { slug, letter, score, analystAddress: account.address, signature, timestamp: ts };
}

async function post(payload) {
  const res = await fetch(`${SITE}/api/v1/attest`, {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload),
  });
  let json; try { json = await res.json(); } catch { json = {}; }
  return { status: res.status, json };
}

console.log(`\n=== live attestation verification ===`);
console.log(`site      : ${SITE}`);
console.log(`registry  : ${REGISTRY}`);
console.log(`chain     : ${CHAIN_ID}\n`);

console.log("--- on-chain ---");
let chainExpiry = null;
try {
  chainExpiry = await client.readContract({
    address: REGISTRY,
    abi: [{ type: "function", name: "ATTESTATION_EXPIRY", stateMutability: "view", inputs: [], outputs: [{ type: "uint256" }] }],
    functionName: "ATTESTATION_EXPIRY",
  });
} catch (e) {
  console.error(`  could not read ATTESTATION_EXPIRY: ${e.message}`);
  failures++;
}

check("deployed ATTESTATION_EXPIRY matches lib/attestation.ts", () => {
  assert(chainExpiry !== null, "chain value unavailable");
  assert.strictEqual(
    Number(chainExpiry), ATTESTATION_EXPIRY_SECONDS,
    `contract says ${chainExpiry}, TypeScript says ${ATTESTATION_EXPIRY_SECONDS}`,
  );
});

let analystApproved = null;
try {
  analystApproved = await client.readContract({
    address: REGISTRY,
    abi: [{ type: "function", name: "isApprovedAnalyst", stateMutability: "view",
            inputs: [{ name: "a", type: "address" }], outputs: [{ type: "bool" }] }],
    functionName: "isApprovedAnalyst",
    args: [analyst.address],
  });
} catch (e) {
  console.error(`  could not read the allowlist: ${e.message}`);
  failures++;
}

console.log(`\n--- api (analyst ${analyst.address}, allowlisted=${analystApproved}) ---\n`);

const fresh = await sign(analyst, {});
const first = await post(fresh);
check("allowlisted analyst records an attestation (200)", () => {
  assert.strictEqual(first.status, 200, `got ${first.status} ${JSON.stringify(first.json)}`);
  assert(first.json.attestationId, "no attestationId returned");
});

const replay = await post(fresh);
check("replaying the identical signature is refused (409)", () => {
  assert.strictEqual(replay.status, 409, `got ${replay.status} ${JSON.stringify(replay.json)}`);
  assert.strictEqual(replay.json.error, "signature_replayed");
  assert(!replay.json.attestationId, "a replay must not mint a new id");
});

const expiredPayload = await sign(analyst, {
  letter: "B", score: 70, timestamp: Math.floor(Date.now() / 1000) - ATTESTATION_EXPIRY_SECONDS - 60,
});
const expired = await post(expiredPayload);
check("an expired signature is refused (400)", () => {
  assert.strictEqual(expired.status, 400, `got ${expired.status} ${JSON.stringify(expired.json)}`);
  assert.strictEqual(expired.json.error, "signature_expired");
});

const futurePayload = await sign(analyst, {
  letter: "C", score: 60, timestamp: Math.floor(Date.now() / 1000) + 86_400,
});
const future = await post(futurePayload);
check("a future-dated signature is refused (400)", () => {
  assert.strictEqual(future.status, 400, `got ${future.status} ${JSON.stringify(future.json)}`);
  assert.strictEqual(future.json.error, "signature_future_dated");
});

const unlistedPayload = await sign(stranger, { letter: "A", score: 99 });
const unlisted = await post(unlistedPayload);
check("an unlisted analyst is refused (403)", () => {
  assert.strictEqual(unlisted.status, 403, `got ${unlisted.status} ${JSON.stringify(unlisted.json)}`);
  assert.strictEqual(unlisted.json.error, "analyst_not_approved");
});

const stored = await (await fetch(`${SITE}/api/v1/attest?slug=${SLUG}`)).json();
const storedSigs = (stored.attestations || []).map((a) => a.signature?.toLowerCase());

check("the replayed signature is stored exactly once", () => {
  const rows = storedSigs.filter((s) => s === fresh.signature.toLowerCase());
  assert.strictEqual(rows.length, 1, `found ${rows.length} rows for one signature`);
});

// Taken from the signed payloads, not the responses: a rejection carries no
// signature field, so reading them from the response would make this vacuous.
check("no rejected payload was stored", () => {
  for (const [label, payload] of [["expired", expiredPayload], ["future-dated", futurePayload], ["unlisted", unlistedPayload]]) {
    assert(
      !storedSigs.includes(payload.signature.toLowerCase()),
      `the ${label} signature was stored`,
    );
  }
});

if (failures) { console.error(`\n${failures} check(s) failed\n`); process.exit(1); }
console.log("\nAll live attestation checks passed.\n");
process.exit(0);