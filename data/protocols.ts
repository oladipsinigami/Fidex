import type { Protocol } from "@/lib/types";
import { bandFor, compositeOf, computeContentHash, METHODOLOGY_VERSION } from "@/lib/grade";
import { aave } from "./aave";
import { morpho } from "./morpho";
import { uniswap } from "./uniswap";
import { usdc } from "./usdc";
import { usyc } from "./usyc";
import { buidl } from "./buidl";
import { cirbtc } from "./cirbtc";
import { ember } from "./ember";
import { gateway } from "./gateway";
import { arctide } from "./arctide";
import { tolly } from "./tolly";
import { synthra } from "./synthra";
import { eurc } from "./eurc";
import { weth } from "./weth";
import { aerodrome } from "./aerodrome";
import { edgex } from "./edgex";
import { argus } from "./argus";
import { tollyToken } from "./tollyToken";
import { tideToken } from "./tideToken";

export { WEIGHTS, AXIS_ORDER, AXIS_LABEL } from "./axes";
export type { Raw } from "./axes";

/**
 * Score and letter are DERIVED from the axes, never hand-written, so a
 * published letter can never drift from the published model.
 */
export const PROTOCOLS: Protocol[] = [
  aave,
  morpho,
  uniswap,
  usdc,
  gateway,
  eurc,
  usyc,
  buidl,
  cirbtc,
  ember,
  arctide,
  tolly,
  synthra,
  weth,
  aerodrome,
  edgex,
  argus,
  tollyToken,
  tideToken,
].map(
  (p) => {
    const score = compositeOf(p.axes);
    const letter = bandFor(score);
    const contentHash = computeContentHash({
      slug: p.slug,
      score,
      letter,
      dossierVerdict: p.dossierVerdict,
      axes: p.axes,
      killShots: p.killShots,
    });
    return {
      ...p,
      score,
      letter,
      contentHash,
      methodologyVersion: METHODOLOGY_VERSION,
    };
  },
);

const BY_SLUG = new Map(PROTOCOLS.map((p) => [p.slug, p]));

const SLUG_ALIASES: Record<string, string> = {
  aave: "aave-v4-arc",
  "aave-v3": "aave-v4-arc",
  "aave-v4": "aave-v4-arc",
  morpho: "morpho-arc",
  uniswap: "uniswap-arc",
  "uniswap-v4": "uniswap-arc",
  ember: "emberyield-farm",
  "ember-yield": "emberyield-farm",
  gateway: "circle-gateway",
  tolly: "tolly",
  "tolly-finance": "tolly",
  synthra: "synthra-v3",
  "synthra-dex": "synthra-v3",
  aerodrome: "aerodrome-slipstream",
  "aerodrome-arc": "aerodrome-slipstream",
  argus: "argus-world",
  "argus-oracle": "argus-world",
  arctide: "arctide-dex",
  "arctide-vaults": "arctide-dex",
  buidl: "blackrock-buidl",
  usdc: "circle-usdc",
  eurc: "eurc-arc",
  weth: "weth-arc",
};

export function getProtocol(slug: string): Protocol | undefined {
  const clean = slug.trim().toLowerCase();
  return BY_SLUG.get(clean) || BY_SLUG.get(SLUG_ALIASES[clean] || "");
}

export function featuredProtocol(): Protocol {
  return BY_SLUG.get("morpho-arc")!;
}

export function byLetterDesc(): Protocol[] {
  return [...PROTOCOLS].sort((a, b) => b.score - a.score);
}

export const TOTAL_TVL = PROTOCOLS.reduce((s, p) => s + p.tvlUsd, 0);

export const CATEGORIES = Array.from(new Set(PROTOCOLS.map((p) => p.category))).sort();
