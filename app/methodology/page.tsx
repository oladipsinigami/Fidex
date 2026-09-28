import type { Metadata } from "next";
import { BANDS, METHODOLOGY_VERSION, STALE_AFTER_DAYS, compositeOf } from "@/lib/grade";
import { AXIS_LABEL, WEIGHTS } from "@/data/axes";
import { PROTOCOLS } from "@/data/protocols";

export const metadata: Metadata = {
  title: "Methodology",
  description:
    "How ArcGrade scores protocols: nine weighted axes, a multiplicative composite across weak links, letter bands, update cadence, and conflict-of-interest policy.",
};

const ORDER = Object.keys(WEIGHTS) as (keyof typeof WEIGHTS)[];

const AXIS_NOTES: Record<string, string> = {
  security:
    "Open critical findings, exploit history, whether a live bounty exists, and whether the code holding funds today is the code that was audited.",
  liquidity:
    "TVL level and 30/90-day trend, real exit-pool depth rather than headline deposits, withdrawal friction, and how much of the float is USDC.",
  decentralization:
    "Admin keys, timelock length, guardian powers, and whether pausing and fund movement are separated between parties.",
  audits:
    "Count and quality of firms, recency against the last upgrade, and critically: whether the Arc deployment was in scope rather than only the Ethereum origin.",
  concentration:
    "Top-10 holder share, team and investor unlocks, and how much insider float is already liquid.",
  history:
    "Time in production, pauses, incidents, and time since the last material upgrade on the chain we actually grade.",
  governance:
    "Voter concentration, quorum, and the substance of the last five risk-moving votes rather than their headlines.",
  yieldSustainability:
    "Real fees against emissions, how long the yield has held, and the source of the return. This axis is where most high-APY products fail.",
  arcFit:
    "How natively the protocol serves Arc: contracts deployed to the chain versus liquidity that merely arrives through a bridge, whether the Arc deployment was a considered one or a copy, and whether the team maintains an Arc-specific integration. Displayed separately and given zero composite weight, because a well-built protocol on the wrong chain is still the wrong chain for this mandate.",
};

export default function MethodologyPage() {
  return (
    <div className="mx-auto max-w-[1120px] px-5 py-16">
      <header className="max-w-3xl">
        <p className="label-xs text-gold">Rating-agency note &middot; {METHODOLOGY_VERSION}</p>
        <h1 className="mt-5 font-display text-[clamp(2.25rem,5vw,3.5rem)] leading-[1.02] tracking-[-0.02em] text-paper">
          Methodology
        </h1>
        <p className="mt-6 font-display text-[19px] leading-relaxed text-paper/85">
          Risk is part of investing. It should be informed and calculated — before the
          deposit, not after the exploit.
        </p>
        <p className="mt-5 text-[14px] leading-relaxed text-quiet">
          This document is public and versioned. Every published grade carries the
          methodology version it was produced under, so a letter can always be traced
          back to the rules that produced it.
        </p>
      </header>

      <div className="rule-draw my-12" />

      <Section n="01" title="The composite is multiplicative, not an average">
        <p>
          A naive weighted average is the failure mode of most ratings products: deep
          liquidity cancels a missing audit, and a large-TVL protocol with one partial
          audit scores respectably. That is precisely the combination that loses money.
        </p>
        <p>
          We compute a weighted mean over the eight compounding axes, then multiply it by
          a <strong className="text-paper">link factor</strong> derived from the{" "}
          <strong className="text-paper">weakest single axis</strong>:
        </p>
        <div className="not-prose my-6 border-l border-gold/40 bg-sunk/60 px-5 py-4">
          <p className="num font-mono text-[12px] leading-relaxed text-paper/85">
            composite = weightedMean &times; (0.5 + 0.5 &radic;(weakest / 100))
          </p>
        </div>
        <p>
          The link factor ranges from 0.50 to 1.00 on a concave curve, so mid-range
          weakness bites hard while near-zero weakness is already catastrophic. The
          practical consequence: <em>liquidity cannot hide a missing audit</em>.
        </p>
        <p>
          A corollary worth stating plainly — under this model an{" "}
          <strong className="text-gold">A</strong> requires no compounding axis below 85.
          There is no averaging your way to the top band.
        </p>
      </Section>

      <Section n="02" title="Nine axes">
        <p>
          Eight compound into the score. The ninth,{" "}
          <strong className="text-paper">Arc fit</strong>, is displayed separately and
          deliberately excluded from the composite, because a bad protocol on a good
          chain is still a bad protocol and we do not want chain convenience to flatter a
          weak book.
        </p>
        <div className="not-prose mt-8 border border-paper/[0.07]">
          {ORDER.map((id, i) => (
            <div
              key={id}
              className={`grid gap-3 p-5 sm:grid-cols-[1fr_auto] sm:gap-8 ${
                i > 0 ? "border-t border-paper/[0.06]" : ""
              }`}
            >
              <div>
                <p className="font-display text-lg text-paper">{AXIS_LABEL[id]}</p>
                <p className="mt-2 max-w-[62ch] text-[13px] leading-relaxed text-quiet">
                  {AXIS_NOTES[id]}
                </p>
              </div>
              <p className="num font-mono text-[12px] text-gold sm:text-right">
                {WEIGHTS[id] > 0 ? `weight ${(WEIGHTS[id] * 100).toFixed(0)}%` : "display only"}
              </p>
            </div>
          ))}
        </div>
      </Section>

      <Section n="03" title="Letter bands">
        <div className="not-prose border border-paper/[0.07]">
          {BANDS.map((b, i) => (
            <div
              key={b.letter}
              className={`flex items-center gap-6 p-5 ${i > 0 ? "border-t border-paper/[0.06]" : ""}`}
            >
              <span className="w-16 shrink-0 font-display text-4xl text-gold">{b.letter}</span>
              <span className="num w-28 shrink-0 font-mono text-[12px] text-paper/85">
                {b.min}&ndash;{b.max}
              </span>
              <span className="text-[13px] text-quiet">{b.label}</span>
            </div>
          ))}
        </div>
        <p className="mt-5">
          Scores are rounded from the composite, then banded. The letter is never
          hand-assigned: it is a pure function of the published axis scores, so it cannot
          drift from the model.
        </p>
      </Section>

      <Section n="04" title="Update cadence and staleness">
        <p>
          Grades are refreshed as material facts change, and reviewed every seven days
          regardless. A grade older than {STALE_AFTER_DAYS} days without a refresh is
          displayed with an amber <strong className="text-caution">stale</strong> chip,
          and its <span className="font-mono text-[12px]">stale</span> flag is set to{" "}
          <span className="font-mono text-[12px]">true</span> in the agent API. A stale
          grade is not withdrawn; it is marked, because silence would be worse.
        </p>
        <p>
          Every published grade stores its slug, letter, score, methodology version, a
          content hash, the update timestamp, and the analyst identifier. Those six
          fields are what make a grade citable.
        </p>
      </Section>

      <Section n="05" title="Conflicts, and what money cannot buy">
        <p>
          <strong className="text-paper">Protocols cannot buy a letter.</strong> The only
          purchasable things are a listing slot and a faster review queue. Neither
          affects any axis score, and an issuer that pays for a listing receives the same
          published grade as one that does not.
        </p>
        <p>
          Ambiguity is resolved by a human analyst, and raw inputs are cited on every
          paid axis &mdash; audit PDFs, explorer addresses, governance proposals,
          on-chain data. Where we cannot verify something, the axis says so rather than
          defaulting to a neutral middle.
        </p>
        <p>
          An analyst bond with a slashing mechanism is a planned later addition. We
          would rather ship without it than simulate a slashing regime we do not operate.
        </p>
      </Section>

      <Section n="06" title="A worked example">
        <p>
          Two names from the current book, computed in public so you can check the
          arithmetic against your own spreadsheet.
        </p>
        <div className="not-prose mt-6 space-y-px bg-paper/[0.07]">
          {PROTOCOLS.filter((p) => ["aave-v4-arc", "emberyield-farm"].includes(p.slug)).map((p) => {
            const compounding = p.axes.filter((a) => a.weight > 0);
            const mean =
              compounding.reduce((s, a) => s + a.weight * a.score, 0) /
              compounding.reduce((s, a) => s + a.weight, 0);
            const weakest = Math.min(...compounding.map((a) => a.score));
            return (
              <div key={p.slug} className="bg-panel p-6">
                <p className="font-display text-xl text-paper">
                  {p.name} &rarr;{" "}
                  <span className="text-gold">
                    {p.letter} ({p.score})
                  </span>
                </p>
                <p className="num mt-3 font-mono text-[11.5px] leading-relaxed text-quiet">
                  weighted mean {mean.toFixed(1)} &times; link factor{" "}
                  {(0.5 + 0.5 * Math.sqrt(weakest / 100)).toFixed(3)} (weakest axis {weakest}) ={" "}
                  {compositeOf(p.axes)}
                </p>
              </div>
            );
          })}
        </div>
      </Section>

      <footer className="mt-16 border-t border-paper/[0.07] pt-8">
        <p className="max-w-3xl text-[11px] leading-relaxed text-faint">
          ArcGrade is not financial advice and is not a credit rating agency. It
          publishes a structured read of how a protocol can fail, not a prediction of
          price or a recommendation to transact. Letters are opinions with published
          reasoning, and opinions can be wrong. Verify anything that matters.
        </p>
      </footer>
    </div>
  );
}

function Section({ n, title, children }: { n: string; title: string; children: React.ReactNode }) {
  return (
    <section className="mb-16">
      <div className="flex items-baseline gap-4">
        <span className="font-mono text-[11px] text-gold/70">{n}</span>
        <h2 className="font-display text-2xl leading-snug text-paper">{title}</h2>
      </div>
      <div className="mt-6 space-y-4 text-[14px] leading-relaxed text-quiet [&_em]:text-paper/80 [&_strong]:font-medium">
        {children}
      </div>
    </section>
  );
}
