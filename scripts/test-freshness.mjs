/**
 * The freshness clock must not be advanceable by automation.
 *
 * Two bugs motivated this:
 *
 *  1. `refresh-telemetry.mjs` stamped every protocol "healthy" with the string
 *     "contracts active, zero exploits reported, TVL verified" while making no
 *     network call, and `getEffectiveUpdatedAt` took that stamp via max(). A
 *     daily CI run therefore reset every rating's clock and no rating could
 *     ever go stale.
 *
 *  2. A stale rating silently inheriting a fresh date is the same failure as
 *     the SSR paywall leak: it looks fine in the UI and is false underneath.
 *
 * This asserts the invariant directly rather than testing the watchdog's
 * internals, so it holds regardless of how either file is refactored.
 */
import assert from "node:assert";
import { DatabaseSync } from "node:sqlite";
import { readFileSync, rmSync, mkdirSync } from "node:fs";
import path from "node:path";
import os from "node:os";

console.log("=== Freshness-clock integrity tests ===\n");

let passed = 0;
let failed = 0;
const check = (name, fn) => {
  try {
    fn();
    passed++;
    console.log(`PASS  ${name}`);
  } catch (err) {
    failed++;
    console.log(`FAIL  ${name}\n      ${err.message}`);
  }
};

const ROOT = process.cwd();
const TMP = path.join(os.tmpdir(), "fidex-freshness-test");
try {
  rmSync(TMP, { recursive: true, force: true });
  mkdirSync(TMP, { recursive: true });
} catch {}
const TEST_DB = path.join(TMP, "test.db");

// Point the app at an isolated database so we never touch the real one.
process.env.FIDEX_DB_PATH = TEST_DB;
process.env.FIDEX_NETWORK = "testnet";
process.env.FIDEX_SECRET = "freshness-test";
process.env.FIDEX_PUBLIC_URL = "http://127.0.0.1:4599";

const { recordVerification, getEffectiveUpdatedAt } = await import("../lib/db.ts");

const OLD = "2026-09-20T13:45:00.000Z";

check("a fresh data-file date is returned unchanged", () => {
  const out = getEffectiveUpdatedAt("cirbtc", OLD);
  assert.equal(out, OLD, `expected ${OLD}, got ${out}`);
});

check("an 'operational' watchdog stamp does NOT advance the clock", () => {
  recordVerification("cirbtc", "operational", "chain liveness only");
  const out = getEffectiveUpdatedAt("cirbtc", OLD);
  assert.equal(
    out,
    OLD,
    `watchdog stamp moved updatedAt from ${OLD} to ${out}. The stamp must never set freshness.`,
  );
});

check("a legacy 'healthy' watchdog stamp does NOT advance the clock", () => {
  // The old vocabulary, in case an old row is still in the table.
  recordVerification("cirbtc", "healthy", "contracts active, zero exploits reported, TVL verified");
  const out = getEffectiveUpdatedAt("cirbtc", OLD);
  assert.equal(
    out,
    OLD,
    `a 'healthy' stamp moved updatedAt to ${out}. Only an analyst review may do that.`,
  );
});

check("a signed analyst attestation DOES advance the clock", () => {
  // The legitimate path: a human analyst signed for this slug.
  const signedAt = Date.parse("2026-09-27T10:00:00.000Z");
  const db = new DatabaseSync(TEST_DB);
  db.prepare(
    `INSERT INTO attestations (id, slug, letter, score, analyst_address, signature, timestamp)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
  ).run("attest_test", "cirbtc", "D", 53, "0xtest", "0x", signedAt);
  db.close();

  const out = getEffectiveUpdatedAt("cirbtc", OLD);
  assert.equal(out, new Date(signedAt).toISOString(), `expected the attestation date, got ${out}`);
});

/** Strip comments so the source checks look at code, not at the prose
 *  documenting the bug being guarded against. */
function code(src) {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/(^|[^:])\/\/.*$/gm, "$1");
}

check("the watchdog no longer claims to verify exploits or TVL", () => {
  const src = readFileSafe(path.join(ROOT, "scripts", "refresh-telemetry.mjs"));
  assert.ok(src, "could not read refresh-telemetry.mjs");
  const body = code(src);
  assert.ok(
    !/zero exploits reported/i.test(body),
    "watchdog still emits a 'zero exploits reported' claim while making no exploit lookup",
  );
  assert.ok(
    !/TVL verified/i.test(body),
    "watchdog still emits a 'TVL verified' claim without fetching TVL",
  );
});

check("the watchdog actually makes a network call", () => {
  const src = readFileSafe(path.join(ROOT, "scripts", "refresh-telemetry.mjs"));
  assert.ok(/\bfetch\(/.test(code(src)), "watchdog still performs no network call at all");
});

check("cirbtc is still excluded from automated renewal", () => {
  const src = readFileSafe(path.join(ROOT, "scripts", "refresh-telemetry.mjs"));
  assert.ok(
    /REQUIRES_HUMAN_AUDIT\s*=\s*new Set\(\[[^\]]*cirbtc/.test(code(src)),
    "cirbtc is no longer in the human-review exclusion set",
  );
});

function readFileSafe(p) {
  try {
    return readFileSync(p, "utf8");
  } catch {
    return null;
  }
}

console.log(`\n${passed}/${passed + failed} passed`);
try {
  rmSync(TMP, { recursive: true, force: true });
} catch {}
process.exitCode = failed ? 1 : 0;
