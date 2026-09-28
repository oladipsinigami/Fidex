import { WEIGHTS } from "@/data/axes";
import { bandFor } from "./grade";
import { COMPOUNDING } from "./discover";
import type { AxisId, Letter, LiveProtocol } from "./types";

/**
 * Screening grade for auto-discovered protocols.
 *
 * The full ArcGrade composite is multiplicative across the weakest axis, which
 * is the right behaviour when you have read every axis. A public API gives us
 * three of eight. Renormalising the missing five to "average" would be the same
 * error as a naive mean: it silently assumes the protocol is unremarkable in
 * exactly the dimensions nobody measured.
 *
 * So the rule here is deliberately conservative:
 *   - report coverage as a fraction of compounding WEIGHT that is measured
 *   - never publish a letter below MIN_COVERAGE
 *   - publish the partial reading explicitly labelled as partial
 *
 * A protocol that is spectacular on liquidity and quietly insolvent still
 * looks fine here. That is why this is called screening and not a rating.
 */
export const MIN_COVERAGE = 0.6;

export interface ScreenResult {
  coverage: number;
  /** Axes with a real datum, out of the 8 compounding ones. */
  measuredCount: number;
  /** Weighted mean over measured axes only. Meaningless alone; for display. */
  partialScore: number | null;
  /** null whenever coverage is below MIN_COVERAGE. */
  letter: Letter | null;
  /** Per-axis measurement, for the UI to show what is and isn't known. */
  measured: { id: AxisId; score: number; weight: number }[];
  unmeasured: AxisId[];
}

export function screen(p: LiveProtocol): ScreenResult {
  const byId = new Map(p.axes.map((a) => [a.id, a]));
  const measured: ScreenResult["measured"] = [];
  const unmeasured: AxisId[] = [];

  let coveredWeight = 0;
  let totalWeight = 0;
  let weighted = 0;

  for (const id of COMPOUNDING) {
    const w = WEIGHTS[id as keyof typeof WEIGHTS];
    totalWeight += w;
    const a = byId.get(id);
    if (a && typeof a.score === "number") {
      measured.push({ id, score: a.score, weight: w });
      coveredWeight += w;
      weighted += w * a.score;
    } else {
      unmeasured.push(id);
    }
  }

  const coverage = totalWeight === 0 ? 0 : coveredWeight / totalWeight;
  const partialScore = measured.length === 0 ? null : Math.round(weighted / coveredWeight);

  return {
    coverage,
    measuredCount: measured.length,
    partialScore,
    // The letter is the product's core claim, so it is gated on evidence.
    letter: coverage >= MIN_COVERAGE && partialScore !== null ? bandFor(partialScore) : null,
    measured,
    unmeasured,
  };
}

/** A protocol qualifies for the ecosystem ledger once tracked on Arc. */
export function isListable(p: LiveProtocol): boolean {
  return p.tvlUsd >= 0 || p.auditLinks.length > 0;
}
