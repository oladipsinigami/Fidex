import Link from "next/link";
import { fetchArcProtocols, fmtShort } from "@/lib/discover";
import { isListable, MIN_COVERAGE, screen } from "@/lib/screen";
import { AXIS_LABEL } from "@/data/axes";

export const revalidate = 900;

/**
 * /arc — the live universe.
 *
 * Every protocol with deployment on Arc, discovered live from the same public
 * dataset that powers defillama.com/chain/Arc. Nothing is hand-picked, so the
 * coverage figure is the real one.
 */
export default async function ArcUniversePage() {
  let rows: Awaited<ReturnType<typeof fetchArcProtocols>> = [];
  let error: string | null = null;
  try {
    rows = (await fetchArcProtocols()).filter(isListable);
  } catch (e) {
    error = (e as Error).message;
  }

  const totalTvl = rows.reduce((s, p) => s + p.tvlUsd, 0);
  const graded = rows.filter((p) => screen(p).letter !== null).length;
  const stats: [string, string][] = [
    ["Protocols", String(rows.length)],
    ["Arc TVL", `$${fmtShort(totalTvl)}`],
    ["Full grades", `${graded} / ${rows.length}`],
    ["Letter threshold", `${Math.round(MIN_COVERAGE * 100)}% axes`],
  ];

  return (
    <main className="mx-auto max-w-[1120px] px-5 py-14">
      <p className="label-xs text-gold">Live universe &middot; DeFiLlama feed</p>
      <h1 className="mt-5 font-display text-[clamp(2.25rem,5vw,3.5rem)] leading-[1.02] tracking-[-0.02em] text-paper">
        Every protocol on Arc
      </h1>
      <p className="mt-6 max-w-2xl text-[14px] leading-relaxed text-quiet">
        Fidex tracks the full set of protocols with deployment on Arc, discovered live
        from the public dataset behind defillama.com/chain/Arc. Nothing here is hand-picked,
        so the coverage figure is the real one &mdash; including the part we have not graded.
      </p>

      <dl className="mt-12 grid grid-cols-2 gap-px border border-paper/[0.08] bg-paper/[0.06] md:grid-cols-4">
        {stats.map(([k, v]) => (
          <div key={k} className="bg-void px-5 py-6">
            <dt className="label-xs text-faint">{k}</dt>
            <dd className="num mt-2.5 font-display text-2xl text-paper">{v}</dd>
          </div>
        ))}
      </dl>

      {error && (
        <p className="mt-8 border border-[color:var(--color-rust)]/40 px-5 py-4 text-[13px] text-[color:var(--color-rust)]">
          Live feed unavailable: {error}. The hand-analysed grades on /markets are unaffected.
        </p>
      )}


      <div className="mt-14 overflow-x-auto">
        <table className="w-full min-w-[720px] text-left text-[13px]">
          <thead>
            <tr className="border-b border-paper/[0.1]">
              {["Protocol", "Category", "Arc TVL", "Audits", "Axes", "Route"].map((h, i) => (
                <th
                  key={h}
                  className={`label-xs py-3 font-normal text-faint ${i >= 2 && i <= 4 ? "text-right" : ""}`}
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((p) => {
              const s = screen(p);
              const liq = p.axes.find((a) => a.id === "liquidity");
              const aud = p.axes.find((a) => a.id === "audits");
              return (
                <tr key={p.slug} className="border-b border-paper/[0.05] align-top">
                  <td className="py-4 pr-4">
                    <div className="flex items-center gap-3">
                      <span className="num grid h-9 w-9 shrink-0 place-items-center border border-paper/[0.1] font-mono text-[11px] text-gold">
                        {p.monogram}
                      </span>
                      <div className="min-w-0">
                        <div className="text-paper">{p.name}</div>
                        {p.url && (
                          <a
                            href={p.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="font-mono text-[11px] text-faint underline-offset-2 hover:text-gold hover:underline"
                          >
                            {p.url.replace(/^https?:\/\//, "").slice(0, 38)}
                          </a>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="py-4 pr-4 text-quiet">{p.category}</td>
                  <td className="num py-4 pr-4 text-right font-mono text-paper">
                    ${fmtShort(p.tvlUsd)}
                  </td>
                  <td className="num py-4 pr-4 text-right font-mono text-quiet">
                    {aud?.score ?? "—"}
                    {aud && aud.score === 8 && (
                      <span className="ml-1" title="No published audit link">
                        {"!"}
                      </span>
                    )}
                  </td>
                  <td className="num py-4 pr-4 text-right font-mono text-quiet">
                    {s.measuredCount}/8
                    {liq?.score != null && (
                      <span className="ml-1 text-faint">({liq.score})</span>
                    )}
                  </td>
                  <td className="py-4 font-mono text-[11px] text-faint">
                    {p.arcRoute === "native" ? "native" : "bridged"}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>


      <section className="plate mt-16 p-7">
        <h2 className="font-display text-xl text-paper">Why most rows carry no letter</h2>
        <p className="mt-4 max-w-[68ch] text-[13px] leading-relaxed text-quiet">
          A public API exposes liquidity, protocol age, audit links and chain footprint. It does
          not expose security posture, admin-key topology, holder concentration or governance
          quality. Those five axes are marked <span className="text-paper">not yet measured</span>{" "}
          rather than filled in with a guess.
        </p>
        <p className="mt-3 max-w-[68ch] text-[13px] leading-relaxed text-quiet">
          Because the composite is multiplicative across the weakest axis, renormalising the
          missing five to &ldquo;average&rdquo; would hide the exact failure the model exists to
          catch &mdash; a protocol that looks immaculate on liquidity and is quietly insolvent.
          So a letter is published only once at least {Math.round(MIN_COVERAGE * 100)}% of
          compounding weight rests on a public datum. Below that, the row shows a coverage
          fraction instead of a grade.
        </p>
        <ul className="mt-5 flex flex-wrap gap-2">
          {(["liquidity", "audits", "history", "arcFit"] as const).map((id) => (
            <li key={id} className="label-xs border border-paper/[0.12] px-2.5 py-1.5 text-gold">
              {AXIS_LABEL[id]} &middot; measured
            </li>
          ))}
          {(["security", "decentralization", "concentration", "governance", "yieldSustainability"] as const).map(
            (id) => (
              <li key={id} className="label-xs border border-paper/[0.08] px-2.5 py-1.5 text-faint">
                {AXIS_LABEL[id]} &middot; unmeasured
              </li>
            ),
          )}
        </ul>
        <p className="mt-6 border-t border-paper/[0.06] pt-5 text-[13px] leading-relaxed text-quiet">
          The hand-analysed protocols on{" "}
          <Link href="/markets" className="text-gold underline-offset-2 hover:underline">
            /markets
          </Link>{" "}
          carry all nine axes with citations, and are the only names that earn a letter today.
          Screening a protocol is the step before grading it, not instead of it.
        </p>
      </section>
    </main>
  );
}
