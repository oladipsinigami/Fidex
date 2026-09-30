/**
 * Tests the three attestation rules that used to be enforced only on-chain.
 *
 * FidexRegistry rejects a replayed signature (SignatureAlreadyUsed), an expired
 * timestamp and a future-dated one (SignatureExpired). The API enforced none of
 * them, so it happily stored records the registry would refuse to write.
 *
 * Runs against a locally spawned server and an isolated database, but reads the
 * allowlist from the REAL testnet registry, because these checks sit after
 * signature verification.
 *
 * Run: node scripts/test-attestation-rules.mjs
 */
import assert from "node:assert";
import { spawn } from "node:child_process";
import { existsSync, rmSync } from "node:fs";
import path from "node:path";
import { privateKeyToAccount } from "viem/accounts";
import { randomBytes } from "node:crypto";

const REGISTRY = process.env.REGISTRY_ADDRESS || "0x15A64501Bdd5b1755B96b3CCa6208a643B899424";
const CHAIN_ID = 5042002;
const PORT = Number(process.env.PORT || 3123);
const BASE = `http://127.0.0.1:${PORT}`;
const DB_PATH = path.join(process.cwd(), "data", "attest-rules-test.db");

const DOMAIN = { name: "Fidex Studio", version: "1", chainId: CHAIN_ID, verifyingContract: REGISTRY };
const TYPES = { RatingAttestation: [
  { name: "slug", type: "string" }, { name: "letter", type: "string" },
  { name: "score", type: "uint256" }, { name: "analyst", type: "address" },
  { name: "timestamp", type: "uint256" }] };

// Anvil account #0, which is allowlisted on the testnet registry.
const ANALYST_KEY = "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80";
const analyst = privateKeyToAccount(ANALYST_KEY);
const stranger = privateKeyToAccount("0x" + randomBytes(32).toString("hex"));

for (const f of [DB_PATH, `${DB_PATH}-wal`, `${DB_PATH}-shm`]) {
  if (existsSync(f)) rmSync(f, { force: true });
}

const server = spawn(process.execPath, ["node_modules/next/dist/bin/next", "start", "-p", String(PORT)], {
  env: {
    ...process.env,
    FIDEX_SECRET: "attest-rules-test-only",
    ARCGRADE_SECRET: "attest-rules-test-only",
    FIDEX_PUBLIC_URL: BASE,
    ARCGRADE_PUBLIC_URL: BASE,
    NEXT_PUBLIC_FIDEX_REGISTRY_ADDRESS: REGISTRY,
    NEXT_PUBLIC_FIDEX_NETWORK: "testnet",
    FIDEX_DB_PATH: DB_PATH,
    // Force the local file store even if a Turso URL is in the environment, so
    // a test run can never write to the real database.
    TURSO_DATABASE_URL: "",
    TURSO_AUTH_TOKEN: "",
  },
  stdio: ["ignore", "ignore", "inherit"],
});

async function post(account, { slug = "cirbtc", letter = "A", score = 80, timestamp }) {
  const ts = timestamp ?? Math.floor(Date.now() / 1000);
  const message = { slug, letter, score: BigInt(score), analyst: account.address, timestamp: BigInt(ts) };
  const signature = await account.signTypedData({ domain: DOMAIN, types: TYPES, primaryType: "RatingAttestation", message });
  const res = await fetch(`${BASE}/api/v1/attest`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ slug, letter, score, analystAddress: account.address, signature, timestamp: ts }),
  });
  let json; try { json = await res.json(); } catch { json = {}; }
  return { status: res.status, json, payload: { slug, letter, score, analystAddress: account.address, signature, timestamp: ts } };
}

function repost(payload) {
  return fetch(`${BASE}/api/v1/attest`, {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload),
  }).then(async (r) => ({ status: r.status, json: await r.json().catch(() => ({})) }));
}

let failures = 0;
const check = (name, fn) => {
  try { fn(); console.log(`  PASS  ${name}`); }
  catch (e) { failures++; console.error(`  FAIL  ${name}\n        ${e.message}`); }
};

try {
  let up = false;
  for (let i = 0; i < 90; i++) {
    if (server.exitCode !== null) break;
    try { await fetch(`${BASE}/api/v1/grade/cirbtc/summary`); up = true; break; }
    catch { await new Promise((r) => setTimeout(r, 500)); }
  }
  assert(up, "server never became ready");

  console.log(`\n=== attestation rules (registry ${REGISTRY}) ===\n`);

  const now = Math.floor(Date.now() / 1000);

  const first = await post(analyst, { letter: "A", score: 80, timestamp: now });
  check("approved analyst records an attestation (200)", () => {
    assert.strictEqual(first.status, 200, `got ${first.status} ${JSON.stringify(first.json)}`);
    assert(first.json.attestationId, "no attestationId returned");
  });

  const replay = await repost(first.payload);
  check("replaying the identical signature is refused (409)", () => {
    assert.strictEqual(replay.status, 409, `got ${replay.status} ${JSON.stringify(replay.json)}`);
    assert.strictEqual(replay.json.error, "signature_replayed");
    assert(!replay.json.attestationId, "a replay must not mint a new id");
  });

  const expired = await post(analyst, { letter: "B", score: 70, timestamp: now - 604_800 - 60 });
  check("an expired signature is refused (400)", () => {
    assert.strictEqual(expired.status, 400, `got ${expired.status} ${JSON.stringify(expired.json)}`);
    assert.strictEqual(expired.json.error, "signature_expired");
  });

  const future = await post(analyst, { letter: "C", score: 60, timestamp: now + 86_400 });
  check("a future-dated signature is refused (400)", () => {
    assert.strictEqual(future.status, 400, `got ${future.status} ${JSON.stringify(future.json)}`);
    assert.strictEqual(future.json.error, "signature_future_dated");
  });

  const unlisted = await post(stranger, { letter: "A", score: 99 });
  check("an unlisted analyst is refused (403)", () => {
    assert.strictEqual(unlisted.status, 403, `got ${unlisted.status} ${JSON.stringify(unlisted.json)}`);
    assert.strictEqual(unlisted.json.error, "analyst_not_approved");
  });

  // Just inside the window must still work, so the expiry rule is not off by a
  // whole window.
  const insideWindow = await post(analyst, { letter: "B+", score: 77, timestamp: now - 604_800 + 120 });
  check("a signature just inside the 7-day window is accepted (200)", () => {
    assert.strictEqual(insideWindow.status, 200, `got ${insideWindow.status} ${JSON.stringify(insideWindow.json)}`);
  });

  const list = await (await fetch(`${BASE}/api/v1/attest?slug=cirbtc`)).json();
  check("only the accepted attestations were stored", () => {
    const letters = (list.attestations || []).map((a) => a.letter).sort();
    assert.deepStrictEqual(letters, ["A", "B+"], `stored ${JSON.stringify(letters)}`);
  });

  check("stored count matches (no duplicate from the replay)", () => {
    assert.strictEqual((list.attestations || []).length, 2, `stored ${(list.attestations || []).length}`);
  });
} catch (e) {
  failures++;
  console.error(`\n  ERROR ${e.message}\n`);
} finally {
  server.kill();
}

if (failures) { console.error(`\n${failures} check(s) failed\n`); process.exit(1); }
console.log("\nAll attestation rule checks passed.\n");
process.exit(0);