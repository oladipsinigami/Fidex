import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { getProtocol } from "@/data/protocols";
import { isStale } from "@/lib/grade";
// The challenge must come from one place. A second builder here previously
// drifted and emitted x402 v1 / mainnet / no Gateway, which would have
// advertised an unusable payment option to buyers on the paid GET.
import { AG, LIVE, challenge, priceFor } from "@/lib/x402";
import { COOKIE, unlocks, verifyReceipt } from "@/lib/unlock";

export const dynamic = "force-dynamic";

/** True when a real facilitator and payout address are configured. */
export function x402Live(): boolean {
  return LIVE;
}

/** 402 with the canonical challenge, mirrored into PAYMENT-REQUIRED. */
function paywall(
  slug: string,
  axisId: string | undefined,
  description: string,
  method: string,
) {
  const body = challenge(slug, axisId ? "axis" : "dossier", axisId);
  return NextResponse.json({ ...body, error: "payment_required" }, {
    status: 402,
    headers: {
      "X-ArcGrade-Method": method,
      "PAYMENT-REQUIRED": Buffer.from(JSON.stringify(body)).toString("base64"),
    },
  });
}

export function fullGrade(slug: string) {
  const p = getProtocol(slug)!;
  return {
    slug: p.slug,
    name: p.name,
    letter: p.letter,
    score: p.score,
    stale: isStale(p),
    method: p.methodologyVersion,
    hash: p.contentHash,
    updatedAt: p.updatedAt,
    analystId: p.analystId,
    dossierVerdict: p.dossierVerdict,
    axes: p.axes.map((a) => ({
      id: a.id,
      label: a.label,
      weight: a.weight,
      score: a.score,
      compounding: a.weight > 0,
      summary: a.summary,
      evidence: a.evidence,
      citations: a.citations,
    })),
    killShots: p.killShots,
    unlocks: p.unlocks,
    incidents: p.incidents,
  };
}

/**
 * PAID endpoint. Returns 402 with an x402 challenge until the caller holds a
 * valid signed unlock receipt for this slug.
 */
export async function GET(req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const p = getProtocol(slug);
  if (!p) {
    return NextResponse.json(
      { error: "not_rated", message: `No rating published for "${slug}".` },
      { status: 404 },
    );
  }

  const jar = await cookies();
  const receipt = verifyReceipt(jar.get(COOKIE)?.value);
  const axisId = new URL(req.url).searchParams.get("axis") ?? undefined;

  if (axisId) {
    // Single-axis deep dive: $0.001
    const axis = p.axes.find((a) => a.id === axisId);
    if (!axis) {
      return NextResponse.json(
        { error: "unknown_axis", message: `No axis "${axisId}" on ${slug}.` },
        { status: 404 },
      );
    }
    if (!unlocks(receipt, slug, axisId)) {
      return paywall(slug, axisId, `ArcGrade axis deep dive: ${axis.label}`, p.methodologyVersion);
    }
    return NextResponse.json({ slug, axis, method: p.methodologyVersion, hash: p.contentHash });
  }

  if (!unlocks(receipt, slug)) {
    return paywall(slug, undefined, "ArcGrade full risk dossier", p.methodologyVersion);
  }

  return NextResponse.json(fullGrade(slug), {
    headers: { "X-ArcGrade-Method": p.methodologyVersion, "Cache-Control": "private, no-store" },
  });
}

export { AG, priceFor };
