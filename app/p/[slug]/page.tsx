import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { cookies } from "next/headers";
import type { LiveProtocol, Protocol } from "@/lib/types";
import { getProtocol, PROTOCOLS } from "@/data/protocols";
import { GradeLetter, ScoreRing, StaleChip } from "@/components/RatingPlate";
import { AxisRow, LockedAxes } from "@/components/Axis";
import { Paywall } from "@/components/Paywall";
import { DecisionCard } from "@/components/DecisionCard";
import { AgentSnippet } from "@/components/AgentSnippet";
import { ageLabel, formatUsd, isStale, toneFor } from "@/lib/grade";
import { COOKIE, unlocks, verifyReceipt } from "@/lib/unlock";
import { fetchArcProtocols, fmtShort } from "@/lib/discover";
import { screen } from "@/lib/screen";
import { WalletGate } from "@/components/WalletGate";

export function generateStaticParams() {
  return PROTOCOLS.map((p) => ({ slug: p.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const p = getProtocol(slug);
  if (p) {
    return {
      title: `${p.name} — ${p.letter} (${p.score})`,
      description: p.verdict,
      openGraph: {
        title: `${p.name} rates ${p.letter} · ${p.score}/100 on ArcGrade`,
        description: p.verdict,
      },
    };
  }
  const liveList = await fetchArcProtocols().catch(() => []);
  const live = liveList.find((x) => x.slug === slug);
  if (live) {
    const sc = screen(live);
    const letterStr = sc.letter ? ` — ${sc.letter}` : " (Screened)";
    return {
      title: `${live.name}${letterStr} — Arc Protocol Screen`,
      description: live.description || `DeFi protocol deployed on Circle Arc with $${fmtShort(live.tvlUsd)} TVL.`,
    };
  }
  return { title: "Not rated" };
}

export default async function ProtocolPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const p = getProtocol(slug);
  if (!p) {
    const liveList = await fetchArcProtocols().catch(() => []);
    const live = liveList.find((x) => x.slug === slug);
    if (!live) notFound();
    return <LiveProtocolView p={live} />;
  }

  const jar = await cookies();
  const paid = unlocks(verifyReceipt(jar.get(COOKIE)?.value), p.slug);
  const stale = isStale(p);
  const tone = toneFor(p.letter);
  const seen = new Set<string>();
  const related = p.related
    .filter((s) => (seen.has(s) ? false : (seen.add(s), true)))
    .map((s) => PROTOCOLS.find((x) => x.slug === s))
    .filter((x): x is NonNullable<typeof x> => Boolean(x));

  return (
    <article className="relative">
      <Header p={p} />
      <WalletGate protocolName={p.name} category={p.category}>
        <Hero p={p} paid={paid} stale={stale} tone={tone} />
        <Axes p={p} paid={paid} />
        {paid && <KillShots p={p} />}
        <section className="mx-auto max-w-[1120px] px-5 py-10">
          <div className="grid gap-8 lg:grid-cols-2">
            {paid && <DecisionCard protocol={p} />}
            <AgentSnippet protocol={p} paid={paid} />
          </div>
        </section>
        {paid && p.unlocks.length > 0 && <UnlockTable p={p} />}
        {related.length > 0 && <Related related={related} />}
        <Disclaimer p={p} />
      </WalletGate>
    </article>
  );
}

/* ------------------------------------------------------------------ */

function Header({ p }: { p: Protocol }) {
  return (
    <div className="border-b border-paper/[0.07]">
      <div className="mx-auto max-w-[1120px] px-5 pt-8">
        <nav className="label-xs flex flex-wrap items-center gap-2 text-faint">
          <Link href="/markets" className="hover:text-gold">Markets</Link>
          <span>/</span>
          <span className="text-quiet">{p.category}</span>
          <span>/</span>
          <span className="text-quiet">{p.name}</span>
        </nav>
        <div className="mt-4 flex flex-wrap items-center gap-4">
          <StaleChip updatedAt={p.updatedAt} />
          <span className="label-xs text-faint">
            Arc route:{" "}
            {p.arcRoute === "native" ? "Native on Arc" : `Bridged (${p.arcRoute.replace("bridged-", "")})`}
          </span>
        </div>

        {p.slug === "emberyield-farm" && (
          <div className="mt-6 rounded-[2px] border border-stop/40 bg-stop/10 p-4 text-[13px] text-paper">
            <div className="flex items-center gap-2 font-mono text-stop font-bold text-xs uppercase tracking-wider">
              <span>⚠️ Simulated Benchmark Threat Model</span>
              <span className="text-paper/40">&middot;</span>
              <span>Not a Live Vault</span>
            </div>
            <p className="mt-1 text-xs text-quiet leading-relaxed">
              EmberYield Farm is a synthetic threat-model reference asset maintained to verify that ArcGrade compounding algorithms immediately detect and mathematically penalize unsustainable emissions-funded yields down to Grade F.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

/** Left 7 / right 5. Monumental letter, verdict, paywall. */
function Hero({
  p,
  paid,
  stale,
  tone,
}: {
  p: Protocol;
  paid: boolean;
  stale: boolean;
  tone: ReturnType<typeof toneFor>;
}) {
  return (
    <section className="mx-auto max-w-[1120px] px-5 py-14">
      <div className="grid gap-12 lg:grid-cols-12">
        <div className="lg:col-span-7">
          <div
            className="relative overflow-hidden border border-paper/[0.07] p-8 sm:p-10"
            style={{
              backgroundImage: `radial-gradient(ellipse 80% 70% at 20% 10%, ${tone.glow}, transparent 70%), linear-gradient(168deg, var(--color-elev), var(--color-panel) 60%, var(--color-sunk))`,
            }}
          >
            <span
              aria-hidden
              className="pointer-events-none absolute -right-8 -top-16 select-none font-display text-[20rem] font-semibold leading-none text-paper/[0.05]"
            >
              {p.letter}
            </span>

            <div className="relative flex flex-wrap items-end gap-8">
              <div>
                <GradeLetter letter={p.letter} slam className="text-[clamp(9rem,22vw,15rem)]" />
                <p className="label-xs mt-4">
                  {tone.label} &middot; {p.category}
                </p>
              </div>
              <div className="pb-4">
                <ScoreRing score={p.score} size={148} />
              </div>
            </div>

            <div className="relative mt-8 grid gap-x-6 gap-y-4 border-t border-paper/[0.07] pt-6 sm:grid-cols-4">
              <Cell label="As of" value={ageLabel(p.updatedAt)} warn={stale} />
              <Cell label="Method" value={p.methodologyVersion} mono small />
              <Cell label="TVL" value={formatUsd(p.tvlUsd)} />
              <Cell label="Analyst" value={p.analystId} mono small />
            </div>

            <p className="relative mt-5 break-all font-mono text-[10px] text-faint">
              {p.contentHash}
            </p>
          </div>

          <p className="mt-5 text-[11px] leading-relaxed text-faint">
            Letter is not a prediction of price. It is a structured read of how this
            thing can fail. Not financial advice, not a credit rating.
          </p>
        </div>

        <div className="lg:col-span-5">
          <h1 className="font-display text-3xl leading-tight text-paper">{p.name}</h1>
          <p className="mt-4 font-display text-[17px] leading-relaxed text-paper/90">
            {paid ? p.dossierVerdict : p.verdict}
          </p>

          <div className="mt-7 space-y-3 border-t border-paper/[0.07] pt-5 text-[12.5px]">
            <Row k="Chain focus" v={p.chainFocus} />
            <Row k="Yield note" v={p.yieldNote} />
            <Row k="7d change" v={`${p.delta7d >= 0 ? "+" : ""}${p.delta7d}`} signed />
          </div>

          <div data-walkthrough="paywall-box" className="mt-7">
            {paid ? (
              <p className="plate px-5 py-4 text-[13px] text-reserve">
                Dossier unlocked. Valid 24 hours on this device.
              </p>
            ) : (
              <Paywall slug={p.slug} />
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

function Axes({ p, paid }: { p: Protocol; paid: boolean }) {
  return (
    <section data-walkthrough="axes-breakdown" className="mx-auto max-w-[1120px] px-5 py-10">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <h2 className="font-display text-3xl text-paper">Nine axes</h2>
        <p className="label-xs">Weights shown &middot; method {p.methodologyVersion}</p>
      </div>
      <div className="rule-draw my-6" />
      {paid ? (
        <div>
          {p.axes.map((a, i) => (
            <AxisRow key={a.id} axis={a} index={i} locked={false} paid />
          ))}
        </div>
      ) : (
        <LockedAxes protocol={p} />
      )}
    </section>
  );
}

function KillShots({ p }: { p: Protocol }) {
  return (
    <section data-walkthrough="killshots" className="mx-auto max-w-[1120px] px-5 py-10">
      <h2 className="font-display text-3xl text-paper">What breaks this grade</h2>
      <div className="rule-draw my-6" />
      <ul className="grid gap-px bg-paper/[0.07] md:grid-cols-3">
        {p.killShots.map((k) => (
          <li key={k.title} className="bg-panel p-6">
            <p className="label-xs text-stop">Kill shot</p>
            <h3 className="mt-3 font-display text-lg leading-snug text-paper">{k.title}</h3>
            <p className="mt-2.5 text-[13px] leading-relaxed text-quiet">{k.detail}</p>
            <p className="label-xs mt-4 text-faint">Most exposed: {k.axis}</p>
          </li>
        ))}
      </ul>
    </section>
  );
}

function UnlockTable({ p }: { p: Protocol }) {
  return (
    <section className="mx-auto max-w-[1120px] px-5 py-10">
      <h2 className="font-display text-3xl text-paper">Unlock calendar</h2>
      <div className="rule-draw my-6" />
      <table className="ledger w-full text-left text-[13px]">
        <thead>
          <tr className="label-xs">
            <th className="py-3 pr-6 font-normal">Date</th>
            <th className="py-3 pr-6 font-normal">Amount</th>
            <th className="py-3 pr-6 font-normal">% of float</th>
            <th className="py-3 font-normal">Note</th>
          </tr>
        </thead>
        <tbody>
          {p.unlocks.map((u) => (
            <tr key={u.date + u.amount} className="border-t border-paper/[0.06]">
              <td className="num sticky-col py-3.5 pr-6 font-mono text-[12px]">{u.date}</td>
              <td className="py-3.5 pr-6 font-mono text-[12px] text-paper/85">{u.amount}</td>
              <td className="num py-3.5 pr-6 font-mono text-[12px] text-gold">{u.pctOfFloat}%</td>
              <td className="py-3.5 text-quiet">{u.note}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}

function Related({ related }: { related: Protocol[] }) {
  return (
    <section className="mx-auto max-w-[1120px] px-5 py-16">
      <h2 className="font-display text-2xl text-paper">Related markets</h2>
      <div className="rule-draw my-6" />
      <ul className="grid gap-px bg-paper/[0.07] sm:grid-cols-2">
        {related.map((r) => (
          <li key={r.slug} className="bg-void">
            <Link href={`/p/${r.slug}`} className="lift flex items-center gap-5 p-6">
              <GradeLetter letter={r.letter} className="text-5xl" />
              <div className="min-w-0">
                <p className="font-display text-lg text-paper">{r.name}</p>
                <p className="label-xs mt-1">{r.category}</p>
                <p className="mt-2 line-clamp-1 text-[12px] text-quiet">{r.verdict}</p>
              </div>
              <span className="num ml-auto font-mono text-[12px] text-faint">{r.score}</span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

function Disclaimer({ p }: { p: Protocol }) {
  return (
    <div className="mx-auto max-w-[1120px] px-5 pb-16">
      <p className="border-t border-paper/[0.07] pt-6 text-[11px] leading-relaxed text-faint">
        ArcGrade is not financial advice and not a credit rating. It publishes a
        structured read of structural risk as of {ageLabel(p.updatedAt)}, under
        methodology {p.methodologyVersion}. Protocols cannot purchase a letter; they may
        pay for a listing slot and a faster review queue, neither of which affects the
        score. Raw inputs are cited on every paid axis.
      </p>
    </div>
  );
}

function Cell({
  label,
  value,
  mono,
  small,
  warn,
}: {
  label: string;
  value: string;
  mono?: boolean;
  small?: boolean;
  warn?: boolean;
}) {
  return (
    <div className="min-w-0">
      <p className="label-xs">{label}</p>
      <p
        className={`mt-1.5 truncate ${mono ? "font-mono" : ""} ${
          small ? "text-[11px]" : "text-[13px]"
        } ${warn ? "text-caution" : "text-paper/85"}`}
      >
        {value}
      </p>
    </div>
  );
}

function Row({ k, v, signed }: { k: string; v: string; signed?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-4">
      <span className="label-xs">{k}</span>
      <span
        className={`text-right text-[12.5px] ${signed ? "num font-mono" : ""} ${
          signed ? (v.startsWith("-") ? "text-stop" : "text-reserve") : "text-paper/85"
        }`}
      >
        {v}
      </span>
    </div>
  );
}

function LiveProtocolView({ p }: { p: LiveProtocol }) {
  const scr = screen(p);
  const coveragePct = Math.round(scr.coverage * 100);

  return (
    <article className="relative">
      <div className="border-b border-paper/[0.07]">
        <div className="mx-auto max-w-[1120px] px-5 pt-8">
          <nav className="label-xs flex flex-wrap items-center gap-2 text-faint">
            <Link href="/markets" className="hover:text-gold">Markets</Link>
            <span>/</span>
            <Link href="/arc" className="hover:text-gold">Live Universe</Link>
            <span>/</span>
            <span className="text-quiet">{p.category}</span>
            <span>/</span>
            <span className="text-paper">{p.name}</span>
          </nav>
          <div className="mt-4 flex flex-wrap items-center gap-4">
            <span className="label-xs border border-gold/30 bg-gold/10 px-2 py-0.5 text-gold">
              Live Screened (DeFiLlama Feed)
            </span>
            <span className="label-xs text-faint">
              Arc route: {p.arcRoute === "native" ? "Native on Arc" : "Bridged to Arc"}
            </span>
            <span className="label-xs text-faint">
              Chains: {p.chains.join(", ")}
            </span>
          </div>
        </div>
      </div>

      <WalletGate protocolName={p.name} category={p.category}>
        <section className="mx-auto max-w-[1120px] px-5 py-14">
          <div className="grid gap-12 lg:grid-cols-12">
            <div className="lg:col-span-7">
              <div className="relative overflow-hidden border border-paper/[0.07] bg-panel p-8 sm:p-10">
                <div className="flex flex-wrap items-center justify-between gap-6">
                  <div>
                    <span className="label-xs text-gold">Ecosystem Protocol</span>
                    <h1 className="mt-2 font-display text-4xl text-paper sm:text-5xl">{p.name}</h1>
                    <p className="label-xs mt-2 text-quiet">
                      {p.category} &middot; {p.arcRoute === "native" ? "Native Deployment" : "Cross-Chain"}
                    </p>
                  </div>
                  {scr.letter ? (
                    <div className="text-right">
                      <GradeLetter letter={scr.letter} className="text-6xl" />
                      <p className="label-xs mt-1 text-gold">Screening Letter</p>
                    </div>
                  ) : (
                    <div className="rounded-[2px] border border-paper/15 bg-sunk/60 px-4 py-3 text-center">
                      <p className="font-mono text-xl text-paper">{coveragePct}%</p>
                      <p className="label-xs mt-1 text-faint">Measured Weight</p>
                    </div>
                  )}
                </div>

                <p className="mt-6 text-[14px] leading-relaxed text-quiet">
                  {p.description || "Protocol operating on Circle Arc, discovered through public on-chain intelligence."}
                </p>

                <div className="rule-draw my-6" />

                <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                  <div>
                    <p className="label-xs">Arc TVL</p>
                    <p className="num mt-1 font-mono text-base text-gold">${fmtShort(p.tvlUsd)}</p>
                  </div>
                  <div>
                    <p className="label-xs">Total TVL</p>
                    <p className="num mt-1 font-mono text-base text-paper/85">${fmtShort(p.totalTvlUsd)}</p>
                  </div>
                  <div>
                    <p className="label-xs">7d Change</p>
                    <p className={`num mt-1 font-mono text-base ${p.change7d >= 0 ? "text-reserve" : "text-stop"}`}>
                      {p.change7d >= 0 ? "+" : ""}{p.change7d.toFixed(1)}%
                    </p>
                  </div>
                  <div>
                    <p className="label-xs">Audits Listed</p>
                    <p className="num mt-1 font-mono text-base text-paper/85">{p.auditLinks.length}</p>
                  </div>
                </div>

                {p.url && (
                  <div className="mt-6 flex flex-wrap gap-4 pt-2">
                    <a href={p.url} target="_blank" rel="noopener noreferrer" className="link-gold label-xs">
                      Official Website &rarr;
                    </a>
                    {p.twitter && (
                      <a href={`https://twitter.com/${p.twitter}`} target="_blank" rel="noopener noreferrer" className="link-gold label-xs">
                        Twitter / X &rarr;
                      </a>
                    )}
                    <a href={`https://defillama.com/protocol/${p.slug}`} target="_blank" rel="noopener noreferrer" className="link-gold label-xs">
                      DeFiLlama &rarr;
                    </a>
                  </div>
                )}
              </div>
            </div>

            <div className="lg:col-span-5">
              <div className="plate p-7">
                <h3 className="font-display text-lg text-paper">Screening Coverage</h3>
                <p className="mt-2 text-[13px] leading-relaxed text-quiet">
                  ArcGrade requires at least 60% of compounding axis weight before publishing a formal letter. This protocol currently has {scr.measuredCount} of 8 compounding axes backed by public telemetry.
                </p>
                <div className="mt-5">
                  <div className="flex justify-between text-[11px] font-mono text-faint">
                    <span>Coverage</span>
                    <span>{coveragePct}% / 60% threshold</span>
                  </div>
                  <div className="mt-1.5 h-2 w-full overflow-hidden rounded-[1px] bg-paper/10">
                    <div className="h-full bg-gold transition-all" style={{ width: `${Math.min(100, coveragePct)}%` }} />
                  </div>
                </div>

                <div className="rule-draw my-6" />

                <h4 className="label-xs">Analyst Action</h4>
                <p className="mt-2 text-[12px] leading-relaxed text-faint">
                  To move this protocol from automated screening to an official rating with full evidence, kill shots, and unlock schedules, request an analyst review in Studio.
                </p>
                <Link href="/studio" className="link-gold label-xs mt-4 inline-block">
                  Open Analyst Studio &rarr;
                </Link>
              </div>
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-[1120px] px-5 pb-16">
          <h2 className="font-display text-3xl text-paper">Evaluated & Screened Axes</h2>
          <p className="mt-2 text-[13px] text-quiet">
            Axes with verified public data are scored. Unmeasured axes require dedicated human review of deployed bytecodes and admin keys.
          </p>
          <div className="rule-draw my-6" />

          <div className="divide-y divide-paper/[0.06] border-y border-paper/[0.06]">
            {p.axes.map((a) => (
              <div key={a.id} className="py-6">
                <div className="flex flex-wrap items-baseline justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <h3 className="font-display text-lg text-paper">
                      {a.id.charAt(0).toUpperCase() + a.id.slice(1).replace(/([A-Z])/g, " $1")}
                    </h3>
                    {a.score !== null ? (
                      <span className="label-xs text-gold">Measured</span>
                    ) : (
                      <span className="label-xs text-faint">Pending Analysis</span>
                    )}
                  </div>
                  {a.score !== null && (
                    <span className="num font-mono text-sm text-paper">{a.score}/100</span>
                  )}
                </div>
                <p className="mt-2 text-[13px] leading-relaxed text-paper/85">{a.summary}</p>
                <p className="mt-1.5 max-w-[70ch] text-[12.5px] leading-relaxed text-quiet">{a.evidence}</p>
                {a.citations.length > 0 && (
                  <ul className="mt-3 flex flex-wrap gap-3">
                    {a.citations.map((c) => (
                      <li key={c.href + c.label}>
                        <a href={c.href} target="_blank" rel="noopener noreferrer" className="link-gold font-mono text-[10.5px] uppercase">
                          {c.kind} &middot; {c.label}
                        </a>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            ))}
          </div>
        </section>
      </WalletGate>
    </article>
  );
}

