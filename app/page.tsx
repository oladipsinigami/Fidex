import Link from "next/link";
import { PROTOCOLS, featuredProtocol, TOTAL_TVL, byLetterDesc } from "@/data/protocols";
import { GradeLetter } from "@/components/RatingPlate";
import { LookbookHero } from "@/components/LookbookHero";
import { formatUsd } from "@/lib/grade";
import { enrichProtocolWithDb, enrichProtocolsWithDb } from "@/lib/db";
import { fetchArcProtocols } from "@/lib/discover";

export default async function Home() {
  const featured = await enrichProtocolWithDb(featuredProtocol());
  const tape = await enrichProtocolsWithDb(byLetterDesc());
  const liveProtocols = await fetchArcProtocols().catch(() => []);
  const liveTvlSum = liveProtocols.reduce((s, p) => s + p.tvlUsd, 0);
  const displayTvl = liveTvlSum > 0 ? liveTvlSum : TOTAL_TVL;

  return (
    <div className="lookbook">
      <LookbookHero featured={featured} />

      <section className="lookbook-strip">
        <span>Issued</span>
        <strong>{PROTOCOLS.length}</strong>
        <span>Telemetry</span>
        <strong>{formatUsd(displayTvl)}</strong>
        <span>Dossier</span>
        <strong>$0.01</strong>
        <span>Method</span>
        <strong>fidex/1.4.0</strong>
      </section>

      <section className="lookbook-journal">
        <header className="lookbook-journal__head">
          <p className="lookbook-kicker">01 · Method</p>
          <h2>Weakest link wins.</h2>
        </header>
        <div className="lookbook-journal__grid">
          <article>
            <p className="lookbook-num">01</p>
            <h3>Nine axes, compounded</h3>
            <p>
              Weighted, then multiplied by the weakest score. Liquidity cannot
              average away a missing audit. The formula is public and versioned
              on every plate.
            </p>
            <Link href="/methodology">Read the method →</Link>
          </article>
          <article>
            <p className="lookbook-num">02</p>
            <h3>One cent, twenty-four hours</h3>
            <p>
              Axes, citations, unlock calendar, incident log, machine-readable
              JSON. Paid once in USDC on Arc. Valid on this device for a day.
            </p>
            <Link href={`/p/${featured.slug}`}>See a dossier →</Link>
          </article>
          <article>
            <p className="lookbook-num">03</p>
            <h3>Agents pay the same</h3>
            <p>
              Free summary for the letter. x402 for the full grade. Surface the
              letter before allocating. D and F refuse without a human.
            </p>
            <Link href="/agents">Agent API →</Link>
          </article>
        </div>
      </section>

      <section className="lookbook-book">
        <header className="lookbook-journal__head">
          <p className="lookbook-kicker">02 · Research book</p>
          <h2>Hand-issued plates</h2>
          <p className="lookbook-note">
            Nineteen deep-dives. Live screened names stay unlettered until
            coverage clears sixty percent.
          </p>
        </header>
        <ul className="lookbook-plates">
          {tape.slice(0, 8).map((p) => (
            <li key={p.slug}>
              <Link href={`/p/${p.slug}`}>
                <GradeLetter letter={p.letter} className="text-6xl" />
                <span className="lookbook-plates__score">{p.score}</span>
                <span className="lookbook-plates__name">{p.name}</span>
                <span className="lookbook-plates__cat">{p.category}</span>
              </Link>
            </li>
          ))}
        </ul>
        <Link href="/markets" className="lookbook-more">
          All markets →
        </Link>
      </section>
    </div>
  );
}
