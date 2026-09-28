import path from "node:path";
import fs from "node:fs";
import { DatabaseSync } from "node:sqlite";

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

let dbInstance: DatabaseSync | null = null;

/**
 * Open the durable receipt/attestation store.
 *
 * This THROWS if the file store is unavailable. It deliberately has no
 * in-memory fallback: an ephemeral database would silently discard the
 * `UNIQUE(tx_hash)` constraint the moment the process restarted, so a replayed
 * transaction hash would be accepted a second time and mint a second free
 * receipt. That is the exact "zero free bypass" guarantee the product claims,
 * so a deployment that cannot honour it must fail loudly rather than pretend.
 *
 * Serverless and read-only filesystems (Vercel functions, most container
 * platforms) cannot host a file SQLite database. Those deployments must point
 * `ARCGRADE_DB_PATH` at a durable volume, or replace this module with a real
 * networked store -- see the README's "Durable storage" section.
 */
function getDb(): DatabaseSync {
  if (dbInstance) return dbInstance;

  const dbPath = process.env.ARCGRADE_DB_PATH
    ? path.resolve(process.env.ARCGRADE_DB_PATH)
    : path.join(process.cwd(), "data", "arcgrade.db");

  fs.mkdirSync(path.dirname(dbPath), { recursive: true });

  const db = new DatabaseSync(dbPath);
  // Enable WAL mode for high concurrency across Next.js worker threads
  db.exec("PRAGMA journal_mode = WAL;");
  db.exec("PRAGMA synchronous = NORMAL;");

  // Receipts table with strict UNIQUE(tx_hash) constraint
  db.exec(`
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
  `);

  // Analyst EIP-712 attestations table
  db.exec(`
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
  `);

  dbInstance = db;
  return db;
}

/**
 * Check if a transaction hash has already been spent.
 *
 * Throws if the store is unavailable, so a caller can distinguish "not spent"
 * from "cannot tell". Callers on the payment path MUST treat an error as a
 * rejection: reporting "not spent" for an unreachable database would hand out
 * a free receipt.
 */
export function isTxHashUsed(txHash: string): boolean {
  const db = getDb();
  const stmt = db.prepare("SELECT id FROM receipts WHERE tx_hash = ?");
  const row = stmt.get(txHash.toLowerCase());
  return Boolean(row);
}

/**
 * Atomically records an unlock payment.
 *
 * Fails closed: an unreachable store, an unwritable filesystem, or a duplicate
 * transaction hash all return `{ ok: false }` rather than a receipt. The
 * duplicate check is enforced by the UNIQUE constraint, not a read-then-write,
 * so two concurrent requests cannot both win.
 */
export function recordReceipt(data: {
  slug: string;
  scope: string;
  payer: string;
  txHash: string;
  amount: string;
  network: string;
  mode: string;
  ttlSeconds: number;
}): { ok: true; id: string } | { ok: false; reason: string } {
  const id = `rcpt_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
  const now = Date.now();
  const expiresAt = now + data.ttlSeconds * 1000;
  const normalizedHash = data.txHash.toLowerCase();

  let db: DatabaseSync;
  try {
    db = getDb();
  } catch (err: unknown) {
    return { ok: false, reason: `receipt_store_unavailable: ${(err as Error).message}` };
  }

  try {
    const stmt = db.prepare(`
      INSERT INTO receipts (
        id, slug, scope, payer, tx_hash, amount, network, mode, created_at, expires_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
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
    );

    return { ok: true, id };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes("UNIQUE constraint failed")) {
      return { ok: false, reason: "transaction_already_spent" };
    }
    return { ok: false, reason: msg };
  }
}

/** Fetch an active receipt by transaction hash. Read-only, so errors degrade to null. */
export function getReceiptByTx(txHash: string): StoredReceipt | null {
  let db: DatabaseSync;
  try {
    db = getDb();
  } catch {
    return null;
  }
  try {
    const stmt = db.prepare("SELECT * FROM receipts WHERE tx_hash = ?");
    const row = stmt.get(txHash.toLowerCase()) as Record<string, unknown> | undefined;
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
export function recordAttestation(attestation: {
  slug: string;
  letter: string;
  score: number;
  analystAddress: string;
  signature: string;
  timestamp: number;
}): { ok: true; id: string } | { ok: false; reason: string } {
  const id = `attest_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;

  let db: DatabaseSync;
  try {
    db = getDb();
  } catch (err: unknown) {
    return { ok: false, reason: `attestation_store_unavailable: ${(err as Error).message}` };
  }

  try {
    const stmt = db.prepare(`
      INSERT INTO attestations (
        id, slug, letter, score, analyst_address, signature, timestamp
      ) VALUES (?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      id,
      attestation.slug,
      attestation.letter,
      attestation.score,
      attestation.analystAddress.toLowerCase(),
      attestation.signature,
      attestation.timestamp,
    );

    return { ok: true, id };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return { ok: false, reason: msg };
  }
}

/** Get all attestations for a protocol. Read-only, so errors degrade to an empty list. */
export function getAttestations(slug: string): StoredAttestation[] {
  try {
    const db = getDb();
    const stmt = db.prepare("SELECT * FROM attestations WHERE slug = ? ORDER BY timestamp DESC");
    const rows = stmt.all(slug) as Record<string, unknown>[];

    return rows.map((r) => ({
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
