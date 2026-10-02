/**
 * Automated Verification Watchdog
 *
 * Records a truthful operational check per protocol. It exists as an AUDIT
 * LOG, not as a freshness source.
 *
 * IMPORTANT: this script deliberately does NOT move the rating freshness
 * clock. An earlier version stamped every protocol "healthy" with the string
 * "contracts active, zero exploits reported, TVL verified" while making no
 * network call at all, and `getEffectiveUpdatedAt` took that stamp as the
 * newest `updatedAt`. The result was a fabricated verification trail that
 * silently made 18 of 19 ratings permanently non-stale.
 *
 * What this version actually checks:
 *   1. Arc chain liveness, via eth_chainId over the configured RPC.
 *   2. That the protocol is a known, parseable entry in data/.
 *
 * What it does NOT check, and therefore never claims: audits, exploits,
 * reserves, TVL, admin keys, or any axis score. Only a human analyst
 * reviewing primary sources can do those, and only a signed EIP-712
 * attestation advances the rating's `updatedAt`.
 *
 * It fails closed: if the RPC cannot be reached, nothing is recorded as
 * verified. Absence of a stamp must never mean "healthy".
 */
import { mkdirSync, readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { DatabaseSync } from "node:sqlite";

const DATA_DIR = fileURLToPath(new URL("../data", import.meta.url));
const DB_PATH =
  process.env.FIDEX_DB_PATH ??
  process.env.ARCGRADE_DB_PATH ??
  join(process.cwd(), "data", "fidex.db");

const IS_TESTNET = (process.env.FIDEX_NETWORK ?? process.env.ARCGRADE_NETWORK ?? "mainnet") === "testnet";
const RPC_URL =
  process.env.FIDEX_TESTNET_RPC ?? process.env.ARCGRADE_TESTNET_RPC ??
  process.env.FIDEX_RPC ?? process.env.ARCGRADE_RPC ??
  (IS_TESTNET ? "https://rpc.testnet.arc.io" : "https://rpc.mainnet.arc.io");
const EXPECTED_CHAIN_ID = IS_TESTNET ? 5042002 : 5042;

mkdirSync(dirname(DB_PATH), { recursive: true });
const db = new DatabaseSync(DB_PATH);
db.exec("PRAGMA journal_mode = WAL;");
db.exec(`
  CREATE TABLE IF NOT EXISTS verifications (
    slug TEXT PRIMARY KEY,
    verified_at INTEGER NOT NULL,
    status TEXT NOT NULL,
    details TEXT
  );
`);

/**
 * Benchmarks that must carry a human proof rather than an automated renewal.
 * These keep whatever review date their data file carries and are recorded as
 * pending, never as verified.
 */
const REQUIRES_HUMAN_AUDIT = new Set(["cirbtc"]);

function loadProtocols() {
  const files = readdirSync(DATA_DIR).filter(
    (f) => f.endsWith(".ts") && !["protocols.ts", "axes.ts", "types.ts"].includes(f),
  );
  return files
    .map((file) => {
      const src = readFileSync(join(DATA_DIR, file), "utf8");
      return {
        file,
        slug: src.match(/slug:\s*"([^"]+)"/)?.[1] ?? "",
        updatedAt: src.match(/updatedAt:\s*"([^"]+)"/)?.[1] ?? "",
      };
    })
    .filter((p) => Boolean(p.slug));
}

/** The one thing this script can honestly verify: the chain answers and is the right chain. */
async function checkChainLiveness() {
  try {
    const res = await fetch(RPC_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "eth_chainId", params: [] }),
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) return { ok: false, detail: `rpc_http_${res.status}` };
    const body = await res.json();
    const raw = body?.result;
    if (typeof raw !== "string") return { ok: false, detail: "rpc_no_result" };
    const id = Number.parseInt(raw, 16);
    if (id !== EXPECTED_CHAIN_ID) {
      return { ok: false, detail: `unexpected_chain_id_${id}` };
    }
    return { ok: true, detail: `eth_chainId=${id}` };
  } catch (err) {
    return { ok: false, detail: `rpc_unreachable: ${err instanceof Error ? err.message : String(err)}` };
  }
}

async function run() {
  console.log(`\n=== Automated Verification Watchdog ===`);
  console.log(`Timestamp : ${new Date().toISOString()}`);
  console.log(`Network   : ${IS_TESTNET ? "testnet" : "mainnet"} (${EXPECTED_CHAIN_ID})`);
  console.log(`RPC       : ${RPC_URL}`);
  console.log(`DB        : ${DB_PATH}\n`);

  const chain = await checkChainLiveness();
  console.log(
    `Chain liveness: ${chain.ok ? "OK" : "FAILED"}  (${chain.detail})\n`,
  );

  const protocols = loadProtocols();
  const stmt = db.prepare(`
    INSERT INTO verifications (slug, verified_at, status, details)
    VALUES (?, ?, ?, ?)
    ON CONFLICT(slug) DO UPDATE SET
      verified_at = excluded.verified_at,
      status = excluded.status,
      details = excluded.details
  `);

  console.log("slug                     status        details");
  console.log("-".repeat(88));

  let operational = 0;
  let pending = 0;
  let unverifiable = 0;

  for (const p of protocols) {
    if (REQUIRES_HUMAN_AUDIT.has(p.slug)) {
      const reviewed = new Date(p.updatedAt).getTime() || 0;
      stmt.run(p.slug, reviewed, "pending_human_review", "Requires a human analyst re-review.");
      console.log(`${p.slug.padEnd(24)} pending_human  analyst re-review required`);
      pending++;
      continue;
    }

    if (!chain.ok) {
      // Fail closed. An unreachable chain means we learned nothing, so we
      // record that plainly instead of implying the protocol is fine.
      stmt.run(p.slug, 0, "unverified", `Chain liveness check failed: ${chain.detail}`);
      console.log(`${p.slug.padEnd(24)} unverified      ${chain.detail}`);
      unverifiable++;
      continue;
    }

    // Honest scope: chain reachable and correct. Nothing about the protocol.
    stmt.run(
      p.slug,
      Date.now(),
      "operational",
      `Chain liveness only (${chain.detail}). No audit, exploit, reserve, or admin-key review performed.`,
    );
    console.log(`${p.slug.padEnd(24)} operational     ${chain.detail}`);
    operational++;
  }

  console.log(
    `\nDone: ${operational} operational, ${pending} pending analyst review, ${unverifiable} unverified.`,
  );
  console.log(
    "Note: these stamps are an audit log. They do NOT change any rating's updatedAt.",
  );
  if (!chain.ok) {
    console.log("Exiting non-zero because the chain check failed (fail-closed).");
    process.exitCode = 1;
  }
}

run().catch((err) => {
  console.error("Watchdog failed:", err);
  process.exitCode = 1;
});
