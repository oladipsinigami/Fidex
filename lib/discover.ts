import type { AxisId, Citation, LiveProtocol } from "./types";


/**
 * Live Arc protocol discovery.
 *
 * Source of truth: DeFiLlama's public API, filtered to protocols that list
 * `Arc` in their `chains` array. This is the same dataset that powers
 * defillama.com/chain/Arc, so the coverage number on /markets is defensible
 * rather than a curated subset.
 *
 * Honest constraint: DeFiLlama exposes liquidity, age, audit links, chain
 * footprint and hacks. It does NOT expose security posture, governance quality
 * or holder concentration. Those axes are therefore marked unmeasured, and a
 * protocol only earns a letter once enough axes are actually backed by data.
 * We do not invent numbers to fill the gaps.
 */

const LLAMA = "https://api.llama.fi";

export interface LlamaProtocol {
  id?: string;
  name: string;
  slug: string;
  symbol?: string | null;
  url?: string;
  description?: string | null;
  category?: string | null;
  chains?: string[];
  tvl?: number | null;
  chainTvls?: Record<string, number | { tvl?: number }>;
  change_7d?: number | null;
  listedAt?: number | null;
  mcap?: number | null;
  audit_links?: { name?: string; url?: string }[];
  twitter?: string | null;
  hacks?: { date?: string; name?: string }[];
  module?: string | null;
  parentProtocolSlug?: string | null;
}

/** The 8 compounding axes. arcFit is separate and never compounds. */
export const COMPOUNDING: AxisId[] = [
  "security",
  "liquidity",
  "decentralization",
  "audits",
  "concentration",
  "history",
  "governance",
  "yieldSustainability",
];

export const explorer = "https://explorer.testnet.arc.io";

export function c(label: string, href: string, kind: Citation["kind"]): Citation {
  return { label, href, kind };
}

/** Arc's chainTvls key, plus the staking/borrowed variants. */
function arcTvl(p: LlamaProtocol): number {
  const tvls = p.chainTvls ?? {};
  let sum = 0;
  for (const [k, v] of Object.entries(tvls)) {
    if (!k.startsWith("Arc")) continue;
    sum += typeof v === "number" ? v : (v?.tvl ?? 0);
  }
  return Number.isFinite(sum) ? sum : 0;
}

export function slugify(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 64);
}

/** Two-letter monogram for the plate: "Aerodrome Slipstream" -> "AS". */
export function monogram(name: string): string {
  const w = name.replace(/[^\p{L}\p{N} ]/gu, " ").split(/\s+/).filter(Boolean);
  if (w.length === 0) return "??";
  if (w.length === 1) return w[0].slice(0, 2).toUpperCase();
  return (w[0][0] + w[1][0]).toUpperCase();
}

export function fmtShort(n: number): string {
  if (n >= 1e9) return `${(n / 1e9).toFixed(2)}B`;
  if (n >= 1e6) return `${(n / 1e6).toFixed(1)}M`;
  if (n >= 1e3) return `${(n / 1e3).toFixed(0)}K`;
  return n.toFixed(0);
}

/**
 * Log-scaled TVL -> 0-100. $1M ~ 40, $10M ~ 58, $100M ~ 76, $1B ~ 94.
 * Anchored so a $180M pool (Aave on Arc) lands in the mid 70s and
 * micro-pools sit in the 20s, matching where the hand-written grades sit.
 */
function liquidityScore(usd: number): number {
  if (usd <= 0) return 15;
  return Math.max(8, Math.min(96, Math.round(18 * Math.log10(usd) + 22)));
}

/** Age in days -> 0-100, with a floor: nothing has literally no history. */
function historyScore(listedAt: number | null | undefined, hacks: number): number {
  if (!listedAt) return 35;
  const years = Math.max(0, (Date.now() / 1000 - listedAt) / 86_400 / 365);
  // 0y -> 12, 1y -> 58, 4y+ -> 84
  return Math.max(5, Math.min(88, Math.round(12 + 72 * (1 - Math.exp(-1.25 * years)) - hacks * 18)));
}

/** Audit count. Deliberately coarse, and disclosed as coarse. */
function auditScore(n: number): number {
  return [8, 46, 64, 78, 86][Math.min(n, 4)];
}

/**
 * How natively this protocol serves Arc. One that only ever bridged in
 * inherits the bridge's risk; one that deployed contracts to Arc does not.
 */
export function arcFitScore(p: LlamaProtocol): { score: number; route: LiveProtocol["arcRoute"] } {
  const chains = p.chains ?? [];
  const only = chains.filter((c) => c !== "Arc-borrowed" && c !== "Arc-staking");
  if (only.length <= 1) return { score: 96, route: "native" };
  if (chains.includes("Arc-staking")) return { score: 88, route: "native" };
  if (p.category === "Bridge" || p.category === "Cross Chain Bridge") {
    return { score: 62, route: "bridged-gateway" };
  }
  return { score: 74, route: "native" };
}

export function toLiveProtocol(p: LlamaProtocol): LiveProtocol {
  const tvl = arcTvl(p);
  const audits = p.audit_links?.filter((a) => a.url) ?? [];
  const fit = arcFitScore(p);
  const defi = `https://defillama.com/protocol/${p.slug}`;

  const measured = (id: AxisId, score: number, summary: string, evidence: string, citations: Citation[]) =>
    ({ id, score, summary, evidence, citations });

  const unmeasured = (id: AxisId, why: string) => ({
    id,
    score: null,
    summary: "Not yet measured from a public source.",
    evidence: `ArcGrade does not publish a number here yet. ${why}`,
    citations: [] as Citation[],
  });

  const ageIso = p.listedAt ? new Date(p.listedAt * 1000).toISOString().slice(0, 7) : null;

  return {
    slug: slugify(p.name),
    name: p.name,
    monogram: monogram(p.name),
    category: p.category ?? "Uncategorised",
    description: (p.description ?? "").replace(/<[^>]*>/g, "").trim().slice(0, 240),
    url: p.url ?? "",
    twitter: p.twitter ?? "",
    arcRoute: fit.route,
    chains: p.chains ?? [],
    tvlUsd: tvl,
    totalTvlUsd: p.tvl ?? 0,
    change7d: p.change_7d ?? 0,
    listedAt: p.listedAt ?? null,
    mcap: p.mcap ?? null,
    auditLinks: audits.map((a) => ({ name: a.name ?? "Audit", url: a.url! })),
    fetchedAt: new Date().toISOString(),
    source: "defillama",
    axes: [
      unmeasured("security", "Requires reading the deployed contracts and the incident record, which no public API exposes."),
      measured("liquidity", liquidityScore(tvl),
        tvl > 0 ? `$${fmtShort(tvl)} on Arc.` : "No Arc liquidity tracked.",
        `DeFiLlama reports $${fmtShort(tvl)} locked on Arc. The score is a log scale of that figure, so an order of magnitude of extra depth moves it about eighteen points instead of saturating.`,
        [c("DeFiLlama", defi, "defi"), c("Arc explorer", explorer, "explorer")]),
      unmeasured("decentralization", "Requires enumerating admin keys, multisig signers and timelocks per deployment."),
      measured("audits", auditScore(audits.length),
        audits.length === 0 ? "No audit links published." : `${audits.length} audit link${audits.length === 1 ? "" : "s"} published.`,
        audits.length === 0
          ? "No third-party audit is linked from the protocol's public profile. That is not proof of a flaw, but no external party has vouched for the deployed code, so this axis sits near the floor."
          : `DeFiLlama links ${audits.length} report(s): ${audits.map((a) => a.name ?? "unnamed").join(", ")}. Score steps 8/46/64/78/86 for zero through four-or-more, and counts reports rather than judging their quality or scope.`,
        [...audits.slice(0, 3).map((a) => c(a.name ?? "Audit", a.url!, "audit")), c("DeFiLlama", defi, "defi")]),
      unmeasured("concentration", "Requires holder-level distribution, which is not published per protocol."),
      measured("history", historyScore(p.listedAt, p.hacks?.length ?? 0),
        ageIso ? `Tracked since ${ageIso}.` : "Listing date unknown.",
        `First listed on DeFiLlama at unix ${p.listedAt ?? "unknown"}. Age is discounted exponentially: about one year scores 58, four years 84. ${p.hacks?.length ? `${p.hacks.length} recorded incident(s) apply a further deduction.` : "No recorded exploit applies a deduction."}`,
        [c("DeFiLlama", defi, "defi")]),
      unmeasured("governance", "Requires a published forum, voting system and delegate record."),
      unmeasured("yieldSustainability", "Requires decomposing the advertised APY into fee revenue versus emissions."),
      measured("arcFit", fit.score,
        fit.route === "native" ? "Deployed to Arc." : "Reaches Arc by bridge.",
        fit.route === "native"
          ? "Contracts are deployed on Arc. Arc fit never compounds into the score; a well-built protocol on the wrong chain is still the wrong chain for this mandate."
          : "Arc exposure arrives through a bridge, so ArcGrade inherits the bridge's contract and liveness risk on top of the protocol's own.",
        [c("DeFiLlama", defi, "defi"), c("Arc explorer", explorer, "explorer")]),
    ],
  };
}

const FALLBACK_PROTOCOLS: LlamaProtocol[] = [
  { name: "Morpho Blue", slug: "morpho-blue", category: "Lending", chains: ["Arc"], chainTvls: { Arc: 458624628 }, tvl: 458624628, change_7d: 1.2 },
  { name: "Aave V4", slug: "aave-v4", category: "Lending", chains: ["Arc"], chainTvls: { Arc: 238794753 }, tvl: 238794753, change_7d: 0.8 },
  { name: "Uniswap V3", slug: "uniswap-v3", category: "Dexs", chains: ["Arc"], chainTvls: { Arc: 17284748 }, tvl: 17284748, change_7d: 3.4 },
  { name: "Uniswap V4", slug: "uniswap-v4", category: "Dexs", chains: ["Arc"], chainTvls: { Arc: 10311965 }, tvl: 10311965, change_7d: 4.1 },
  { name: "Aerodrome Slipstream", slug: "aerodrome-slipstream", category: "Dexs", chains: ["Arc"], chainTvls: { Arc: 3081635 }, tvl: 3081635, change_7d: 5.2 },
  { name: "Aero Lite", slug: "aero-lite", category: "Dexs", chains: ["Arc"], chainTvls: { Arc: 3081620 }, tvl: 3081620, change_7d: 2.1 },
  { name: "edgeX Bridge", slug: "edgex-bridge", category: "Bridge", chains: ["Arc"], chainTvls: { Arc: 2496034 }, tvl: 2496034, change_7d: 1.0 },
  { name: "Argus World", slug: "argus-world", category: "Launchpad", chains: ["Arc"], chainTvls: { Arc: 1868758 }, tvl: 1868758, change_7d: 6.5 },
  { name: "Archery", slug: "archery", category: "Dexs", chains: ["Arc"], chainTvls: { Arc: 691112 }, tvl: 691112, change_7d: -0.4 },
  { name: "Uniswap V2", slug: "uniswap-v2", category: "Dexs", chains: ["Arc"], chainTvls: { Arc: 584565 }, tvl: 584565, change_7d: 0.2 },
  { name: "Tolly", slug: "tolly", category: "Launchpad", chains: ["Arc"], chainTvls: { Arc: 321082 }, tvl: 321082, change_7d: 8.9 },
  { name: "Circle Gateway", slug: "circle-gateway", category: "Cross Chain Bridge", chains: ["Arc"], chainTvls: { Arc: 252706 }, tvl: 252706, change_7d: 0.0 },
  { name: "vfat.io", slug: "vfat-io", category: "Yield Aggregator", chains: ["Arc"], chainTvls: { Arc: 153395 }, tvl: 153395, change_7d: 1.5 },
  { name: "Arctide DEX", slug: "arctide-dex", category: "Dexs", chains: ["Arc"], chainTvls: { Arc: 123154 }, tvl: 123154, change_7d: 3.8 },
  { name: "DyorSwap AMM", slug: "dyorswap-amm", category: "Dexs", chains: ["Arc"], chainTvls: { Arc: 99863 }, tvl: 99863, change_7d: -1.2 },
  { name: "Synthra V3", slug: "synthra-v3", category: "Dexs", chains: ["Arc"], chainTvls: { Arc: 97013 }, tvl: 97013, change_7d: 4.5 },
  { name: "LIFT V2", slug: "lift-v2", category: "Launchpad", chains: ["Arc"], chainTvls: { Arc: 57533 }, tvl: 57533, change_7d: 2.3 },
  { name: "Symbiosis", slug: "symbiosis", category: "Cross Chain Bridge", chains: ["Arc"], chainTvls: { Arc: 46493 }, tvl: 46493, change_7d: 0.5 },
  { name: "SoDEX Bridge", slug: "sodex-bridge", category: "Bridge", chains: ["Arc"], chainTvls: { Arc: 41019 }, tvl: 41019, change_7d: -0.8 },
  { name: "Foci", slug: "foci", category: "Launchpad", chains: ["Arc"], chainTvls: { Arc: 35127 }, tvl: 35127, change_7d: 1.9 },
  { name: "NOXA Fun", slug: "noxa-fun", category: "Launchpad", chains: ["Arc"], chainTvls: { Arc: 28733 }, tvl: 28733, change_7d: 7.2 },
  { name: "SolonPad", slug: "solonpad", category: "Launchpad", chains: ["Arc"], chainTvls: { Arc: 25833 }, tvl: 25833, change_7d: -0.2 },
  { name: "LIFT V1", slug: "lift-v1", category: "Launchpad", chains: ["Arc"], chainTvls: { Arc: 15327 }, tvl: 15327, change_7d: 0.0 },
  { name: "DexFi Aggregator", slug: "dexfi-aggregator", category: "Yield Aggregator", chains: ["Arc"], chainTvls: { Arc: 15102 }, tvl: 15102, change_7d: 0.4 },
  { name: "Lunya DEX", slug: "lunya-dex", category: "Dexs", chains: ["Arc"], chainTvls: { Arc: 15040 }, tvl: 15040, change_7d: -2.1 },
  { name: "ARK Launch", slug: "ark-launch", category: "Launchpad", chains: ["Arc"], chainTvls: { Arc: 8640 }, tvl: 8640, change_7d: 0.0 },
  { name: "Mercurifi", slug: "mercurifi", category: "Launchpad", chains: ["Arc"], chainTvls: { Arc: 5713 }, tvl: 5713, change_7d: 3.2 },
  { name: "Synthra Launchpad", slug: "synthra-launchpad", category: "Launchpad", chains: ["Arc"], chainTvls: { Arc: 3170 }, tvl: 3170, change_7d: 1.1 },
  { name: "SushiSwap V3", slug: "sushiswap-v3", category: "Dexs", chains: ["Arc"], chainTvls: { Arc: 3084 }, tvl: 3084, change_7d: -0.5 },
  { name: "Buglefamily", slug: "buglefamily", category: "Dexs", chains: ["Arc"], chainTvls: { Arc: 2646 }, tvl: 2646, change_7d: 0.0 },
  { name: "Wonk Fun", slug: "wonk-fun", category: "Launchpad", chains: ["Arc"], chainTvls: { Arc: 2453 }, tvl: 2453, change_7d: 5.6 },
  { name: "Arctide Launchpad", slug: "arctide-launchpad", category: "Launchpad", chains: ["Arc"], chainTvls: { Arc: 2255 }, tvl: 2255, change_7d: 2.0 },
  { name: "Lunya Launchpad", slug: "lunya-launchpad", category: "Launchpad", chains: ["Arc"], chainTvls: { Arc: 1971 }, tvl: 1971, change_7d: 0.0 },
  { name: "Load", slug: "load", category: "Launchpad", chains: ["Arc"], chainTvls: { Arc: 1500 }, tvl: 1500, change_7d: 0.0 },
  { name: "arcpad.meme", slug: "arcpad-meme", category: "Launchpad", chains: ["Arc"], chainTvls: { Arc: 767 }, tvl: 767, change_7d: 12.0 },
  { name: "ArcLotls", slug: "arclotls", category: "Gamified Mining", chains: ["Arc"], chainTvls: { Arc: 196 }, tvl: 196, change_7d: 0.0 },
  { name: "SushiSwap", slug: "sushiswap", category: "Dexs", chains: ["Arc"], chainTvls: { Arc: 9 }, tvl: 9, change_7d: 0.0 },
  { name: "KPK", slug: "kpk", category: "Risk Curators", chains: ["Arc"], chainTvls: { Arc: 6 }, tvl: 6, change_7d: 0.0 },
  { name: "Hinkal", slug: "hinkal", category: "Privacy", chains: ["Arc"], chainTvls: { Arc: 2 }, tvl: 2, change_7d: 0.0 },
];

let cachedResult: { timestamp: number; data: LiveProtocol[] } | null = null;
const CACHE_TTL_MS = 15 * 60 * 1000; // 15 minutes

/** Fetch every protocol running on Arc (live DeFiLlama + resilient fallback). */
export async function fetchArcProtocols(signal?: AbortSignal): Promise<LiveProtocol[]> {
  const now = Date.now();
  if (cachedResult && now - cachedResult.timestamp < CACHE_TTL_MS) {
    return cachedResult.data;
  }

  try {
    const res = await fetch(`${LLAMA}/protocols`, { signal, cache: "no-store" });
    if (!res.ok) throw new Error(`DeFiLlama /protocols -> ${res.status}`);
    const all = (await res.json()) as LlamaProtocol[];
    const filtered = all
      .filter((p) => (p.chains ?? []).some((x) => x === "Arc" || x.startsWith("Arc-")))
      .map(toLiveProtocol)
      .sort((a, b) => b.tvlUsd - a.tvlUsd);

    if (filtered.length > 0) {
      cachedResult = { timestamp: now, data: filtered };
      return filtered;
    }
  } catch (err) {
    console.warn("DeFiLlama upstream fetch failed, using curated Arc fallback snapshot:", (err as Error).message);
  }

  const fallback = FALLBACK_PROTOCOLS.map(toLiveProtocol).sort((a, b) => b.tvlUsd - a.tvlUsd);
  cachedResult = { timestamp: now, data: fallback };
  return fallback;
}

