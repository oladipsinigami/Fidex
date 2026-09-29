import type { Protocol } from "@/lib/types";

/**
 * Live TVL for the hand-analysed book.
 *
 * WHY THIS EXISTS
 * ---------------
 * `tvlUsd` in data/*.ts is a hardcoded literal. It was never refreshed, so
 * every TVL figure on the site drifted the moment it was typed. Measured
 * against DeFiLlama on 2026-09-29:
 *
 *   circle-gateway    $252.7M shown   vs   $300K live   (-100%)
 *   aave-v4-arc       $412.0M shown   vs   $181.2M live  (-56%)
 *   toll y-token        $3.5M shown   vs   $255K  live   (-93%)
 *   arctide-dex         $123K shown   vs    $70K  live   (-43%)
 *   morpho-arc        $186.0M shown   vs   $299.6M live  (+61%)
 *
 * So a number is displayed, it looks authoritative, and it can be wrong by
 * orders of magnitude. That is the same failure shape as the paywall leak:
 * correct-looking, hollow underneath.
 *
 * WHAT THIS DOES NOT DO
 * ---------------------
 * It never touches `updatedAt`, the letter, or the score. Live TVL is
 * telemetry, not analysis. Nothing in here may advance the freshness clock --
 * `scripts/test-freshness.mjs` enforces that.
 *
 * HONESTY RULES
 * -------------
 * 1. Only slugs in LLAMA_MAP are enriched. Everything else stays a labelled
 *    snapshot. We do not fuzzy-match a name and call it a fact.
 * 2. The map is explicit and reviewable. A wrong entry shows up as a wrong
 *    number, which is worse than a stale one.
 * 3. If DeFiLlama is unreachable we return null and callers fall back to the
 *    static value marked as a snapshot. We never invent a live figure.
 */

const LLAMA = "https://api.llama.fi";

/**
 * Fidex slug -> DeFiLlama slug.
 *
 * Every entry was confirmed against the live DeFiLlama Arc set, not guessed.
 * Deliberately EXCLUDED:
 *   - toll y-token   a token has no protocol-level TVL; the `tolly` entry is
 *                    the launchpad, a different thing with different money.
 *   - circle-usdc / weth-arc / usyc / blackrock-buidl / cirbtc
 *                    not listed as Arc protocols on DeFiLlama.
 *   - uniswap-arc    DeFiLlama tracks V2/V3/V4 separately; picking one would
 *                    be a judgement call about which is the "real" listing.
 *   - emberyield-farm
 *                    synthetic test vector, not a live protocol.
 */
export const LLAMA_MAP: Readonly<Record<string, string>> = Object.freeze({
  "aave-v4-arc": "aave-v4",
  "aerodrome-slipstream": "aerodrome-slipstream",
  "arctide-dex": "arctide-dex",
  "argus-world": "argus-world",
  "edgex-bridge": "edgex-bridge",
  "circle-gateway": "circle-gateway",
  "morpho-arc": "morpho-blue",
  "synthra-v3": "synthra-v3",
  tolly: "tolly",
});

export type Telemetry = {
  tvlUsd: number;
  change7d: number | null;
  /** When this was read, so the UI can say how current it is. */
  fetchedAt: string;
  source: "defillama";
  llamaSlug: string;
};

export type WithTelemetry = Protocol & { telemetry: Telemetry | null };

function arcTvl(p: { chainTvls?: Record<string, unknown> }): number {
  const v = p.chainTvls?.["Arc"];
  return typeof v === "number" ? v : Number((v as { tvl?: number } | undefined)?.tvl ?? 0);
}

let cache: { at: number; bySlug: Map<string, Telemetry> } | null = null;
const TTL_MS = 15 * 60 * 1000; // 15 minutes
const TTL_SECONDS = 900;

/** Live Arc TVL keyed by Fidex slug. Missing entries are simply absent. */
export async function fetchLiveTvl(
  signal?: AbortSignal,
): Promise<Map<string, Telemetry>> {
  const now = Date.now();
  if (cache && now - cache.at < TTL_MS) return cache.bySlug;

  try {
    // `next.revalidate` only. Combining it with `cache: "no-store"` makes
    // Next treat the route as dynamic, which forces /markets to render on
    // every request for an ~8.7MB upstream payload. The in-process TTL below
    // gives plain-node callers the same 15-minute behaviour.
    const res = await fetch(`${LLAMA}/protocols`, {
      signal,
      next: { revalidate: TTL_SECONDS },
    });
    if (!res.ok) throw new Error(`DeFiLlama -> ${res.status}`);
    const all = (await res.json()) as Array<{
      slug: string;
      chains?: string[];
      chainTvls?: Record<string, unknown>;
      change_7d?: number | null;
    }>;
    const byLlamaSlug = new Map(all.map((p) => [p.slug, p]));

    const bySlug = new Map<string, Telemetry>();
    for (const [fidexSlug, llamaSlug] of Object.entries(LLAMA_MAP)) {
      const p = byLlamaSlug.get(llamaSlug);
      if (!p) continue;
      if (!(p.chains ?? []).some((c) => c === "Arc" || c.startsWith("Arc-"))) continue;
      bySlug.set(fidexSlug, {
        tvlUsd: arcTvl(p),
        change7d: typeof p.change_7d === "number" ? p.change_7d : null,
        fetchedAt: new Date().toISOString(),
        source: "defillama",
        llamaSlug,
      });
    }
    cache = { at: now, bySlug };
    return bySlug;
  } catch (err) {
    // Fail to "no telemetry" rather than to a wrong number. Callers fall back
    // to the stored snapshot and label it as such.
    console.warn("[telemetry] DeFiLlama unavailable, showing labelled snapshots:", (err as Error).message);
    return new Map();
  }
}

/**
 * Attach live telemetry where we have a verified mapping; null elsewhere.
 *
 * `protocols` is a required argument rather than a default so this module
 * holds no runtime import of the data layer. That keeps it runnable from a
 * plain node script, where the `@/` path alias does not resolve.
 */
export async function enrichWithTelemetry(
  protocols: Protocol[],
  signal?: AbortSignal,
): Promise<WithTelemetry[]> {
  const live = await fetchLiveTvl(signal);
  return protocols.map((p) => ({ ...p, telemetry: live.get(p.slug) ?? null }));
}

/**
 * True when the stored TVL differs enough from live that the static figure is
 * actively misleading. This is a REVIEW TRIGGER, not a freshness signal: it
 * never changes updatedAt.
 */
export function tvlDriftPct(stored: number, live: number): number {
  if (stored <= 0) return live > 0 ? 100 : 0;
  return ((live - stored) / stored) * 100;
}

export const DRIFT_ALERT_PCT = 25;
