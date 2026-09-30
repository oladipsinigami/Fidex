import { NextResponse } from "next/server";
import { createPublicClient, http, verifyTypedData } from "viem";
import { arc, arcTestnet } from "viem/chains";
import { recordAttestation, getAttestations } from "@/lib/db";
import { getProtocol } from "@/data/protocols";

export const dynamic = "force-dynamic";

import {
  ATTESTATION_DOMAIN,
  ATTESTATION_TYPES,
  REGISTRY_CONTRACT_ADDRESS,
  REGISTRY_UNCONFIGURED,
} from "@/lib/attestation";
import { ARC, IS_TESTNET } from "@/lib/arcchain";

/**
 * Reads `isApprovedAnalyst(analyst)` from the deployed registry.
 *
 * The registry refuses attestations from analysts the owner has not
 * allowlisted. The API verifies the EIP-712 signature on its own and has no way
 * to know that, so without this check it would happily persist a record for an
 * unlisted analyst that the chain would refuse to accept -- reporting a
 * verified attestation that could never be written on-chain.
 */
async function isApprovedAnalyst(address: string): Promise<boolean> {
  const client = createPublicClient({
    // viem ships both Arc chains and their ids match the values verified in
    // lib/arcchain.ts (5042 / 5042002), but the RPC is taken from ARC so there
    // is a single source of truth for the endpoint. Passing an explicit
    // transport also means viem's own default URL is never used by accident.
    chain: IS_TESTNET ? arcTestnet : arc,
    transport: http(IS_TESTNET ? ARC.testnetRpc : ARC.rpc),
  });

  return client.readContract({
    address: REGISTRY_CONTRACT_ADDRESS as `0x${string}`,
    abi: [
      {
        type: "function",
        name: "isApprovedAnalyst",
        stateMutability: "view",
        inputs: [{ name: "analyst", type: "address" }],
        outputs: [{ type: "bool" }],
      },
    ],
    functionName: "isApprovedAnalyst",
    args: [address as `0x${string}`],
  });
}

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

  const attestations = await getAttestations(slug);
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

  /**
   * Refuse to "verify" anything when no registry is configured.
   *
   * Without this, the signature is checked against a domain whose
   * verifyingContract is the zero address. That always passes for a signature
   * minted the same way, so the endpoint would report a cryptographically
   * verified analyst attestation while having checked nothing on-chain. A
   * stored attestation is a trust claim, so this has to fail closed.
   */
  if (REGISTRY_UNCONFIGURED) {
    return NextResponse.json(
      {
        error: "registry_not_configured",
        message:
          "NEXT_PUBLIC_FIDEX_REGISTRY_ADDRESS is unset, so there is no registry to verify against. " +
          "Refusing to record an attestation that was checked against the zero address.",
      },
      { status: 503 },
    );
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

    /**
     * A valid signature proves the analyst holds a key. It does not prove the
     * analyst is certified -- the registry decides that, and it rejects anyone
     * the owner has not allowlisted. Check it on-chain before recording, so the
     * API never stores an attestation the registry would refuse.
     */
    let approved: boolean;
    try {
      approved = await isApprovedAnalyst(analystAddress);
    } catch (e) {
      // Unreachable RPC must not read as "approved".
      console.error("attest: allowlist lookup failed", e);
      return NextResponse.json(
        { error: "allowlist_unavailable", message: "Could not read the analyst allowlist." },
        { status: 503 },
      );
    }

    if (!approved) {
      return NextResponse.json(
        {
          error: "analyst_not_approved",
          message:
            "This address is not an approved analyst on the registry. A valid signature is " +
            "not enough; the registry owner must allowlist it.",
        },
        { status: 403 },
      );
    }

    // Persist verified cryptographic attestation to SQLite
    const result = await recordAttestation({
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
