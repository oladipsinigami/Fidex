import { NextResponse } from "next/server";
import { PROTOCOLS, CATEGORIES, TOTAL_TVL } from "@/data/protocols";

export const dynamic = "force-dynamic";

export async function GET() {
  const protocols = PROTOCOLS.map((p) => ({
    slug: p.slug,
    name: p.name,
    monogram: p.monogram,
    category: p.category,
    letter: p.letter,
    score: p.score,
    tvlUsd: p.tvlUsd,
    stale: false,
    verdict: p.verdict,
  }));

  return NextResponse.json({
    ok: true,
    totalTvlUsd: TOTAL_TVL,
    categories: CATEGORIES,
    protocols,
  });
}
