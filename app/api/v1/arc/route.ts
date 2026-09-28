import { NextResponse } from "next/server";
import { fetchArcProtocols } from "@/lib/discover";
import { isListable, screen } from "@/lib/screen";

export const dynamic = "force-dynamic";

/**
 * GET /api/v1/arc
 *
 * Every protocol DeFiLlama tracks on Arc, with a screening grade.
 * `letter` is null unless enough axes are backed by a public datum, so
 * consumers can trust a letter when they see one.
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const limit = Math.min(Number(url.searchParams.get("limit") ?? 100) || 100, 200);

  try {
    const all = await fetchArcProtocols();
    const listable = all.filter(isListable);
    const body = listable.slice(0, limit).map((p) => ({ ...p, screen: screen(p) }));

    return NextResponse.json(
      {
        ok: true,
        source: "defillama",
        fetchedAt: new Date().toISOString(),
        /** Honest about what the feed contains, not just what we rendered. */
        counts: { discovered: all.length, listable: listable.length, returned: body.length },
        protocols: body,
      },
      { headers: { "cache-control": "public, max-age=900, stale-while-revalidate=3600" } },
    );
  } catch (err) {
    return NextResponse.json(
      { error: "upstream_unavailable", message: (err as Error).message },
      { status: 502 },
    );
  }
}
