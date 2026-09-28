export type Letter = "A" | "B" | "C" | "D" | "F";

export type AxisId =
  | "security"
  | "liquidity"
  | "decentralization"
  | "audits"
  | "concentration"
  | "history"
  | "governance"
  | "yieldSustainability"
  | "arcFit";

export type CitationKind =
  | "audit"
  | "explorer"
  | "defi"
  | "governance"
  | "docs"
  | "code"
  | "arc";

export interface Citation {
  label: string;
  href: string;
  kind: CitationKind;
}

export interface Axis {
  id: AxisId;
  label: string;
  /** 0 for arcFit, which is displayed separately and does not compound. */
  weight: number;
  /** 0-100, 100 = safest */
  score: number;
  /** Teaser line shown while locked. No numbers, no evidence. */
  summary: string;
  /** Paid evidence. Exactly two sentences. */
  evidence: string;
  citations: Citation[];
}

export interface KillShot {
  title: string;
  detail: string;
  /** Axis most exposed to this failure mode. */
  axis: AxisId;
}

export interface UnlockEvent {
  date: string;
  amount: string;
  pctOfFloat: number;
  note: string;
}

export interface Incident {
  date: string;
  severity: "low" | "medium" | "high";
  title: string;
  resolved: boolean;
}

export interface Protocol {
  slug: string;
  name: string;
  monogram: string;
  category: string;
  chainFocus: string;
  /** Native on Arc, or bridged. */
  arcRoute: "native" | "bridged-cctp" | "bridged-gateway";
  tagline: string;
  /** Free tier. */
  verdict: string;
  /** Paid tier. */
  dossierVerdict: string;
  axes: Axis[];
  /** 0-100, derived. */
  score: number;
  letter: Letter;
  delta7d: number;
  tvlUsd: number;
  yieldNote: string;
  apy: number | null;
  killShots: KillShot[];
  unlocks: UnlockEvent[];
  incidents: Incident[];
  /** Static, published at build time in the mock. */
  updatedAt: string;
  methodologyVersion: string;
  analystId: string;
  contentHash: string;
  /** Cross-links: same protocol family or same risk cluster. */
  related: string[];
}

/**
 * A protocol discovered from a live public feed rather than hand-analysed.
 * `score` is null on any axis with no defensible public datum, and the
 * grading layer refuses to publish a letter until enough axes are measured.
 */
export interface LiveAxis {
  id: AxisId;
  /** null means "not measured", not "zero". */
  score: number | null;
  summary: string;
  evidence: string;
  citations: Citation[];
}

export interface LiveProtocol {
  slug: string;
  name: string;
  monogram: string;
  category: string;
  description: string;
  url: string;
  twitter: string;
  arcRoute: "native" | "bridged-cctp" | "bridged-gateway";
  chains: string[];
  tvlUsd: number;
  totalTvlUsd: number;
  change7d: number;
  /** unix seconds, from DeFiLlama. */
  listedAt: number | null;
  mcap: number | null;
  auditLinks: { name: string; url: string }[];
  axes: LiveAxis[];
  fetchedAt: string;
  source: string;
}
