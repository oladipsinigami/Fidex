import { NextResponse } from "next/server";
import { verifyTypedData } from "viem";
import { recordAttestation, getAttestations } from "@/lib/db";
import { getProtocol } from "@/data/protocols";

export const dynamic = "force-dynamic";

import { ATTESTATION_DOMAIN, ATTESTATION_TYPES } from "@/lib/attestation";

/**
 * GET /api/v1/attest?slug=<slug>
 * Fetches cryptographic attestations recorded for a protocol.
 */
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const slug = searchParams.get("slug");
  if (!slug) {
    return NextResponse.json({ error: "missing_slug" }, { status: 400 });
  }

  const attestations = getAttestations(slug);
  return NextResponse.json({ slug, attestations });
}

/**
 * POST /api/v1/attest
 * Accepts an analyst's EIP-712 cryptographic signature, verifies it via viem,
 * and persists the attestation to SQLite.
 */
export async function POST(req: Request) {
  let body: {
    slug?: string;
    letter?: string;
    score?: number;
    analystAddress?: string;
    signature?: string;
    timestamp?: number;
  };

  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "bad_request", message: "Expected JSON body." }, { status: 400 });
  }

  const { slug, letter, score, analystAddress, signature, timestamp } = body;

  if (!slug || !letter || score === undefined || !analystAddress || !signature || !timestamp) {
    return NextResponse.json(
      { error: "bad_request", message: "Missing required attestation fields." },
      { status: 400 },
    );
  }

  const protocol = getProtocol(slug);
  if (!protocol) {
    return NextResponse.json({ error: "unknown_protocol", message: `Protocol ${slug} not found.` }, { status: 404 });
  }

  if (!/^0x[a-fA-F0-9]{40}$/.test(analystAddress)) {
    return NextResponse.json({ error: "invalid_analyst_address" }, { status: 400 });
  }

  if (!/^0x[a-fA-F0-9]{130}$/.test(signature)) {
    return NextResponse.json({ error: "invalid_signature_format" }, { status: 400 });
  }

  try {
    // Cryptographically verify EIP-712 typed data
    const isValid = await verifyTypedData({
      address: analystAddress as `0x${string}`,
      domain: ATTESTATION_DOMAIN,
      types: ATTESTATION_TYPES,
      primaryType: "RatingAttestation",
      message: {
        slug,
        letter,
        score: BigInt(score),
        analyst: analystAddress as `0x${string}`,
        timestamp: BigInt(timestamp),
      },
      signature: signature as `0x${string}`,
    });

    if (!isValid) {
      return NextResponse.json({ error: "signature_verification_failed" }, { status: 400 });
    }

    // Persist verified cryptographic attestation to SQLite
    const result = recordAttestation({
      slug,
      letter,
      score,
      analystAddress,
      signature,
      timestamp,
    });

    if (!result.ok) {
      return NextResponse.json({ error: "storage_failed", reason: result.reason }, { status: 500 });
    }

    return NextResponse.json({
      ok: true,
      attestationId: result.id,
      slug,
      letter,
      score,
      analyst: analystAddress,
      timestamp,
    });
  } catch (err: unknown) {
    return NextResponse.json(
      {
        error: "verification_error",
        message: err instanceof Error ? err.message : String(err),
      },
      { status: 500 },
    );
  }
}
