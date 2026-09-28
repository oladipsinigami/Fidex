import type { Metadata } from "next";
import Link from "next/link";
import { StudioTable, type StudioRow } from "@/components/StudioTable";
import { byLetterDesc } from "@/data/protocols";
import { METHODOLOGY_VERSION, isStale } from "@/lib/grade";
import { fetchArcProtocols } from "@/lib/discover";
import { isListable, screen } from "@/lib/screen";
import { WalletGate } from "@/components/WalletGate";

export const metadata: Metadata = {
  title: "Studio — analyst workspace",
  robots: { index: false },
};

export const revalidate = 900;

export default async function StudioPage() {
  const fullProtocols = byLetterDesc();
  const rows: StudioRow[] = fullProtocols.map((p) => ({
    slug: p.slug,
    name: p.name,
    category: p.category,
    letter: p.letter,
    score: p.score,
    updatedAt: p.updatedAt,
    isStale: isStale(p),
    axes: p.axes.map((a) => ({
      id: a.id,
      label: a.label,
      score: a.score,
      weight: a.weight,
    })),
  }));
  const stale = rows.filter((p) => p.letter === "D" || p.letter === "F").length;

  // Coverage gap: how much of Arc is discovered but not yet hand-analysed.
  let discovered = 0;
  let ungraded = 0;
  try {
    const live = (await fetchArcProtocols()).filter(isListable);
    discovered = live.length;
    ungraded = live.filter((p) => screen(p).letter === null).length;
  } catch {
    // Live feed down: the table below is still authoritative.
  }

  return (
    <div className="mx-auto max-w-[1120px] px-5 py-16">
      <header className="flex flex-wrap items-end justify-between gap-6">
        <div>
          <p className="label-xs text-gold">Analyst workspace &middot; {METHODOLOGY_VERSION}</p>
          <h1 className="mt-5 font-display text-[clamp(2rem,4vw,3rem)] leading-[1.05] text-paper">
            Studio
          </h1>
          <p className="mt-4 max-w-xl text-[14px] leading-relaxed text-quiet">
            A table and a form, not a CMS. Scores change only through a publish action
            that records an analyst, a timestamp, and a content hash.
          </p>
        </div>
        <div className="flex gap-8">
          <div>
            <p className="label-xs">In review</p>
            <p className="num mt-2 font-mono text-lg text-caution">{stale}</p>
          </div>
          <div>
            <p className="label-xs">Total</p>
            <p className="num mt-2 font-mono text-lg text-gold">{rows.length}</p>
          </div>
          {discovered > 0 && (
            <div>
              <p className="label-xs">Awaiting analysis</p>
              <p className="num mt-2 font-mono text-lg text-paper" title="Discovered on Arc but not hand-analysed">
                {ungraded}
                <span className="text-faint">/{discovered}</span>
              </p>
            </div>
          )}
        </div>
      </header>

      {discovered > 0 && (
        <p className="mt-8 max-w-2xl text-[13px] leading-relaxed text-quiet">
          {ungraded} of the {discovered} protocols with deployment on Arc have been discovered
          automatically but not yet worked by an analyst, so they carry a coverage fraction
          rather than a letter.{" "}
          <Link href="/arc" className="text-gold underline-offset-2 hover:underline">
            Review the live universe
          </Link>
          .
        </p>
      )}

      <div className="rule-draw my-10" />

      <WalletGate protocolName="Studio Analyst Console" category="Governance">
        <StudioTable rows={rows} />
      </WalletGate>
    </div>
  );
}
