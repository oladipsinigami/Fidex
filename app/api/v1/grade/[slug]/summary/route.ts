import { NextResponse } from "next/server";
import { getProtocol } from "@/data/protocols";
import { isStale } from "@/lib/grade";

export const dynamic = "force-dynamic";

/** Free summary: letter + one-liner + updatedAt. Intended for agents. */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;
  const p = getProtocol(slug);
  if (!p) {
    return NextResponse.json(
      { error: "not_rated", message: `No rating published for "${slug}".` },
      { status: 404 },
    );
  }
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
        "X-ArcGrade-Method": p.methodologyVersion,
        "X-ArcGrade-Stale": String(isStale(p)),
      },
    },
  );
}
