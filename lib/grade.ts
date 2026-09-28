import type { Axis, AxisId, Letter, Protocol } from "./types";

export const METHODOLOGY_VERSION = "arcgrade/1.4.0";

/** Grades visually expire after 7 days without a refresh. */
export const STALE_AFTER_DAYS = 7;

export function bandFor(score: number): Letter {
  if (score >= 85) return "A";
  if (score >= 70) return "B";
  if (score >= 55) return "C";
  if (score >= 40) return "D";
  return "F";
}

export const BANDS: { letter: Letter; min: number; max: number; label: string }[] = [
  { letter: "A", min: 85, max: 100, label: "Lowest structural risk" },
  { letter: "B", min: 70, max: 84, label: "Manageable, with conditions" },
  { letter: "C", min: 55, max: 69, label: "Compensate or size down" },
  { letter: "D", min: 40, max: 54, label: "Speculative. Small size only." },
  { letter: "F", min: 0, max: 39, label: "Do not treat as a savings account" },
];

/**
 * Composite is multiplicative across weak links, not a naive average.
 *
 * 1. Weighted mean over the eight compounding axes.
 * 2. A link factor derived from the WEAKEST axis, so liquidity cannot
 *    hide a missing audit. linkFactor ranges 0.50 (weakest = 0) to
 *    1.00 (weakest = 100), on a concave curve so mid weakness bites.
 */
export function compositeOf(axes: Array<{ weight: number; score: number }>): number {
  const compounding = axes.filter((a) => a.weight > 0);
  const totalWeight = compounding.reduce((s, a) => s + a.weight, 0);
  if (totalWeight === 0) return 0;

  const mean =
    compounding.reduce((s, a) => s + a.weight * a.score, 0) / totalWeight;
  const weakest = Math.min(...compounding.map((a) => a.score));
  const linkFactor = 0.5 + 0.5 * Math.sqrt(weakest / 100);

  return clamp(Math.round(mean * linkFactor), 0, 100);
}

export function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n));
}

export function axisById(axes: Axis[], id: AxisId): Axis | undefined {
  return axes.find((a) => a.id === id);
}

/** Weakest compounding axis, ignoring arcFit which does not compound. */
export function weakestAxis(axes: Axis[]): Axis {
  return axes
    .filter((a) => a.weight > 0)
    .reduce((lo, a) => (a.score < lo.score ? a : lo));
}

export function isStale(protocol: Protocol, now: Date = new Date()): boolean {
  const updated = new Date(protocol.updatedAt).getTime();
  if (Number.isNaN(updated)) return true;
  const ageDays = (now.getTime() - updated) / 86_400_000;
  return ageDays > STALE_AFTER_DAYS;
}

export function ageLabel(iso: string, now: Date = new Date()): string {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return "unknown";
  const mins = Math.max(0, Math.round((now.getTime() - then) / 60_000));
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.round(mins / 60);
  if (hours < 48) return `${hours}h ago`;
  return `${Math.round(hours / 24)}d ago`;
}

export function formatUsd(n: number): string {
  if (n >= 1e9) return `$${(n / 1e9).toFixed(2)}B`;
  if (n >= 1e6) return `$${(n / 1e6).toFixed(1)}M`;
  if (n >= 1e3) return `$${(n / 1e3).toFixed(0)}K`;
  return `$${n.toFixed(0)}`;
}

export function formatApy(apy: number | null): string {
  return apy === null ? "—" : `${apy.toFixed(2)}%`;
}

/** Design-system mapping. Material treatments, not flat chips. */
export const LETTER_TONE: Record<
  Letter,
  { ink: string; wash: string; edge: string; label: string; glow: string }
> = {
  A: {
    ink: "#F0DCA8",
    wash: "var(--color-ink)",
    edge: "rgba(228,195,122,0.42)",
    label: "Reserve",
    glow: "rgba(111,207,151,0.14)",
  },
  B: {
    ink: "#E4C37A",
    wash: "#12140F",
    edge: "rgba(228,195,122,0.30)",
    label: "Brass",
    glow: "rgba(228,195,122,0.10)",
  },
  C: {
    ink: "#E0A45A",
    wash: "#16110B",
    edge: "rgba(224,164,90,0.30)",
    label: "Oxidized",
    glow: "rgba(224,164,90,0.10)",
  },
  D: {
    ink: "#E2745C",
    wash: "var(--color-ash)",
    edge: "rgba(226,116,92,0.30)",
    label: "Rust",
    glow: "rgba(226,116,92,0.10)",
  },
  F: {
    ink: "#E25B4C",
    wash: "#150C0A",
    edge: "rgba(226,91,76,0.34)",
    label: "Stop",
    glow: "rgba(226,91,76,0.12)",
  },
};

export function toneFor(letter: Letter) {
  return LETTER_TONE[letter];
}

import { keccak256, stringToBytes } from "viem";

/**
 * Computes a deterministic cryptographic content hash of a protocol's evaluation data.
 * Anchors the slug, score, letter, axes, kill shots, and dossier verdict so any
 * alteration to the underlying intelligence is immediately detectable.
 */
export function computeContentHash(p: {
  slug: string;
  score: number;
  letter: string;
  dossierVerdict?: string;
  axes: Array<{ id: string; score: number; label: string; summary?: string; evidence?: string }>;
  killShots?: Array<{ title: string; detail: string; axis: string }>;
}): string {
  const payload = JSON.stringify({
    slug: p.slug,
    score: p.score,
    letter: p.letter,
    verdict: p.dossierVerdict ?? "",
    axes: p.axes.map((a) => ({ id: a.id, score: a.score, label: a.label, summary: a.summary ?? "", evidence: a.evidence ?? "" })),
    killShots: (p.killShots ?? []).map((k) => ({ title: k.title, detail: k.detail, axis: k.axis })),
  });
  return keccak256(stringToBytes(payload));
}
