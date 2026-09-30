import { BatchFacilitatorClient } from "@circle-fin/x402-batching/server";
import { ARC } from "./arcchain";
import { IS_BUILD_PHASE, siteUrl } from "./site";

/**
 * x402 payment verification on Arc, via Circle Gateway nanopayments.
 *
 * Two settlement paths, selected by `ARCGRADE_X402_MODE`:
 *
 *  gateway  (recommended) Circle Gateway nanopayments through
 *           BatchFacilitatorClient. Gasless, batched settlement, settlement
 *           recorded off-chain and batched on-chain. This is the path the
 *           official circlefin/arc-nanopayments reference app uses.
 *
 *  http     A plain x402 facilitator over HTTP (/verify then /settle). Used
 *           when you run your own facilitator.
 *
 * Both fail closed. There is no code path that mints a receipt from a
 * caller-supplied reference: `ref` on the request body is ignored entirely.
 *
 * Env:
 *   ARCGRADE_X402_MODE        "gateway" | "http"  (default gateway)
 *   ARCGRADE_PAY_TO           seller address that must receive the funds
 *   ARCGRADE_FACILITATOR_URL  required for http mode only
 *   ARCGRADE_SECRET           HMAC key for receipt signing
 *   ARCGRADE_NETWORK          "testnet" | "mainnet" (default mainnet)
 *   ARCGRADE_PUBLIC_URL       public origin used to build the x402 `resource`
 */

export const AG = {
  id: "fidex.dev/x402",
  version: "1",
} as const;

/** x402 paywall pricing, in USDC atomic units (6 decimals). */
export const PRICE_DOSSIER = 10_000n; // $0.01
export const PRICE_AXIS = 1_000n; // $0.001

export function priceFor(scope: "dossier" | "axis"): bigint {
  return scope === "dossier" ? PRICE_DOSSIER : PRICE_AXIS;
}

export const PAY_TO = process.env.FIDEX_PAY_TO ?? process.env.ARCGRADE_PAY_TO ?? null;
export const FACILITATOR = process.env.FIDEX_FACILITATOR_URL ?? process.env.ARCGRADE_FACILITATOR_URL ?? null;

const MODE = (process.env.FIDEX_X402_MODE ?? process.env.ARCGRADE_X402_MODE ?? "gateway") as "gateway" | "http";
const IS_TESTNET = (process.env.FIDEX_NETWORK ?? process.env.ARCGRADE_NETWORK ?? "mainnet") === "testnet";

/** CAIP-2 for the chain we actually accept payments on. */
export const NETWORK = IS_TESTNET
  ? `eip155:${ARC.testnetChainId}`
  : `eip155:${ARC.chainId}`;

/**
 * Circle runs TWO Gateway facilitators: a mainnet one and a testnet one.
 * The mainnet endpoint does NOT serve testnet chains and vice versa, so the
 * host must follow ARCGRADE_NETWORK. Verified against /v1/x402/supported:
 *   gateway-api.circle.com          -> eip155:5042   (Arc mainnet), no testnets
 *   gateway-api-testnet.circle.com  -> eip155:5042002 (Arc testnet), no mainnet
 */
const GATEWAY_URL = IS_TESTNET
  ? "https://gateway-api-testnet.circle.com"
  : "https://gateway-api.circle.com";

/**
 * Gateway settlement wallet on Arc. These differ per network, per the SDK's
 * CHAIN_CONFIGS, and are only meaningful in gateway mode.
 */
export const GATEWAY_WALLET = IS_TESTNET
  ? "0x0077777d7EBA4688BDeF3E311b846F25870A19B9"
  : "0x77777777Dcc4d5A8B6E418Fd04D8997ef11000eE";

/**
 * Live mode. Gateway mode needs only a payout address; http mode needs both a
 * payout address and a facilitator URL. Configuring only one of the two in
 * http mode is treated as a misconfiguration, not as "live".
 */
export const LIVE = MODE === "gateway" ? Boolean(PAY_TO) : Boolean(PAY_TO && FACILITATOR);

/**
 * NB: the SDK option is `url`, NOT `facilitatorUrl`. Passing the latter is
 * silently ignored and the client falls back to the mainnet host, which then
 * answers `unsupported_network` for a testnet chain and looks like the chain
 * is unsupported when it is merely the wrong endpoint.
 */
const facilitator = new BatchFacilitatorClient({ url: GATEWAY_URL });

/**
 * Payment requirements. The `extra` block must match the mode: advertising
 * `GatewayWalletBatched` to a plain x402 facilitator is wrong, because the
 * buyer would sign an EIP-712 authorisation against a contract that facilitator
 * knows nothing about.
 */
export function requirements(price: bigint, resource: string, description: string) {
  const base = {
    scheme: "exact" as const,
    network: NETWORK,
    asset: ARC.usdc,
    amount: price.toString(),
    payTo: PAY_TO ?? "unconfigured",
    // Gateway batches settlement, so the window is long rather than 60s.
    maxTimeoutSeconds: MODE === "gateway" ? 345_600 : 300,
    extra:
      MODE === "gateway"
        ? { name: "GatewayWalletBatched", version: "1", verifyingContract: GATEWAY_WALLET }
        : { name: "USDC", version: "2", decimals: 6 },
    resource,
    description,
  };
  return base;
}

/**
 * Public origin advertised as the x402 `resource`.
 *
 * This was hardcoded to `https://arcgrade.xyz`, which does not resolve. That
 * made every 402 challenge advertise an unpayable resource: Circle's
 * facilitator requires the buyer to echo `resource` and `accepted` back, so
 * settlement was being attempted against a host nobody could reach. It is now
 * configuration, and production refuses to start without it, because a wrong
 * value here is a silent revenue outage rather than a crash.
 */
const hasProductionUrl = Boolean(
  process.env.FIDEX_PUBLIC_URL ||
    process.env.ARCGRADE_PUBLIC_URL ||
    process.env.NEXT_PUBLIC_FIDEX_URL ||
    process.env.NEXT_PUBLIC_ARCGRADE_URL ||
    process.env.VERCEL_PROJECT_PRODUCTION_URL ||
    process.env.VERCEL_URL,
);

/**
 * `next build` also runs with NODE_ENV=production, and it evaluates this module
 * while collecting page data. Throwing here would break the build rather than
 * catch a bad deployment, so the guard stands down during the build phase and
 * fails on the first real request instead. See IS_BUILD_PHASE in lib/site.ts.
 */
if (typeof window === "undefined" && process.env.NODE_ENV === "production" && !hasProductionUrl && !IS_BUILD_PHASE) {
  throw new Error(
    "[Fidex FATAL] FIDEX_PUBLIC_URL (or ARCGRADE_PUBLIC_URL) is required in production. It becomes the x402 " +
      "`resource` URL, which the buyer must echo back to the facilitator; without it every " +
      "challenge advertises an unpayable resource.",
  );
}

/** The canonical resource URL for a slug. One builder, so the 402 challenge and the settlement path cannot drift. */
export function resourceFor(slug: string): string {
  return siteUrl(`/api/v1/grade/${slug}`);
}

/** The x402 V2 challenge returned on 402, also sent in PAYMENT-REQUIRED. */
export function challenge(slug: string, scope: "dossier" | "axis", axisId?: string) {
  const resource = resourceFor(slug);
  const description =
    scope === "dossier"
      ? "Full Fidex dossier: all nine axes, evidence, citations."
      : `Fidex single-axis readout: ${axisId}.`;
  return {
    x402Version: 2,
    resource: { url: resource, description, mimeType: "application/json" },
    accepts: [
      {
        ...requirements(priceFor(scope), resource, description),
        // Keep our own routing metadata, but preserve the mode-correct
        // payment metadata (verifyingContract in gateway mode, USDC decimals
        // in http mode) rather than clobbering it.
        extra: {
          ...requirements(priceFor(scope), resource, description).extra,
          slug,
          scope,
          axisId: axisId ?? null,
        },
      },
    ],
  };
}


export type Verification =
  | { ok: true; settleTx: string; payer: string; amount: string; mode: "gateway" | "http" }
  | { ok: false; reason: string };

/** The header Circle's x402 buyer sends. Also accept the older X-PAYMENT name. */
export function paymentHeader(headers: Headers): string | null {
  return (
    headers.get("payment-signature") ??
    headers.get("x-payment") ??
    headers.get("payment")
  );
}

/**
 * Verify then settle a payment.
 *
 * @param header     base64 x402 payment payload from the buyer
 * @param expected   exact price in USDC atomic units
 * @param scope      what is being bought, for the challenge description
 *
 * Fails closed on: missing config, unparseable header, wrong version/scheme/
 * network, facilitator rejection, unsuccessful settle, or an amount mismatch.
 * A facilitator outage is never treated as a free unlock.
 */
export async function verifyAndSettle(
  header: string,
  expected: bigint,
  resource: string,
  description: string,
): Promise<Verification> {
  if (!LIVE) return { ok: false, reason: "payments_not_configured" };

  let payload: {
    x402Version?: number;
    // The buyer does NOT echo these. createPaymentPayload returns only
    // { x402Version, payload: { authorization, signature } }, so demanding
    // scheme/network here would reject every legitimate Gateway payment.
    scheme?: string;
    network?: string;
    /** Required by Circle's facilitator: describes what is being bought. */
    resource?: { url: string; description: string; mimeType: string };
    /** Required by Circle's facilitator: the requirements being paid. */
    accepted?: Record<string, unknown>;
    extensions?: Record<string, unknown>;
    payload?: Record<string, unknown>;
  };
  try {
    payload = JSON.parse(Buffer.from(header, "base64").toString("utf8"));
  } catch {
    return { ok: false, reason: "malformed_payment_header" };
  }

  if (payload.x402Version !== 2) return { ok: false, reason: "unsupported_x402_version" };
  // If a buyer does declare these, they must be the ones we serve.
  if (payload.scheme !== undefined && payload.scheme !== "exact") {
    return { ok: false, reason: "unsupported_scheme" };
  }
  if (payload.network !== undefined && payload.network !== NETWORK) {
    return { ok: false, reason: "wrong_network" };
  }
  // A payment with no payload carries no authorisation to verify.
  if (!payload.payload || typeof payload.payload !== "object") {
    return { ok: false, reason: "missing_payment_payload" };
  }

  const req = requirements(expected, resource, description);

  /**
   * The signed EIP-3009 authorisation is the real thing being checked, so
   * validate it directly rather than trusting wrapper fields. The facilitator
   * re-verifies the signature; these checks reject anything we would not
   * honour even if it were valid.
   */
  const auth = (payload.payload as { authorization?: Record<string, unknown> }).authorization;
  if (!auth) return { ok: false, reason: "missing_authorization" };

  const to = auth.to as string | undefined;
  const value = auth.value as string | undefined;
  const validBefore = Number(auth.validBefore ?? 0);
  const now = Math.floor(Date.now() / 1000);

  // Must be paying the address we actually serve.
  if (typeof to !== "string" || to.toLowerCase() !== PAY_TO?.toLowerCase()) {
    return { ok: false, reason: "payto_mismatch" };
  }
  // Exact price. No partial payments, no overpayment-as-donation.
  try {
    if (BigInt(value ?? "0") !== expected) return { ok: false, reason: "amount_mismatch" };
  } catch {
    return { ok: false, reason: "malformed_authorization_value" };
  }
  // Already-expired authorisation.
  if (validBefore && validBefore < now) return { ok: false, reason: "authorization_expired" };

  // The facilitator checks the signature against the Gateway wallet contract
  // and REQUIRES paymentPayload.resource, .accepted and .network.
  //
  // `resource` and `accepted` come from the buyer (it echoes the challenge).
  // `network` does NOT: createPaymentPayload omits it, and the facilitator
  // 400s/402s with `unsupported_network` when it is absent. We are the server
  // and we know which chain we serve, so we state it explicitly -- and we
  // reject a buyer that declares a different one, so this cannot be spoofed.
  const declared = payload.network;
  if (declared !== undefined && declared !== NETWORK) {
    return { ok: false, reason: "wrong_network" };
  }

  const decoded = {
    x402Version: 2,
    ...(payload.scheme ? { scheme: payload.scheme } : {}),
    network: NETWORK,
    ...(payload.resource ? { resource: payload.resource } : {}),
    ...(payload.accepted ? { accepted: payload.accepted } : {}),
    ...(payload.extensions ? { extensions: payload.extensions } : {}),
    payload: payload.payload,
  } as {
    x402Version: number;
    scheme: string;
    network: string;
    resource?: { url: string; description: string; mimeType: string };
    accepted?: Record<string, unknown>;
    extensions?: Record<string, unknown>;
    payload: Record<string, unknown>;
  };

  try {
    if (MODE === "gateway") {
      const v = await facilitator.verify(decoded, req);
      if (!v.isValid) {
        return { ok: false, reason: v.invalidReason ?? "facilitator_rejected_payment" };
      }
      const s = await facilitator.settle(decoded, req);
      if (!s.success) {
        return { ok: false, reason: s.errorReason ?? "settle_failed" };
      }
      return {
        ok: true,
        settleTx: s.transaction ?? "",
        payer: s.payer ?? v.payer ?? "",
        amount: expected.toString(),
        mode: "gateway",
      };
    }

    // http mode: a self-hosted facilitator.
    const post = async (path: string, body: unknown) => {
      const res = await fetch(`${FACILITATOR}${path}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
        cache: "no-store",
      });
      if (!res.ok) throw new Error(`facilitator ${path} -> ${res.status}`);
      return (await res.json()) as Record<string, unknown>;
    };

    const body = {
      x402Version: 2,
      scheme: decoded.scheme,
      network: decoded.network,
      payload: decoded.payload,
    };

    const v = await post("/verify", body);
    if (v.isValid !== true) {
      return { ok: false, reason: String(v.invalidReason ?? "facilitator_rejected_payment") };
    }
    const s = await post("/settle", body);
    if (s.success !== true) {
      return { ok: false, reason: String(s.error ?? s.errorReason ?? "settle_failed") };
    }
    const settledAmount = (v as { amount?: string }).amount;
    if (settledAmount && BigInt(settledAmount) !== expected) {
      return { ok: false, reason: "amount_mismatch" };
    }
    return {
      ok: true,
      settleTx: String(s.transaction ?? ""),
      payer: String((v as { payer?: string }).payer ?? ""),
      amount: settledAmount || expected.toString(),
      mode: "http",
    };
  } catch (err) {
    // Fail closed: a facilitator outage must not become a free unlock.
    return { ok: false, reason: `facilitator_error: ${(err as Error).message}` };
  }
}
