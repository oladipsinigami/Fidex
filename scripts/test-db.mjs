/**
 * Unit test for ArcGrade Database Persistence & Atomic Double-Spend Protection.
 *
 * Verifies that:
 * 1. Receipts are durably stored with atomic UNIQUE constraints on txHash.
 * 2. Replay attack: attempting to record the same txHash a second time is rejected with "transaction_already_spent".
 * 3. isTxHashUsed and getReceiptByTx work accurately.
 *
 * Run with: node scripts/test-db.mjs
 */

import assert from "node:assert";
import path from "node:path";
import fs from "node:fs";

console.log("=== Running ArcGrade LibSQL / SQLite Persistence & Replay Protection Tests ===\n");

const testDbPath = path.join(process.cwd(), "data", "test-arcgrade.db");
try { fs.rmSync(testDbPath, { force: true }); } catch {}

process.env.FIDEX_DB_PATH = testDbPath;
const { recordReceipt, isTxHashUsed, getReceiptByTx } = await import("../lib/db.ts");

let passed = 0;
let total = 0;

async function test(name, fn) {
  total++;
  try {
    await fn();
    console.log(`PASS: ${name}`);
    passed++;
  } catch (err) {
    console.error(`FAIL: ${name}`);
    console.error(err);
  }
}

await test("recordReceipt saves receipt to database", async () => {
  const res = await recordReceipt({
    slug: "aave-v4-arc",
    scope: "dossier",
    payer: "0xbuyer1",
    txHash: "0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890",
    amount: "10000",
    network: "eip155:5042002",
    mode: "onchain",
    ttlSeconds: 86400,
  });
  assert.strictEqual(res.ok, true);

  const row = await getReceiptByTx("0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890");
  assert(row !== null);
  assert.strictEqual(row.slug, "aave-v4-arc");
  assert.strictEqual(row.amount, "10000");
});

await test("Atomic replay prevention: identical tx_hash throws and returns transaction_already_spent", async () => {
  const res = await recordReceipt({
    slug: "morpho-blue", // Even if trying to unlock a different slug!
    scope: "dossier",
    payer: "0xattacker",
    txHash: "0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890",
    amount: "10000",
    network: "eip155:5042002",
    mode: "onchain",
    ttlSeconds: 86400,
  });
  assert.strictEqual(res.ok, false);
  assert.strictEqual(res.reason, "transaction_already_spent");
});

await test("isTxHashUsed correctly detects spent hashes", async () => {
  const exists = await isTxHashUsed("0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890");
  assert.strictEqual(exists, true);

  const notExists = await isTxHashUsed("0x0000000000000000000000000000000000000000000000000000000000000000");
  assert.strictEqual(notExists, false);
});

// Clean up test DB
try { fs.rmSync(testDbPath, { force: true }); } catch {}

console.log(`\nResults: ${passed}/${total} tests passed.`);
if (passed !== total) process.exit(1);
