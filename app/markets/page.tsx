import type { Metadata } from "next";
import { MarketTable, type UnifiedRow } from "@/components/MarketTable";
import { byLetterDesc } from "@/data/protocols";
import { isStale } from "@/lib/grade";
import { fetchArcProtocols } from "@/lib/discover";
import { fetchLiveTvl, type Telemetry } from "@/lib/telemetry";
import { isListable } from "@/lib/screen";
import { Barcode } from "@/components/Barcode";
import { CropMark } from "@/components/CropMark";

export const revalidate = 900;

export const metadata: Metadata = {
  title: "Markets — Research Benchmarks & Protocols on Arc",
  description:
    "The full Fidex ledger: letter, score, 7-day change, TVL and risk verdict for every protocol and dApp on Circle Arc.",
};

export default async function MarketsPage() {
  const fullProtocols = byLetterDesc();
  const live = await fetchLiveTvl().catch(() => new Map<string, Telemetry>());
  const rows: UnifiedRow[] = fullProtocols.map((p) => ({
    kind: "dossier",
    slug: p.slug,
    name: p.name,
    monogram: p.monogram,
    category: p.category,
    chainFocus: p.chainFocus,
    letter: p.letter,
    score: p.score,
    delta7d: p.delta7d,
    tvlUsd: p.tvlUsd,
    liveTvlUsd: live.get(p.slug)?.tvlUsd ?? null,
    apy: p.apy,
    yieldNote: p.yieldNote,
    updatedAt: p.updatedAt,
    isStale: isStale(p),
  }));

  const liveRows = (await fetchArcProtocols().catch(() => [])).filter(isListable);
  const seenNames = new Set(
    rows.map((r) => r.slug).concat(rows.map((r) => r.name.toLowerCase().replace(/[^a-z0-9]/g, ""))),
  );
  const extraLive = liveRows.filter(
    (l) => !seenNames.has(l.slug) && !seenNames.has(l.name.toLowerCase().replace(/[^a-z0-9]/g, "")),
  );
  const totalCount = rows.length + extraLive.length;

  return (
    <div className="lookbook min-h-screen">
      <header className="border-b border-current/10">
        <div className="mx-auto max-w-[1320px] px-6 py-12 sm:py-16 relative">
          <CropMark corner="tl" size={24} className="top-8 left-6" />

          <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-6">
            <div>
              <p className="lookbook-kicker">
                Ledger · {totalCount} dApps on Arc
              </p>
              <h1 className="mt-3 font-campaign text-4xl sm:text-6xl font-bold uppercase tracking-tight">
                RESEARCH BENCHMARKS
              </h1>
              <p className="mt-3 max-w-2xl text-sm sm:text-base text-current/70">
                Nineteen primary-source security evaluations for Arc liquidity.
              </p>
            </div>

            <div className="flex items-center gap-4">
              <div className="text-right hidden sm:block">
                <p className="text-[10px] font-mono tracking-widest uppercase opacity-60">
                  SPECIMEN LEDGER
                </p>
                <p className="text-xs font-mono font-bold mt-0.5">
                  ARC·5042002
                </p>
              </div>
              <Barcode className="h-10 w-24 text-current" />
            </div>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-[1320px] px-6 py-10">
        <MarketTable rows={rows} liveRows={extraLive} />
      </main>
    </div>
  );
}
