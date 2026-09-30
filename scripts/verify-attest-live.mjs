/**
 * Live probe of POST /api/v1/attest against a DEPLOYED site and the real
 * registry on chain.
 *
 * This is deliberately an unlisted-wallet test. It signs a genuine EIP-712
 * attestation with a publicly known Anvil key that is NOT on the analyst
 * allowlist, so the only correct outcome is a 403 analyst_not_approved.
 *
 * What a pass proves, end to end and against production:
 *   - the registry address reached the BUILD (NEXT_PUBLIC_* is inlined at build
 *     time, so a missing value shows up as 503 registry_not_configured)
 *   - the server verified the EIP-712 signature over the correct domain
 *   - the server read the allowlist from the live contract
 *   - an unlisted analyst cannot get a record
 *
 * A 200 here would be the bug: it would mean the API stored an attestation the
 * registry would refuse.
 *
 * Usage:
 *   node scripts/verify-attest-live.mjs
 *   SITE_URL=https://fidex-beta.vercel.app node scripts/verify-attest-live.mjs
 */
import { privateKeyToAccount } from "viem/accounts";

const SITE = process.env.SITE_URL || "https://fidex-beta.vercel.app";
const REGISTRY = process.env.REGISTRY_ADDRESS || "0x15A64501Bdd5b1755B96b3CCa6208a643B899424";
const CHAIN_ID = Number(process.env.CHAIN_ID || 5042002);

// Anvil account #0. Well-known, and correct precisely because it is unlisted.
const TEST_KEY = "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80";
const analyst = privateKeyToAccount(TEST_KEY);

const DOMAIN = {
  name: "Fidex Studio",
  version: "1",
  chainId: CHAIN_ID,
  verifyingContract: REGISTRY,
};
const TYPES = {
  RatingAttestation: [
    { name: "slug", type: "string" },
    { name: "letter", type: "string" },
    { name: "score", type: "uint256" },
    { name: "analyst", type: "address" },
    { name: "timestamp", type: "uint256" },
  ],
};

const timestamp = Math.floor(Date.now() / 1000);
const message = { slug: "cirbtc", letter: "A", score: 85n, analyst: analyst.address, timestamp: BigInt(timestamp) };
const signature = await analyst.signTypedData({ domain: DOMAIN, types: TYPES, primaryType: "RatingAttestation", message });

console.log(`site      : ${SITE}`);
console.log(`registry  : ${REGISTRY}`);
console.log(`analyst   : ${analyst.address}  (not allowlisted)\n`);

const res = await fetch(`${SITE}/api/v1/attest`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    slug: "cirbtc", letter: "A", score: 85,
    analystAddress: analyst.address, signature, timestamp,
  }),
});
const text = await res.text();
let json; try { json = JSON.parse(text); } catch { json = { raw: text.slice(0, 300) }; }

console.log(`status    : ${res.status}`);
console.log(`body      : ${JSON.stringify(json, null, 2)}`);

const expectations = [
  ["registry is configured (not 503 registry_not_configured)", res.status !== 503 || json.error !== "registry_not_configured"],
  ["allowlist was read from the real contract", json.error === "analyst_not_approved"],
  ["unlisted analyst refused with 403", res.status === 403],
  ["no attestation recorded", !json.attestationId],
];

console.log("");
let bad = 0;
for (const [name, ok] of expectations) {
  if (!ok) bad++;
  console.log(`  ${ok ? "OK  " : "FAIL"} ${name}`);
}
process.exit(bad ? 1 : 0);