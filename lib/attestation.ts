/**
 * EIP-712 attestation domain.
 *
 * This must match the domain the on-chain registry derives for itself, because
 * the registry computes its own from `block.chainid` and `address(this)`. Two
 * mistakes here are silent -- a signature verifies off-chain against this
 * module and then fails on-chain, or worse, verifies against an address that
 * does not exist:
 *
 *  1. `chainId` was the literal 5042002 (Arc testnet). On mainnet the registry
 *     would derive 5042, so every signature would be rejected. It now follows
 *     the configured network.
 *
 *  2. `verifyingContract` fell back to the zero address, so with
 *     NEXT_PUBLIC_FIDEX_REGISTRY_ADDRESS unset every attestation was signed
 *     against 0x0000000000000000000000000000000000000000. Off-chain
 *     verification then passed -- it used the same constant -- proving nothing
 *     about any deployed contract.
 *
 * Values are NEXT_PUBLIC_* prefixed because analysts sign in the browser
 * (app/studio), so they must be inlined at build time.
 */

const NETWORK = (
  process.env.NEXT_PUBLIC_FIDEX_NETWORK ??
  process.env.NEXT_PUBLIC_ARCGRADE_NETWORK ??
  "testnet"
).toLowerCase();

/** Arc chain ids, verified over JSON-RPC in AGENTS.md. */
const CHAIN_IDS = {
  mainnet: 5042,
  testnet: 5042002,
} as const;

export const IS_TESTNET = NETWORK !== "mainnet";

export const ATTESTATION_CHAIN_ID = CHAIN_IDS[IS_TESTNET ? "testnet" : "mainnet"];

export const REGISTRY_CONTRACT_ADDRESS = (process.env.NEXT_PUBLIC_FIDEX_REGISTRY_ADDRESS ||
  process.env.NEXT_PUBLIC_ARCGRADE_REGISTRY_ADDRESS ||
  "0x0000000000000000000000000000000000000000") as `0x${string}`;

/**
 * True when no registry address is configured.
 *
 * The zero address is kept as the fallback rather than throwing, because this
 * module is imported by client components that sign in the browser, where an
 * exception at module load takes down the page. Callers that gate anything on
 * the signature being meaningful must check this first -- POST /api/v1/attest
 * does.
 */
export const REGISTRY_UNCONFIGURED =
  REGISTRY_CONTRACT_ADDRESS === "0x0000000000000000000000000000000000000000";

export const ATTESTATION_DOMAIN = {
  name: "Fidex Studio",
  version: "1",
  chainId: ATTESTATION_CHAIN_ID,
  verifyingContract: REGISTRY_CONTRACT_ADDRESS,
} as const;

export const ATTESTATION_TYPES = {
  RatingAttestation: [
    { name: "slug", type: "string" },
    { name: "letter", type: "string" },
    { name: "score", type: "uint256" },
    { name: "analyst", type: "address" },
    { name: "timestamp", type: "uint256" },
  ],
} as const;

/**
 * Must equal `FidexRegistry.ATTESTATION_EXPIRY` (7 days).
 *
 * Duplicated deliberately, with `verify:attest:live` asserting the deployed
 * contract agrees. A silent drift here means the API accepts signatures the
 * chain would reject, which is precisely the failure mode this constant exists
 * to prevent, so the two are compared on every live run rather than trusted.
 */
export const ATTESTATION_EXPIRY_SECONDS = 604_800;

export type TimestampRejection = "invalid" | "future_dated" | "expired";

/**
 * Mirrors the timestamp rules in `FidexRegistry.attestWithSig`, which reverts
 * `SignatureExpired` when the signed timestamp is in the future or older than
 * the expiry window.
 *
 * The future case is not pedantry: a far-future timestamp lets a signature sit
 * signed and valid for years, so a grade an analyst intended as a snapshot
 * becomes a standing claim. Enforcing it only in the contract left the API
 * storing such records anyway, since it never consulted this rule.
 *
 * Returns null when acceptable.
 */
export function checkAttestationTimestamp(
  timestamp: number,
  nowSeconds: number = Math.floor(Date.now() / 1000),
): TimestampRejection | null {
  if (!Number.isSafeInteger(timestamp) || timestamp < 0) return "invalid";
  if (timestamp > nowSeconds) return "future_dated";
  if (timestamp + ATTESTATION_EXPIRY_SECONDS < nowSeconds) return "expired";
  return null;
}
