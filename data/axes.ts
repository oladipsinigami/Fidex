import type { Axis, AxisId, Citation, Protocol } from "@/lib/types";

/** Weights for the eight compounding axes. arcFit is displayed, not compounded. */
export const WEIGHTS: Record<AxisId, number> = {
  security: 0.18,
  liquidity: 0.14,
  decentralization: 0.13,
  audits: 0.12,
  concentration: 0.11,
  history: 0.1,
  governance: 0.1,
  yieldSustainability: 0.12,
  arcFit: 0,
};

export const AXIS_ORDER: AxisId[] = [
  "security",
  "liquidity",
  "decentralization",
  "audits",
  "concentration",
  "history",
  "governance",
  "yieldSustainability",
  "arcFit",
];

export const AXIS_LABEL: Record<AxisId, string> = {
  security: "Security",
  liquidity: "Liquidity",
  decentralization: "Decentralization",
  audits: "Audits",
  concentration: "Token concentration",
  history: "Protocol history",
  governance: "Governance",
  yieldSustainability: "Yield sustainability",
  arcFit: "Arc fit",
};

export const c = (label: string, href: string, kind: Citation["kind"]): Citation => ({
  label,
  href,
  kind,
});

export const ax = (
  id: AxisId,
  score: number,
  summary: string,
  evidence: string,
  citations: Citation[],
): Axis => ({
  id,
  label: AXIS_LABEL[id],
  weight: WEIGHTS[id],
  score,
  summary,
  evidence,
  citations,
});

/** A protocol before its score and letter are derived from the axes. */
export type Raw = Omit<Protocol, "score" | "letter" | "methodologyVersion">;
