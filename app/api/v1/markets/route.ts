import { NextResponse } from "next/server";
import { PROTOCOLS, CATEGORIES, TOTAL_TVL } from "@/data/protocols";
import { isStale } from "@/lib/grade";
import { enrichProtocolsWithDb } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  const enriched = await enrichProtocolsWithDb(PROTOCOLS);
  const protocols = enriched.map((p) => {
    return {
      slug: p.slug,
      name: p.name,
      monogram: p.monogram,
      category: p.category,
      letter: p.letter,
      score: p.score,
      tvlUsd: p.tvlUsd,
      stale: isStale(p),
      verdict: p.verdict,
    };
  });

  return NextResponse.json({
    ok: true,
    totalTvlUsd: TOTAL_TVL,
    categories: CATEGORIES,
    protocols,
  });
}
