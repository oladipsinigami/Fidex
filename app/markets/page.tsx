import type { Metadata } from "next";
import { MarketTable, type UnifiedRow } from "@/components/MarketTable";
import { byLetterDesc, TOTAL_TVL } from "@/data/protocols";
import { METHODOLOGY_VERSION, formatUsd, isStale } from "@/lib/grade";
import { fetchArcProtocols } from "@/lib/discover";
import { isListable } from "@/lib/screen";

export const revalidate = 900;

export const metadata: Metadata = {
  title: "Markets — every protocol & dApp on Arc",
  description:
    "The full ArcGrade ledger: letter, score, 7-day change, TVL and yield note for every protocol, token, and dApp on Circle Arc.",
};

export default async function MarketsPage() {
  const fullProtocols = byLetterDesc();
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
  const totalTrackedTvl = TOTAL_TVL + extraLive.reduce((s, x) => s + x.tvlUsd, 0);

  return (
    <div>
      <header className="border-b border-paper/[0.07]">
        <div className="mx-auto max-w-[1120px] px-5 py-14">
          <p className="label-xs text-gold">Ledger &middot; {totalCount} dApps on Arc</p>
          <h1 className="mt-5 font-display text-[clamp(2.25rem,5vw,3.5rem)] leading-[1.02] tracking-[-0.02em] text-paper">
            All markets & dApps
          </h1>
          <p className="mt-5 max-w-2xl text-[15px] leading-relaxed text-quiet">
            Every protocol, token, and decentralized application running on Circle Arc. Hand-analysed dossiers with 9-axis deep dives, alongside live telemetry from on-chain feeds.
          </p>
          <div className="mt-8 flex flex-wrap gap-x-10 gap-y-4">
            <Stat label="Total dApps" value={String(totalCount)} />
            <Stat label="Capital tracked" value={formatUsd(totalTrackedTvl)} />
            <Stat label="Full Dossiers" value={String(rows.length)} />
            <Stat label="Method" value={METHODOLOGY_VERSION} mono />
          </div>
        </div>
      </header>

      <section className="mx-auto max-w-[1120px] px-5 py-10">
        <MarketTable rows={rows} liveRows={liveRows} />
      </section>

      <div className="mx-auto max-w-[1120px] px-5 pb-16">
        <p className="border-t border-paper/[0.07] pt-6 text-[11px] leading-relaxed text-faint">
          Protocols cannot purchase a letter. A listing slot and a faster review queue
          are the only things that can be bought, and neither affects a score. Not
          financial advice, not a credit rating.
        </p>
      </div>
    </div>
  );
}

function Stat({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div>
      <p className="label-xs">{label}</p>
      <p className={`num mt-2 text-lg text-gold ${mono ? "font-mono text-[13px]" : "font-mono"}`}>
        {value}
      </p>
    </div>
  );
}
