import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { getProtocol } from "@/data/protocols";
import {
  AG,
  challenge,
  LIVE,
  NETWORK,
  PAY_TO,
  paymentHeader,
  priceFor,
  resourceFor,
  verifyAndSettle,
} from "@/lib/x402";
import { COOKIE, DEV_MODE, LEGACY_COOKIE, mintReceipt, UNLOCK_TTL_S } from "@/lib/unlock";

import { verifyArcTestnetTx } from "@/lib/onchainVerify";
import { recordReceipt } from "@/lib/db";

export const dynamic = "force-dynamic";

/** x402 v2 wants the challenge in the body and mirrored in a base64 header. */
function challengeResponse(slug: string, scope: "dossier" | "axis", axisId: string | undefined, extra: object) {
  const body = { ...challenge(slug, scope, axisId), ...extra };
  return NextResponse.json(body, {
    status: 402,
    headers: {
      "PAYMENT-REQUIRED": Buffer.from(JSON.stringify(challenge(slug, scope, axisId))).toString(
        "base64",
      ),
    },
  });
}

/**
 * POST /api/v1/unlock
 *
 *  Strict payment enforcement:
 *  1. x402 Gateway / facilitator payment signature in header
 *  2. Direct verified on-chain USDC settlement on Arc Testnet (txHash)
 *
 *  No free bypass: unverified requests are rejected with 402 Payment Required.
 */
export async function POST(req: Request) {
  let body: {
    slug?: string;
    scope?: "dossier" | "axis";
    axisId?: string;
    paymentSignature?: string;
    txHash?: string;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "bad_request", message: "Expected a JSON body." }, { status: 400 });
  }

  const { slug, scope = "dossier", axisId, txHash } = body;
  if (!slug) {
    return NextResponse.json({ error: "bad_request", message: "slug is required." }, { status: 400 });
  }
  const p = getProtocol(slug);
  if (!p) {
    return NextResponse.json({ error: "not_rated", message: `No rating published for "${slug}".` }, { status: 404 });
  }
  if (scope === "axis" && !axisId) {
    return NextResponse.json({ error: "bad_request", message: "axisId is required for an axis purchase." }, { status: 400 });
  }
  if (scope === "axis" && !p.axes.some((a) => a.id === axisId)) {
    return NextResponse.json({ error: "unknown_axis", message: `No axis "${axisId}" on ${slug}.` }, { status: 404 });
  }

  const expected = priceFor(scope);
  // Must come from the same builder as the challenge, or `resource` here will
  // not match what the buyer echoed back in `accepted`.
  const resource = resourceFor(slug);
  const description =
    scope === "dossier"
      ? "Full Fidex dossier: all nine axes, evidence, citations."
      : `Fidex single-axis readout: ${axisId}.`;

  let settleTx: string;
  let payer = "";
  let mode: "gateway" | "http" | "onchain" = "gateway";

  const header = paymentHeader(req.headers) || body.paymentSignature;

  if (LIVE && header) {
    // Path 1: x402 Gateway batched settlement via Circle
    const v = await verifyAndSettle(header, expected, resource, description);
    if (!v.ok) {
      return challengeResponse(slug, scope, axisId, {
        error: "payment_failed",
        reason: v.reason,
      });
    }
    settleTx = v.settleTx;
    payer = v.payer;
    mode = v.mode;
  } else if (txHash && typeof txHash === "string" && PAY_TO) {
    // Path 2: Direct on-chain USDC transfer verified on Arc RPC
    const v = await verifyArcTestnetTx(txHash, PAY_TO, expected);
    if (!v.ok) {
      return challengeResponse(slug, scope, axisId, {
        error: "onchain_verification_failed",
        reason: v.reason,
      });
    }
    settleTx = v.txHash!;
    payer = v.payer!;
    mode = "onchain";
  } else {
    // Strictly reject unverified / unpaid requests
    return challengeResponse(slug, scope, axisId, {
      error: "payment_required",
      message: "An x402 payment signature or confirmed Arc Testnet transaction hash is required to unlock.",
    });
  }

  // Atomically persist receipt to durable SQLite storage tying txHash to slug
  const dbRec = await recordReceipt({
    slug,
    scope,
    payer,
    txHash: settleTx,
    amount: expected.toString(),
    network: NETWORK,
    mode,
    ttlSeconds: UNLOCK_TTL_S,
  });

  if (!dbRec.ok) {
    return challengeResponse(slug, scope, axisId, {
      error: "payment_failed",
      reason: dbRec.reason,
    });
  }

  const receipt = mintReceipt({
    slug,
    scope,
    axisId,
    ref: settleTx,
    exp: Date.now() + UNLOCK_TTL_S * 1000,
  });

  const jar = await cookies();
  jar.set(COOKIE, receipt, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: UNLOCK_TTL_S,
  });
  jar.set(LEGACY_COOKIE, receipt, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: UNLOCK_TTL_S,
  });

  const headers: Record<string, string> = {
    // x402 v2: mirror the settlement result in a base64 PAYMENT-RESPONSE header.
    "PAYMENT-RESPONSE": Buffer.from(
      JSON.stringify({ success: true, transaction: settleTx, network: NETWORK, payer }),
    ).toString("base64"),
  };

  return NextResponse.json(
    {
      ok: true,
      slug,
      scope,
      mode,
      dev: DEV_MODE || !LIVE,
      network: NETWORK,
      payTo: PAY_TO,
      expiresIn: UNLOCK_TTL_S,
      paid: expected.toString(),
      settleTx,
      payer,
    },
    { headers },
  );
}

export { AG };

