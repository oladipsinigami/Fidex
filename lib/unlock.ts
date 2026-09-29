import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Unlock receipts. A purchase produces a signed token stored in an
 * httpOnly cookie for 24h. The signature is HMAC-SHA256 over the payload
 * with ARCGRADE_SECRET; in development a fixed dev secret is used and the
 * whole flow is labelled DEV in the UI.
 */
const isProduction = process.env.NODE_ENV === "production";
const effectiveSecret = process.env.FIDEX_SECRET ?? process.env.ARCGRADE_SECRET;
if (isProduction && !effectiveSecret) {
  throw new Error("[Fidex Security FATAL] FIDEX_SECRET (or ARCGRADE_SECRET) is required in production environments to mint cryptographic unlock receipts.");
}
const SECRET = effectiveSecret ?? "fidex-dev-secret-not-for-production";
export const DEV_MODE = !effectiveSecret;

export type Receipt = {
  slug: string;
  /** what was bought: "dossier" | "axis" */
  scope: "dossier" | "axis";
  axisId?: string;
  /** unix ms */
  exp: number;
  /** payment reference (tx hash or dev id) */
  ref: string;
};

function b64(input: string) {
  return Buffer.from(input, "utf8").toString("base64url");
}

function sign(payload: string) {
  return createHmac("sha256", SECRET).update(payload).digest("base64url");
}

export function mintReceipt(r: Receipt): string {
  const payload = b64(JSON.stringify(r));
  return `${payload}.${sign(payload)}`;
}

export function verifyReceipt(token: string | undefined): Receipt | null {
  if (!token) return null;
  const [payload, sig] = token.split(".");
  if (!payload || !sig) return null;

  const expected = sign(payload);
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;

  try {
    const r = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as Receipt;
    if (typeof r.exp !== "number" || r.exp < Date.now()) return null;
    return r;
  } catch {
    return null;
  }
}

export const COOKIE = "fidex_unlock";
export const LEGACY_COOKIE = "arcgrade_unlock";
export const UNLOCK_TTL_S = 60 * 60 * 24; // 24h

/** True when this receipt unlocks the requested scope for this slug. */
export function unlocks(receipt: Receipt | null, slug: string, axisId?: string): boolean {
  if (!receipt) return false;
  if (receipt.slug !== slug) return false;
  if (receipt.scope === "dossier") return true;
  return receipt.scope === "axis" && receipt.axisId === axisId;
}
