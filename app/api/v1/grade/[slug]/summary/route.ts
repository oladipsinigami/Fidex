import { NextResponse } from "next/server";
import { getProtocol } from "@/data/protocols";
import { isStale } from "@/lib/grade";
import { enrichProtocolWithDb } from "@/lib/db";

export const dynamic = "force-dynamic";

/** Free summary: letter + one-liner + updatedAt. Intended for agents. */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;
  const rawP = getProtocol(slug);
  if (!rawP) {
    return NextResponse.json(
      { error: "not_rated", message: `No rating published for "${slug}".` },
      { status: 404 },
    );
  }
  const p = await enrichProtocolWithDb(rawP);
  return NextResponse.json(
    {
      slug: p.slug,
      letter: p.letter,
      score: p.score,
      oneLiner: p.verdict,
      updatedAt: p.updatedAt,
    },
    {
      headers: {
        // Public, cacheable, cheap. Agents should call this first.
        "Cache-Control": "public, max-age=300",
        "X-Fidex-Method": p.methodologyVersion,
        "X-Fidex-Stale": String(isStale(p)),
        "X-ArcGrade-Method": p.methodologyVersion,
        "X-ArcGrade-Stale": String(isStale(p)),
      },
    },
  );
}
