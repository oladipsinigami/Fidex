import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { notFound } from "next/navigation";
import { cookies } from "next/headers";
import type { LiveProtocol, Protocol } from "@/lib/types";
import { getProtocol, PROTOCOLS } from "@/data/protocols";
import { StaleChip } from "@/components/RatingPlate";
import { AxisRow, LockedAxes } from "@/components/Axis";
import { Paywall } from "@/components/Paywall";
import { DecisionCard } from "@/components/DecisionCard";
import { AgentSnippet } from "@/components/AgentSnippet";
import { ageLabel, formatUsd, isStale, toneFor } from "@/lib/grade";
import { enrichProtocolWithDb } from "@/lib/db";
import { COOKIE, LEGACY_COOKIE, unlocks, verifyReceipt } from "@/lib/unlock";
import { fetchArcProtocols, fmtShort } from "@/lib/discover";
import { screen } from "@/lib/screen";
import { WalletGate } from "@/components/WalletGate";
import { CropMark } from "@/components/CropMark";

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
        title: `${p.name} rates ${p.letter} · ${p.score}/100 on Fidex`,
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
  const rawP = getProtocol(slug);
  if (!rawP) {
    const liveList = await fetchArcProtocols().catch(() => []);
    const live = liveList.find((x) => x.slug === slug);
    if (!live) notFound();
    return <LiveProtocolView p={live} />;
  }
  const p = await enrichProtocolWithDb(rawP);

  const jar = await cookies();
  const paid = unlocks(verifyReceipt(jar.get(COOKIE)?.value ?? jar.get(LEGACY_COOKIE)?.value), p.slug);
  const stale = isStale(p);
  const tone = toneFor(p.letter);
  const seen = new Set<string>();
  const related = p.related
    .filter((s) => (seen.has(s) ? false : (seen.add(s), true)))
    .map((s) => PROTOCOLS.find((x) => x.slug === s))
    .filter((x): x is NonNullable<typeof x> => Boolean(x));

  return (
    <article className="lookbook min-h-screen relative">
      <Header p={p} />
      <WalletGate protocolName={p.name} category={p.category}>
        <Hero p={p} paid={paid} stale={stale} tone={tone} />
        <Axes p={p} paid={paid} />
        {paid && <KillShots p={p} />}
        <section className="mx-auto max-w-[1320px] px-6 py-10">
          <div className="grid gap-8 lg:grid-cols-2">
            {paid && <DecisionCard protocol={p} />}
            <AgentSnippet
              snippet={{
                slug: p.slug,
                letter: p.letter,
                score: p.score,
                contentHash: p.contentHash,
                methodologyVersion: p.methodologyVersion,
              }}
              paid={paid}
            />
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
    <div className="border-b border-[var(--line)] bg-[var(--panel-subtle)]">
      <div className="mx-auto max-w-[1320px] px-6 py-6">
        <nav className="flex flex-wrap items-center gap-2 font-mono text-xs text-[var(--mute)]">
          <Link href="/markets" className="hover:text-[var(--ink)]">MARKETS</Link>
          <span>/</span>
          <span className="uppercase">{p.category}</span>
          <span>/</span>
          <span className="uppercase text-[var(--ink)] font-bold">{p.name}</span>
        </nav>
        <div className="mt-4 flex flex-wrap items-center gap-4">
          <StaleChip updatedAt={p.updatedAt} />
          <span className="font-mono text-xs uppercase text-[var(--mute)]">
            ARC ROUTE:{" "}
            {p.arcRoute === "native" ? "NATIVE ON ARC" : `BRIDGED (${p.arcRoute.replace("bridged-", "").toUpperCase()})`}
          </span>
        </div>

        {p.slug === "emberyield-farm" && (
          <div className="mt-6 rounded-[2px] border border-red-500/40 bg-red-500/10 p-4 font-mono text-xs text-[var(--ink)]">
            <div className="flex items-center gap-2 text-red-500 font-bold uppercase tracking-wider">
              <span>⚠️ Simulated Benchmark Threat Model</span>
              <span className="opacity-40">&middot;</span>
              <span>Not a Live Vault</span>
            </div>
            <p className="mt-1 text-xs opacity-80 leading-relaxed font-sans">
              EmberYield Farm is a synthetic threat-model reference asset maintained to verify that Fidex compounding algorithms immediately detect and mathematically penalize unsustainable emissions-funded yields down to Grade F.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

/** Left 7 / right 5. Minted Ingot Plate, verdict, brutalist paywall. */
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
    <section className="mx-auto max-w-[1320px] px-6 py-12 sm:py-16">
      <div className="grid gap-12 lg:grid-cols-12 items-start">
        <div className="lg:col-span-7">
          <div className="relative border border-[var(--line)] bg-[var(--panel-subtle)] p-6 sm:p-10">
            <CropMark corner="tl" size={20} />
            <CropMark corner="br" size={20} />

            <div className="flex flex-col sm:flex-row items-center gap-8">
              <div className="dossier-ingot-wrap shrink-0">
                <Image
                  src="/plates/ingot-a.jpg"
                  alt={`Fidex Minted Plate ${p.letter}`}
                  className="dossier-ingot-img"
                  width={380}
                  height={380}
                  priority
                />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-3">
                  <span className={`grade-badge-solid grade-badge-solid--${p.letter}`}>
                    {p.letter}
                  </span>
                  <span className="font-mono text-xs tracking-wider uppercase text-[var(--mute)]">
                    {tone.label} &middot; {p.category}
                  </span>
                </div>
                <div className="mt-4 flex items-baseline gap-2">
                  <span className="font-mono text-4xl sm:text-5xl font-bold text-[var(--ink)]">
                    {p.score}
                  </span>
                  <span className="font-mono text-xs text-[var(--mute)] tracking-wider">/100 COMPOSITE SCORE</span>
                </div>
                <p className="mt-4 font-mono text-[11px] text-[var(--mute)] break-all border-t border-[var(--line)] pt-3">
                  ATTESTATION: {p.contentHash}
                </p>
              </div>
            </div>

            <div className="relative mt-8 grid gap-4 border-t border-[var(--line)] pt-6 grid-cols-2 sm:grid-cols-4">
              <Cell label="AS OF" value={ageLabel(p.updatedAt)} warn={stale} />
              <Cell label="METHOD" value={p.methodologyVersion} mono small />
              <Cell label="TVL" value={formatUsd(p.tvlUsd)} />
              <Cell label="ANALYST" value={p.analystId} mono small />
            </div>
          </div>

          <p className="mt-5 text-[11px] leading-relaxed text-[var(--mute)] font-mono">
            Letter is not a prediction of price. It is a structured read of how this
            thing can fail. Not financial advice, not a credit rating.
          </p>
        </div>

        <div className="lg:col-span-5 flex flex-col justify-between">
          <div>
            <span className="text-[10px] font-mono uppercase tracking-[0.2em] text-[var(--mute)]">
              PROTOCOL DOSSIER / SPECIMEN
            </span>
            <h1 className="mt-2 font-campaign text-4xl sm:text-5xl font-bold uppercase tracking-tight text-[var(--ink)]">
              {p.name}
            </h1>
            <p className="mt-4 text-base leading-relaxed text-[var(--mute)]">
              {paid ? p.dossierVerdict : p.verdict}
            </p>

            <div className="mt-8 space-y-3 border-t border-[var(--line)] pt-6 text-[13px]">
              <Row k="Chain focus" v={p.chainFocus} />
              <Row k="Yield note" v={p.yieldNote} />
              <Row k="7d change" v={`${p.delta7d >= 0 ? "+" : ""}${p.delta7d}`} signed />
            </div>
          </div>

          <div data-walkthrough="paywall-box" className="mt-8">
            {paid ? (
              <div className="brutalist-paywall-card text-center">
                <p className="font-mono text-xs uppercase tracking-wider text-[var(--ink)] font-bold">
                  ✓ Dossier Unlocked · Valid 24h on this device
                </p>
              </div>
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
    <section data-walkthrough="axes-breakdown" className="mx-auto max-w-[1320px] px-6 py-12 border-t border-[var(--line)]">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <span className="text-[10px] font-mono uppercase tracking-[0.2em] text-[var(--mute)]">
            PRIMARY METRICS
          </span>
          <h2 className="mt-1 font-campaign text-3xl sm:text-4xl font-bold uppercase tracking-tight text-[var(--ink)]">
            Nine axes
          </h2>
        </div>
        <p className="font-mono text-xs uppercase text-[var(--mute)]">Weights shown &middot; method {p.methodologyVersion}</p>
      </div>
      <div className="my-6 border-b border-[var(--line)]" />
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
    <section data-walkthrough="killshots" className="mx-auto max-w-[1320px] px-6 py-12 border-t border-[var(--line)]">
      <h2 className="font-campaign text-3xl sm:text-4xl font-bold uppercase tracking-tight text-[var(--ink)]">
        What breaks this grade
      </h2>
      <div className="my-6 border-b border-[var(--line)]" />
      <ul className="grid gap-4 md:grid-cols-3">
        {p.killShots.map((k) => (
          <li key={k.title} className="relative border border-[var(--line)] bg-[var(--panel-subtle)] p-6">
            <CropMark corner="tl" size={14} />
            <p className="font-mono text-[10px] uppercase tracking-widest text-[#a63a3a] font-bold">Kill shot</p>
            <h3 className="mt-3 font-campaign text-xl font-bold uppercase text-[var(--ink)]">{k.title}</h3>
            <p className="mt-2.5 text-[13px] leading-relaxed text-[var(--mute)]">{k.detail}</p>
            <p className="font-mono text-[11px] mt-4 text-[var(--mute)] uppercase">Most exposed: {k.axis}</p>
          </li>
        ))}
      </ul>
    </section>
  );
}

function UnlockTable({ p }: { p: Protocol }) {
  return (
    <section className="mx-auto max-w-[1320px] px-6 py-12 border-t border-[var(--line)]">
      <h2 className="font-campaign text-3xl sm:text-4xl font-bold uppercase tracking-tight text-[var(--ink)]">
        Unlock calendar
      </h2>
      <div className="my-6 border-b border-[var(--line)]" />
      <div className="overflow-x-auto">
        <table className="specimen-table">
          <thead>
            <tr>
              <th>Date</th>
              <th>Amount</th>
              <th>% of float</th>
              <th>Note</th>
            </tr>
          </thead>
          <tbody>
            {p.unlocks.map((u) => (
              <tr key={u.date + u.amount}>
                <td className="font-mono text-xs">{u.date}</td>
                <td className="font-mono text-xs">{u.amount}</td>
                <td className="font-mono text-xs font-bold text-[var(--gold)]">{u.pctOfFloat}%</td>
                <td className="text-[var(--mute)]">{u.note}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function Related({ related }: { related: Protocol[] }) {
  return (
    <section className="mx-auto max-w-[1320px] px-6 py-16 border-t border-[var(--line)]">
      <h2 className="font-campaign text-2xl sm:text-3xl font-bold uppercase tracking-tight text-[var(--ink)]">
        Related markets
      </h2>
      <div className="my-6 border-b border-[var(--line)]" />
      <ul className="grid gap-4 sm:grid-cols-2">
        {related.map((r) => (
          <li key={r.slug} className="border border-[var(--line)] bg-[var(--panel-subtle)] hover:border-[var(--line-strong)] transition-all">
            <Link href={`/p/${r.slug}`} className="flex items-center gap-5 p-6 text-[var(--ink)] no-underline">
              <span className={`grade-badge-solid grade-badge-solid--${r.letter}`}>
                {r.letter}
              </span>
              <div className="min-w-0">
                <p className="font-campaign text-lg uppercase font-bold text-[var(--ink)]">{r.name}</p>
                <p className="font-mono text-[10px] uppercase text-[var(--mute)] tracking-wider mt-0.5">{r.category}</p>
                <p className="mt-1 line-clamp-1 text-[12px] text-[var(--mute)]">{r.verdict}</p>
              </div>
              <span className="font-mono text-sm ml-auto text-[var(--mute)] font-bold">{r.score}</span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

function Disclaimer({ p }: { p: Protocol }) {
  return (
    <div className="mx-auto max-w-[1320px] px-6 pb-16">
      <p className="border-t border-[var(--line)] pt-6 font-mono text-[11px] leading-relaxed text-[var(--mute)]">
        Fidex is not financial advice and not a credit rating. It publishes a
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
      <p className="font-mono text-[10px] uppercase tracking-wider text-[var(--mute)]">{label}</p>
      <p
        className={`mt-1.5 truncate ${mono ? "font-mono" : ""} ${
          small ? "text-[11px]" : "text-[13px]"
        } ${warn ? "text-[#a63a3a] font-bold" : "text-[var(--ink)]"}`}
      >
        {value}
      </p>
    </div>
  );
}

function Row({ k, v, signed }: { k: string; v: string; signed?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-4">
      <span className="font-mono text-xs uppercase text-[var(--mute)]">{k}</span>
      <span
        className={`text-right text-[13px] ${signed ? "font-mono" : ""} ${
          signed ? (v.startsWith("-") ? "text-[#a63a3a]" : "text-[#3b7a57]") : "text-[var(--ink)]"
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
    <article className="lookbook min-h-screen relative">
      <div className="border-b border-[var(--line)] bg-[var(--panel-subtle)]">
        <div className="mx-auto max-w-[1320px] px-6 py-6">
          <nav className="flex flex-wrap items-center gap-2 font-mono text-xs text-[var(--mute)]">
            <Link href="/markets" className="hover:text-[var(--ink)]">MARKETS</Link>
            <span>/</span>
            <Link href="/arc" className="hover:text-[var(--ink)]">LIVE UNIVERSE</Link>
            <span>/</span>
            <span className="uppercase">{p.category}</span>
            <span>/</span>
            <span className="uppercase text-[var(--ink)] font-bold">{p.name}</span>
          </nav>
          <div className="mt-4 flex flex-wrap items-center gap-4">
            <span className="font-mono text-xs border border-[var(--gold)]/30 bg-[var(--gold)]/10 px-2 py-0.5 text-[var(--gold)]">
              LIVE SCREENED (DEFILLAMA FEED)
            </span>
            <span className="font-mono text-xs text-[var(--mute)]">
              ARC ROUTE: {p.arcRoute === "native" ? "NATIVE ON ARC" : "BRIDGED TO ARC"}
            </span>
            <span className="font-mono text-xs text-[var(--mute)]">
              CHAINS: {p.chains.join(", ").toUpperCase()}
            </span>
          </div>
        </div>
      </div>

      <WalletGate protocolName={p.name} category={p.category}>
        <section className="mx-auto max-w-[1320px] px-6 py-12 sm:py-16">
          <div className="grid gap-12 lg:grid-cols-12 items-start">
            <div className="lg:col-span-7">
              <div className="relative border border-[var(--line)] bg-[var(--panel-subtle)] p-6 sm:p-10">
                <CropMark corner="tl" size={20} />
                <CropMark corner="br" size={20} />

                <div className="flex flex-wrap items-center justify-between gap-6">
                  <div>
                    <span className="font-mono text-[10px] uppercase tracking-widest text-[var(--gold)]">Ecosystem Protocol</span>
                    <h1 className="mt-2 font-campaign text-4xl sm:text-5xl font-bold uppercase tracking-tight text-[var(--ink)]">{p.name}</h1>
                    <p className="font-mono text-xs mt-2 text-[var(--mute)] uppercase">
                      {p.category} &middot; {p.arcRoute === "native" ? "Native Deployment" : "Cross-Chain"}
                    </p>
                  </div>
                  {scr.letter ? (
                    <div className="text-right">
                      <span className={`grade-badge-solid grade-badge-solid--${scr.letter} text-3xl px-4 py-2`}>
                        {scr.letter}
                      </span>
                      <p className="font-mono text-[10px] uppercase tracking-widest mt-2 text-[var(--gold)]">Screening Letter</p>
                    </div>
                  ) : (
                    <div className="border border-[var(--line)] bg-[var(--panel)] px-4 py-3 text-center">
                      <p className="font-mono text-xl text-[var(--ink)] font-bold">{coveragePct}%</p>
                      <p className="font-mono text-[10px] uppercase tracking-widest mt-1 text-[var(--mute)]">Measured Weight</p>
                    </div>
                  )}
                </div>

                <p className="mt-6 text-[14px] leading-relaxed text-[var(--mute)]">
                  {p.description || "Protocol operating on Circle Arc, discovered through public on-chain intelligence."}
                </p>

                <div className="my-6 border-b border-[var(--line)]" />

                <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                  <div>
                    <p className="font-mono text-[10px] uppercase text-[var(--mute)]">Arc TVL</p>
                    <p className="font-mono text-base font-bold text-[var(--gold)] mt-1">${fmtShort(p.tvlUsd)}</p>
                  </div>
                  <div>
                    <p className="font-mono text-[10px] uppercase text-[var(--mute)]">Total TVL</p>
                    <p className="font-mono text-base font-bold text-[var(--ink)] mt-1">${fmtShort(p.totalTvlUsd)}</p>
                  </div>
                  <div>
                    <p className="font-mono text-[10px] uppercase text-[var(--mute)]">7d Change</p>
                    <p className={`font-mono text-base font-bold mt-1 ${p.change7d >= 0 ? "text-[#3b7a57]" : "text-[#a63a3a]"}`}>
                      {p.change7d >= 0 ? "+" : ""}{p.change7d.toFixed(1)}%
                    </p>
                  </div>
                  <div>
                    <p className="font-mono text-[10px] uppercase text-[var(--mute)]">Audits Listed</p>
                    <p className="font-mono text-base font-bold text-[var(--ink)] mt-1">{p.auditLinks.length}</p>
                  </div>
                </div>

                {p.url && (
                  <div className="mt-6 flex flex-wrap gap-4 pt-2">
                    <a href={p.url} target="_blank" rel="noopener noreferrer" className="font-mono text-xs text-[var(--gold)] hover:underline uppercase">
                      Official Website &rarr;
                    </a>
                    {p.twitter && (
                      <a href={`https://twitter.com/${p.twitter}`} target="_blank" rel="noopener noreferrer" className="font-mono text-xs text-[var(--gold)] hover:underline uppercase">
                        Twitter / X &rarr;
                      </a>
                    )}
                    <a href={`https://defillama.com/protocol/${p.slug}`} target="_blank" rel="noopener noreferrer" className="font-mono text-xs text-[var(--gold)] hover:underline uppercase">
                      DeFiLlama &rarr;
                    </a>
                  </div>
                )}
              </div>
            </div>

            <div className="lg:col-span-5">
              <div className="brutalist-paywall-card">
                <h3 className="font-campaign text-xl font-bold uppercase text-[var(--ink)]">Screening Coverage</h3>
                <p className="mt-2 text-[13px] leading-relaxed text-[var(--mute)]">
                  Fidex requires at least 60% of compounding axis weight before publishing a formal letter. This protocol currently has {scr.measuredCount} of 8 compounding axes backed by public telemetry.
                </p>
                <div className="mt-5">
                  <div className="flex justify-between font-mono text-[11px] text-[var(--mute)]">
                    <span>Coverage</span>
                    <span>{coveragePct}% / 60% threshold</span>
                  </div>
                  <div className="mt-1.5 h-2 w-full overflow-hidden bg-[var(--line)]">
                    <div className="h-full bg-[var(--gold)] transition-all" style={{ width: `${Math.min(100, coveragePct)}%` }} />
                  </div>
                </div>

                <div className="my-6 border-b border-[var(--line)]" />

                <h4 className="font-mono text-xs uppercase tracking-wider text-[var(--mute)]">Analyst Action</h4>
                <p className="mt-2 text-[12px] leading-relaxed text-[var(--mute)]">
                  To move this protocol from automated screening to an official rating with full evidence, kill shots, and unlock schedules, request an analyst review in Studio.
                </p>
                <Link href="/studio" className="font-mono text-xs font-bold text-[var(--gold)] hover:underline uppercase mt-4 inline-block">
                  Open Analyst Studio &rarr;
                </Link>
              </div>
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-[1320px] px-6 pb-16">
          <h2 className="font-campaign text-3xl sm:text-4xl font-bold uppercase tracking-tight text-[var(--ink)]">Evaluated & Screened Axes</h2>
          <p className="mt-2 text-[13px] text-[var(--mute)]">
            Axes with verified public data are scored. Unmeasured axes require dedicated human review of deployed bytecodes and admin keys.
          </p>
          <div className="my-6 border-b border-[var(--line)]" />

          <div className="divide-y divide-[var(--line)] border-y border-[var(--line)]">
            {p.axes.map((a) => (
              <div key={a.id} className="py-6">
                <div className="flex flex-wrap items-baseline justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <h3 className="font-campaign text-xl uppercase font-bold text-[var(--ink)]">
                      {a.id.charAt(0).toUpperCase() + a.id.slice(1).replace(/([A-Z])/g, " $1")}
                    </h3>
                    {a.score !== null ? (
                      <span className="font-mono text-[10px] text-[var(--gold)] uppercase border border-[var(--gold)]/30 px-1.5 py-0.5">Measured</span>
                    ) : (
                      <span className="font-mono text-[10px] text-[var(--mute)] uppercase border border-[var(--line)] px-1.5 py-0.5">Pending Analysis</span>
                    )}
                  </div>
                  {a.score !== null && (
                    <span className="font-mono text-sm text-[var(--ink)] font-bold">{a.score}/100</span>
                  )}
                </div>
                <p className="mt-2 text-[13px] leading-relaxed text-[var(--ink)]">{a.summary}</p>
                <p className="mt-1.5 max-w-[70ch] text-[12.5px] leading-relaxed text-[var(--mute)]">{a.evidence}</p>
                {a.citations.length > 0 && (
                  <ul className="mt-3 flex flex-wrap gap-3">
                    {a.citations.map((c) => (
                      <li key={c.href + c.label}>
                        <a href={c.href} target="_blank" rel="noopener noreferrer" className="font-mono text-[10.5px] text-[var(--gold)] uppercase hover:underline">
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
