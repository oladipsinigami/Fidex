import { createHash } from "node:crypto";
import { DatabaseSync } from "node:sqlite";
import path from "node:path";
import fs from "node:fs";

/**
 * Deployed-bytecode drift detection.
 *
 * WHY
 * ---
 * A security or audits score is a claim about a specific piece of deployed
 * bytecode. If that bytecode is upgraded, the claim may no longer describe
 * what is actually deployed -- and nothing else in the system would notice.
 * This is a genuinely automatable, high-signal check: `eth_getCode` is
 * objective, and a changed hash is exactly the event that should force an
 * analyst to re-read the code.
 *
 * WHAT IT MUST NOT DO
 * -------------------
 * It must never advance a rating's `updatedAt`. An unchanged codebase is not a
 * re-review; it is an unchanged codebase. This module has no import of
 * getEffectiveUpdatedAt, and scripts/test-freshness.mjs asserts the invariant.
 *
 * A drift finding means "re-review required", not "verified" and not "safe".
 *
 * COVERAGE IS CURRENTLY ZERO AND THAT IS VISIBLE
 * ----------------------------------------------
 * We do not store contract addresses for the hand-analysed book, and inventing
 * them would be fabricating the exact kind of datum this product claims to
 * verify. So the registry below ships with only addresses that are already
 * verified in AGENTS.md, and reportCoverage() states plainly how much of the
 * book is unmonitored rather than implying full coverage.
 */

export const DRIFT_REQUIRES_REVIEW = "bytecode_changed_requires_review";

/**
 * Verified addresses only. Add entries as an analyst confirms the deployment
 * address from the Arc explorer, not from a website or a token name.
 */
export const REGISTERED_CONTRACTS: Readonly<Record<string, readonly string[]>> = Object.freeze({
  "circle-usdc": Object.freeze(["0x3600000000000000000000000000000000000000"]),
});

function dbPath(): string {
  return process.env.FIDEX_DB_PATH
    ? path.resolve(process.env.FIDEX_DB_PATH)
    : path.join(process.cwd(), "data", "fidex.db");
}

let instance: DatabaseSync | null = null;

function getDb(): DatabaseSync {
  if (instance) return instance;
  const p = dbPath();
  fs.mkdirSync(path.dirname(p), { recursive: true });
  const db = new DatabaseSync(p);
  db.exec("PRAGMA journal_mode = WAL;");
  db.exec(`
    CREATE TABLE IF NOT EXISTS bytecode_baselines (
      slug      TEXT NOT NULL,
      address   TEXT NOT NULL,
      network   TEXT NOT NULL,
      code_hash TEXT NOT NULL,
      code_size INTEGER NOT NULL,
      seen_at   INTEGER NOT NULL,
      PRIMARY KEY (slug, address, network)
    );
    CREATE TABLE IF NOT EXISTS bytecode_flags (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      slug        TEXT NOT NULL,
      address     TEXT NOT NULL,
      network     TEXT NOT NULL,
      from_hash   TEXT NOT NULL,
      to_hash     TEXT NOT NULL,
      observed_at INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_bytecode_flags_slug ON bytecode_flags(slug);
  `);
  instance = db;
  return db;
}

/** Stable fingerprint of deployed bytecode. */
export function hashCode(code: string): string {
  return `0x${createHash("sha256").update(code.replace(/^0x/, "").toLowerCase()).digest("hex")}`;
}

export interface BytecodeObservation {
  slug: string;
  address: string;
  network: string;
  codeHash: string;
  codeSize: number;
  /** null when this is the first time we have seen the address. */
  changedSinceBaseline: boolean | null;
  previousHash: string | null;
  /** true when the address holds no code (EOA, wrong chain, or destroyed). */
  noCode: boolean;
}

async function getCode(rpcUrl: string, address: string): Promise<string> {
  const res = await fetch(rpcUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      method: "eth_getCode",
      params: [address, "latest"],
    }),
    signal: AbortSignal.timeout(10_000),
  });
  if (!res.ok) throw new Error(`eth_getCode http_${res.status}`);
  const body = await res.json();
  if (typeof body?.result !== "string") throw new Error("eth_getCode: no result");
  return body.result;
}

/**
 * Observe every registered address. First sighting records a baseline and
 * reports changedSinceBaseline: null -- we do not know if it moved, so we do
 * not claim it did not.
 */
export async function observeRegisteredContracts(
  registry: Readonly<Record<string, readonly string[]>> = REGISTERED_CONTRACTS,
  network = "mainnet",
  rpcUrl?: string,
): Promise<BytecodeObservation[]> {
  const url =
    rpcUrl ??
    (network === "testnet" ? "https://rpc.testnet.arc.io" : "https://rpc.mainnet.arc.io");
  const db = getDb();
  const out: BytecodeObservation[] = [];

  for (const [slug, addresses] of Object.entries(registry)) {
    for (const raw of addresses) {
      const address = raw.toLowerCase();
      try {
        const code = await getCode(url, address);
        const noCode = code === "0x" || code === "0x0";
        const codeHash = noCode ? "0xnone" : hashCode(code);
        const codeSize = Math.max(0, (code.length - 2) / 2);

        const prior = db
          .prepare(
            "SELECT code_hash FROM bytecode_baselines WHERE slug = ? AND address = ? AND network = ?",
          )
          .get(slug, address, network) as { code_hash: string } | undefined;

        let changed: boolean | null = null;
        if (prior) {
          changed = prior.code_hash !== codeHash;
          if (changed) {
            // Flag, never auto-update: the baseline is evidence of what was
            // graded, and overwriting it would erase the discrepancy.
            db.prepare(
              `INSERT INTO bytecode_flags (slug, address, network, from_hash, to_hash, observed_at)
               VALUES (?, ?, ?, ?, ?, ?)`,
            ).run(slug, address, network, prior.code_hash, codeHash, Date.now());
          }
        } else {
          db.prepare(
            `INSERT OR REPLACE INTO bytecode_baselines (slug, address, network, code_hash, code_size, seen_at)
             VALUES (?, ?, ?, ?, ?, ?)`,
          ).run(slug, address, network, codeHash, codeSize, Date.now());
        }

        out.push({
          slug,
          address,
          network,
          codeHash,
          codeSize,
          changedSinceBaseline: changed,
          previousHash: prior?.code_hash ?? null,
          noCode,
        });
      } catch (err) {
        out.push({
          slug,
          address,
          network,
          codeHash: "",
          codeSize: 0,
          changedSinceBaseline: null,
          previousHash: null,
          noCode: true,
        });
        void err;
      }
    }
  }
  return out;
}

/** Slugs with at least one address whose deployed bytecode changed. */
export function flaggedForReview(): Array<{
  slug: string;
  address: string;
  fromHash: string;
  toHash: string;
  observedAt: number;
}> {
  try {
    const rows = getDb()
      .prepare("SELECT slug, address, from_hash, to_hash, observed_at FROM bytecode_flags ORDER BY observed_at DESC")
      .all() as Array<Record<string, unknown>>;
    return rows.map((r) => ({
      slug: String(r.slug),
      address: String(r.address),
      fromHash: String(r.from_hash),
      toHash: String(r.to_hash),
      observedAt: Number(r.observed_at),
    }));
  } catch {
    return [];
  }
}

/**
 * How much of the book is actually monitored. Reported honestly so a partially
 * instrumented system cannot imply full coverage.
 */
export function reportCoverage(
  allSlugs: readonly string[],
  registry: Readonly<Record<string, readonly string[]>> = REGISTERED_CONTRACTS,
): { monitored: number; unmonitored: string[]; total: number } {
  const unmonitored = allSlugs.filter((s) => !registry[s]?.length);
  return {
    monitored: allSlugs.length - unmonitored.length,
    unmonitored,
    total: allSlugs.length,
  };
}
