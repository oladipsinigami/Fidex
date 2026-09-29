import path from "node:path";
import fs from "node:fs";
import { createClient, type Client } from "@libsql/client";

export interface StoredReceipt {
  id: string;
  slug: string;
  scope: string;
  payer: string;
  txHash: string;
  amount: string;
  network: string;
  mode: string;
  createdAt: number;
  expiresAt: number;
}

export interface StoredAttestation {
  id: string;
  slug: string;
  letter: string;
  score: number;
  analystAddress: string;
  signature: string;
  timestamp: number;
}

export interface StoredVerification {
  slug: string;
  verifiedAt: number;
  status: string;
  details?: string;
}

let dbPromise: Promise<Client> | null = null;

/**
 * Open the durable receipt/attestation store.
 *
 * Supports:
 * 1. Cloud Turso (LibSQL over HTTP): when TURSO_DATABASE_URL or LIBSQL_URL is set.
 *    This allows zero-ops serverless deployment (e.g. on Vercel) while keeping
 *    strict atomic UNIQUE constraints in the cloud.
 * 2. Local persistent SQLite file: when running locally or on a persistent VM.
 *    Reads from FIDEX_DB_PATH, ARCGRADE_DB_PATH, or defaults to data/fidex.db.
 */
async function initDb(): Promise<Client> {
  const tursoUrl = process.env.TURSO_DATABASE_URL || process.env.LIBSQL_URL;
  const authToken = process.env.TURSO_AUTH_TOKEN || process.env.LIBSQL_AUTH_TOKEN;

  const isServerless = Boolean(process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME);

  /**
   * Fail closed on a serverless host with no remote store.
   *
   * A local file in /tmp opens successfully, so nothing errors and nothing is
   * logged: each warm lambda gets its own private database, and the
   * UNIQUE(tx_hash) constraint that blocks replay exists only inside that one
   * instance. A replayed payment hash would then be accepted a second time and
   * mint a second free receipt -- silently, with no visible symptom, which is
   * the exact guarantee this table exists to provide.
   *
   * So on Vercel or Lambda, a missing Turso URL is a deployment error, not a
   * reason to degrade. The same shape as the ARCGRADE_SECRET guard in
   * lib/unlock.ts.
   */
  if (isServerless && !tursoUrl) {
    throw new Error(
      "[Fidex FATAL] TURSO_DATABASE_URL (or LIBSQL_URL) is required on a serverless host. " +
        "A local file would be ephemeral and unique per instance, so replay protection " +
        "would not hold and paid content could be unlocked repeatedly with one payment.",
    );
  }

  let client: Client;

  if (tursoUrl) {
    client = createClient({
      url: tursoUrl,
      authToken,
    });
  } else {
    const defaultDbPath = path.join(process.cwd(), "data", "fidex.db");

    const rawPath = process.env.FIDEX_DB_PATH
      ? path.resolve(process.env.FIDEX_DB_PATH)
      : process.env.ARCGRADE_DB_PATH
      ? path.resolve(process.env.ARCGRADE_DB_PATH)
      : defaultDbPath;

    fs.mkdirSync(path.dirname(rawPath), { recursive: true });

    // In serverless /tmp or local fallback, copy seed database if present
    const seedPath = path.join(process.cwd(), "data", "fidex.db");
    const legacyPath = path.join(process.cwd(), "data", "arcgrade.db");
    if (!fs.existsSync(rawPath)) {
      if (fs.existsSync(seedPath)) {
        try {
          fs.copyFileSync(seedPath, rawPath);
        } catch {}
      } else if (fs.existsSync(legacyPath)) {
        try {
          fs.copyFileSync(legacyPath, rawPath);
        } catch {}
      }
    }

    // Windows or Unix file path formatted as LibSQL file URL
    const fileUrl = `file:${rawPath.replace(/\\/g, "/")}`;
    client = createClient({ url: fileUrl });

    // Busy timeout for local concurrency
    await client.execute("PRAGMA busy_timeout = 5000;").catch(() => {});
  }

  return client;
}

/**
 * Schema, applied idempotently but ONLY when the version marker is missing.
 *
 * Previously this ran on every cold start. Against a local file that was free;
 * against Turso it is a remote HTTP round trip on the first request of every
 * cold lambda, which is latency nobody needs to pay. A cheap
 * `SELECT version FROM schema_version` replaces it, and
 * `scripts/deploy.mjs migrate` can run the same code on demand.
 */
export const SCHEMA_VERSION = 3;

const SCHEMA_SQL = `
  CREATE TABLE IF NOT EXISTS schema_version (
    version    INTEGER PRIMARY KEY,
    applied_at INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS receipts (
    id TEXT PRIMARY KEY,
    slug TEXT NOT NULL,
    scope TEXT NOT NULL,
    payer TEXT NOT NULL,
    tx_hash TEXT UNIQUE NOT NULL,
    amount TEXT NOT NULL,
    network TEXT NOT NULL,
    mode TEXT NOT NULL,
    created_at INTEGER NOT NULL,
    expires_at INTEGER NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_receipts_tx ON receipts(tx_hash);
  CREATE INDEX IF NOT EXISTS idx_receipts_slug ON receipts(slug);

  CREATE TABLE IF NOT EXISTS attestations (
    id TEXT PRIMARY KEY,
    slug TEXT NOT NULL,
    letter TEXT NOT NULL,
    score INTEGER NOT NULL,
    analyst_address TEXT NOT NULL,
    signature TEXT NOT NULL,
    timestamp INTEGER NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_attestations_slug ON attestations(slug);

  CREATE TABLE IF NOT EXISTS verifications (
    slug TEXT PRIMARY KEY,
    verified_at INTEGER NOT NULL,
    status TEXT NOT NULL,
    details TEXT
  );

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
`;

/** True when the store is already at SCHEMA_VERSION. */
export async function isSchemaCurrent(client: Client): Promise<boolean> {
  try {
    const res = await client.execute("SELECT MAX(version) AS v FROM schema_version");
    const v = (res.rows?.[0]?.v as number | null) ?? 0;
    return Number(v) >= SCHEMA_VERSION;
  } catch {
    // schema_version does not exist yet.
    return false;
  }
}

/** Apply the schema and stamp the version. Safe to call repeatedly. */
export async function migrate(client: Client): Promise<boolean> {
  if (await isSchemaCurrent(client)) return false;
  await client.executeMultiple(SCHEMA_SQL);
  await client.execute({
    sql: "INSERT OR REPLACE INTO schema_version (version, applied_at) VALUES (?, ?)",
    args: [SCHEMA_VERSION, Date.now()],
  });
  return true;
}

export function getDb(): Promise<Client> {
  if (!dbPromise) {
    dbPromise = initDb().then(async (client) => {
      await migrate(client).catch((err) => {
        console.error("[db] schema migration failed:", err);
        throw err;
      });
      return client;
    }).catch((err) => {
      dbPromise = null;
      throw err;
    });
  }
  return dbPromise;
}

/**
 * Check if a transaction hash has already been spent.
 *
 * Throws if the store is unavailable, so a caller can distinguish "not spent"
 * from "cannot tell". Callers on the payment path MUST treat an error as a
 * rejection.
 */
export async function isTxHashUsed(txHash: string): Promise<boolean> {
  const db = await getDb();
  const res = await db.execute({
    sql: "SELECT id FROM receipts WHERE tx_hash = ?",
    args: [txHash.toLowerCase()],
  });
  return res.rows.length > 0;
}

/**
 * Atomically records an unlock payment.
 *
 * Fails closed: an unreachable store, an unwritable database, or a duplicate
 * transaction hash all return { ok: false } rather than a receipt. The
 * duplicate check is enforced by the database's UNIQUE constraint.
 */
export async function recordReceipt(data: {
  slug: string;
  scope: string;
  payer: string;
  txHash: string;
  amount: string;
  network: string;
  mode: string;
  ttlSeconds: number;
}): Promise<{ ok: true; id: string } | { ok: false; reason: string }> {
  const id = `rcpt_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
  const now = Date.now();
  const expiresAt = now + data.ttlSeconds * 1000;
  const normalizedHash = data.txHash.toLowerCase();

  let db: Client;
  try {
    db = await getDb();
  } catch (err: unknown) {
    return { ok: false, reason: `receipt_store_unavailable: ${(err as Error).message}` };
  }

  try {
    await db.execute({
      sql: `
        INSERT INTO receipts (
          id, slug, scope, payer, tx_hash, amount, network, mode, created_at, expires_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
      args: [
        id,
        data.slug,
        data.scope,
        data.payer.toLowerCase(),
        normalizedHash,
        data.amount,
        data.network,
        data.mode,
        now,
        expiresAt,
      ],
    });

    return { ok: true, id };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes("UNIQUE constraint failed") || msg.includes("SQLITE_CONSTRAINT")) {
      return { ok: false, reason: "transaction_already_spent" };
    }
    return { ok: false, reason: msg };
  }
}

/** Fetch an active receipt by transaction hash. Read-only, so errors degrade to null. */
export async function getReceiptByTx(txHash: string): Promise<StoredReceipt | null> {
  try {
    const db = await getDb();
    const res = await db.execute({
      sql: "SELECT * FROM receipts WHERE tx_hash = ?",
      args: [txHash.toLowerCase()],
    });
    const row = res.rows[0];
    if (!row) return null;

    return {
      id: String(row.id),
      slug: String(row.slug),
      scope: String(row.scope),
      payer: String(row.payer),
      txHash: String(row.tx_hash),
      amount: String(row.amount),
      network: String(row.network),
      mode: String(row.mode),
      createdAt: Number(row.created_at),
      expiresAt: Number(row.expires_at),
    };
  } catch {
    return null;
  }
}

/** Record an analyst cryptographic attestation */
export async function recordAttestation(attestation: {
  slug: string;
  letter: string;
  score: number;
  analystAddress: string;
  signature: string;
  timestamp: number;
}): Promise<{ ok: true; id: string } | { ok: false; reason: string }> {
  const id = `attest_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;

  let db: Client;
  try {
    db = await getDb();
  } catch (err: unknown) {
    return { ok: false, reason: `attestation_store_unavailable: ${(err as Error).message}` };
  }

  try {
    await db.execute({
      sql: `
        INSERT INTO attestations (
          id, slug, letter, score, analyst_address, signature, timestamp
        ) VALUES (?, ?, ?, ?, ?, ?, ?)
      `,
      args: [
        id,
        attestation.slug,
        attestation.letter,
        attestation.score,
        attestation.analystAddress.toLowerCase(),
        attestation.signature,
        attestation.timestamp,
      ],
    });

    return { ok: true, id };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return { ok: false, reason: msg };
  }
}

/** Get all attestations for a protocol. Read-only, so errors degrade to an empty list. */
export async function getAttestations(slug: string): Promise<StoredAttestation[]> {
  try {
    const db = await getDb();
    const res = await db.execute({
      sql: "SELECT * FROM attestations WHERE slug = ? ORDER BY timestamp DESC",
      args: [slug],
    });

    return res.rows.map((r) => ({
      id: String(r.id),
      slug: String(r.slug),
      letter: String(r.letter),
      score: Number(r.score),
      analystAddress: String(r.analyst_address),
      signature: String(r.signature),
      timestamp: Number(r.timestamp),
    }));
  } catch {
    return [];
  }
}

/**
 * Record an automated watchdog stamp.
 */
export async function recordVerification(
  slug: string,
  status = "operational",
  details = "Chain liveness only. No audit, exploit, reserve or admin-key review performed.",
): Promise<void> {
  try {
    const db = await getDb();
    await db.execute({
      sql: `
        INSERT INTO verifications (slug, verified_at, status, details)
        VALUES (?, ?, ?, ?)
        ON CONFLICT(slug) DO UPDATE SET
          verified_at = excluded.verified_at,
          status = excluded.status,
          details = excluded.details
      `,
      args: [slug, Date.now(), status, details],
    });
  } catch (err) {
    console.error("Failed to record verification stamp:", err);
  }
}

/** Get the latest automated verification for a protocol */
export async function getLatestVerification(slug: string): Promise<StoredVerification | null> {
  try {
    const db = await getDb();
    const res = await db.execute({
      sql: "SELECT * FROM verifications WHERE slug = ?",
      args: [slug],
    });
    const row = res.rows[0];
    if (!row) return null;
    return {
      slug: String(row.slug),
      verifiedAt: Number(row.verified_at),
      status: String(row.status),
      details: row.details ? String(row.details) : undefined,
    };
  } catch {
    return null;
  }
}

/**
 * The effective last-reviewed timestamp for a protocol.
 */
export async function getEffectiveUpdatedAt(slug: string, fallbackIso: string): Promise<string> {
  try {
    const db = await getDb();
    const res = await db.execute({
      sql: "SELECT timestamp FROM attestations WHERE slug = ? ORDER BY timestamp DESC LIMIT 1",
      args: [slug],
    });
    const attRow = res.rows[0];

    const baseTs = new Date(fallbackIso).getTime() || 0;
    const attTs = (attRow?.timestamp as number) || 0;

    const maxTs = Math.max(baseTs, attTs);
    return maxTs > 0 ? new Date(maxTs).toISOString() : fallbackIso;
  } catch {
    return fallbackIso;
  }
}

/** Enriches a single protocol with the effective last updated date from the database */
export async function enrichProtocolWithDb<T extends { slug: string; updatedAt: string }>(protocol: T): Promise<T> {
  return {
    ...protocol,
    updatedAt: await getEffectiveUpdatedAt(protocol.slug, protocol.updatedAt),
  };
}

/** Enriches an array of protocols in a single batch query, avoiding N round-trips over the network */
export async function enrichProtocolsWithDb<T extends { slug: string; updatedAt: string }>(protocols: T[]): Promise<T[]> {
  try {
    const db = await getDb();
    const res = await db.execute("SELECT slug, MAX(timestamp) as timestamp FROM attestations GROUP BY slug");
    const map = new Map<string, number>();
    for (const row of res.rows) {
      if (row.slug && row.timestamp) {
        map.set(String(row.slug), Number(row.timestamp));
      }
    }
    return protocols.map((p) => {
      const attTs = map.get(p.slug) ?? 0;
      const baseTs = new Date(p.updatedAt).getTime() || 0;
      const maxTs = Math.max(baseTs, attTs);
      return {
        ...p,
        updatedAt: maxTs > 0 ? new Date(maxTs).toISOString() : p.updatedAt,
      };
    });
  } catch {
    return protocols;
  }
}
