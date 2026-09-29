import Link from "next/link";
import { PROTOCOLS, featuredProtocol, TOTAL_TVL, byLetterDesc } from "@/data/protocols";
import { RatingPlate, GradeLetter } from "@/components/RatingPlate";
import { SearchBox } from "@/components/SearchBox";
import { MarketTape } from "@/components/MarketTape";
import { ageLabel, formatUsd } from "@/lib/grade";
import { enrichProtocolWithDb, enrichProtocolsWithDb } from "@/lib/db";
import { fetchArcProtocols } from "@/lib/discover";

import { TutorialTrigger } from "@/components/TutorialModal";
import { WalkthroughTrigger } from "@/components/WalkthroughTour";

export default async function Home() {
  const featured = await enrichProtocolWithDb(featuredProtocol());
  const tape = await enrichProtocolsWithDb(byLetterDesc());
  const liveProtocols = await fetchArcProtocols().catch(() => []);
  const liveTvlSum = liveProtocols.reduce((s, p) => s + p.tvlUsd, 0);
  const displayTvl = liveTvlSum > 0 ? liveTvlSum : TOTAL_TVL;

  return (
    <div className="hero-wash relative">
      {/* ---------------------------------------------------------- hero */}
      <section className="relative mx-auto max-w-[1120px] px-5 pb-16 pt-20 sm:pt-28">
        <div className="grid items-start gap-14 lg:grid-cols-12">
          <div className="lg:col-span-7">
            <p className="label-xs text-gold">Circle Arc Testnet &middot; Chain 5042002 &middot; USDC</p>
            <h1 className="mt-6 font-display text-[clamp(2.75rem,7vw,5rem)] font-medium leading-[0.95] tracking-[-0.025em] text-paper">
              Know the risk
              <br />
              <span className="text-gold">before the deposit.</span>
            </h1>
            <p className="mt-7 max-w-lg text-[15px] leading-relaxed text-quiet">
              A letter, a score, and a dated dossier for every protocol and token you
              are considering on Arc. Free letter. Full axes for $0.01 USDC. Built for
              humans and for agents.
            </p>

            <SearchBox />

            <div className="mt-8 flex flex-wrap items-center justify-between gap-4 border-t border-paper/[0.08] pt-6">
              <div className="flex flex-wrap items-center gap-x-8 gap-y-3">
                <Stat label="Research benchmarks" value={String(PROTOCOLS.length)} />
                <Stat label="Live telemetry (DeFiLlama)" value={formatUsd(displayTvl)} />
                <Stat label="Dossier" value="$0.01" />
              </div>
              <div className="flex items-center gap-2.5">
                <WalkthroughTrigger label="Interactive Walkthrough" />
                <TutorialTrigger label="Tutorial" />
                <Link href="/guide" className="label-xs text-faint hover:text-gold transition-colors hidden sm:inline">
                  Guide &rarr;
                </Link>
              </div>
            </div>
          </div>

          {/* Live rating plate — the product in one object. */}
          <div className="lg:col-span-5" data-walkthrough="rating-plate">
            <Link href={`/p/${featured.slug}`} className="block lift">
              <RatingPlate protocol={featured} slam />
            </Link>
            <p className="label-xs mt-4 text-center">
              Live plate &middot; {featured.name} &middot; updated{" "}
              {ageLabel(featured.updatedAt)}
            </p>
          </div>
        </div>
      </section>

      {/* ----------------------------------------------------- market tape */}
      <MarketTape items={tape} />

      {/* ------------------------------------------------------ three cols */}
      <section className="mx-auto max-w-[1120px] px-5 py-24">
        <div className="grid gap-px border border-paper/[0.07] bg-paper/[0.07] md:grid-cols-3">
          <Col
            n="01"
            title="How grades work"
            body="Nine axes, weighted, then compounded so a weak link cannot be averaged away. Liquidity does not hide a missing audit. The method is public and versioned on every page."
            href="/methodology"
            cta="Read the methodology"
          />
          <Col
            n="02"
            title="What $0.01 unlocks"
            body="Every axis with evidence and citations, the unlock calendar, the incident log, what would drop the letter, and a machine-readable JSON view. One payment, valid 24 hours."
            href="/p/aave-v4-arc"
            cta="See a full dossier"
          />
          <Col
            n="03"
            title="For agents"
            body="A free summary endpoint and a paid full-grade endpoint behind x402. Surface the letter to the user before allocating. Pay-per-request, settled in USDC on Arc."
            href="/agents"
            cta="Read the agent API"
          />
        </div>
      </section>

      {/* --------------------------------------------------------- ledger */}
      <section className="mx-auto max-w-[1120px] px-5 pb-8">
        <div className="flex items-end justify-between">
          <div>
            <h2 className="font-display text-3xl text-paper">Hand-Analysed Research Benchmarks</h2>
            <p className="mt-1 text-[13px] text-quiet">
              19 deep-dive security evaluations with primary audit citations. For live automated multi-chain feeds, visit the{" "}
              <Link href="/arc" className="text-gold hover:underline">Live Universe</Link>.
            </p>
          </div>
          <Link href="/markets" className="link-gold label-xs">
            All markets &rarr;
          </Link>
        </div>
        <div className="rule-draw my-6" />
        <ul className="grid gap-px bg-paper/[0.07] sm:grid-cols-2 lg:grid-cols-4">
          {tape.slice(0, 8).map((p) => (
            <li key={p.slug} className="bg-void">
              <Link href={`/p/${p.slug}`} className="lift block p-5">
                <div className="flex items-start justify-between">
                  <GradeLetter letter={p.letter} className="text-4xl" />
                  <span className="num font-mono text-[11px] text-faint">{p.score}</span>
                </div>
                <p className="mt-4 font-display text-lg text-paper">{p.name}</p>
                <p className="label-xs mt-1.5">{p.category}</p>
                <p className="mt-3 line-clamp-2 text-[12px] leading-relaxed text-quiet">
                  {p.verdict}
                </p>
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="label-xs">{label}</p>
      <p className="num mt-2 font-mono text-lg text-gold">{value}</p>
    </div>
  );
}

function Col({
  n,
  title,
  body,
  href,
  cta,
}: {
  n: string;
  title: string;
  body: string;
  href: string;
  cta: string;
}) {
  return (
    <div className="bg-panel p-7">
      <p className="font-mono text-[11px] text-gold/70">{n}</p>
      <h3 className="mt-4 font-display text-xl text-paper">{title}</h3>
      <p className="mt-3 text-[13px] leading-relaxed text-quiet">{body}</p>
      <Link href={href} className="link-gold label-xs mt-6 inline-block">
        {cta}
      </Link>
    </div>
  );
}
