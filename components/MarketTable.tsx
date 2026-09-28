"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import type { Letter, LiveProtocol, Protocol } from "@/lib/types";
import { GradeLetter } from "./RatingPlate";
import { ageLabel, formatApy, formatUsd, isStale } from "@/lib/grade";
import { screen } from "@/lib/screen";

type Sort = "score" | "tvl" | "change" | "name";
type Scope = "all" | "dossiers" | "screened" | "assets";

export interface UnifiedRow {
  kind: "dossier" | "live";
  slug: string;
  name: string;
  monogram: string;
  category: string;
  chainFocus: string;
  letter: Letter | null;
  score: number | null;
  coveragePct?: number;
  delta7d: number;
  tvlUsd: number;
  apy: number | null;
  yieldNote: string;
  updatedAt: string;
  isStale?: boolean;
}

/**
 * Unified Arc Ecosystem Ledger.
 * Displays every protocol, asset, and dApp that runs on Circle Arc.
 */
export function MarketTable({
  rows,
  liveRows = [],
}: {
  rows: Protocol[];
  liveRows?: LiveProtocol[];
}) {
  const [scope, setScope] = useState<Scope>("all");
  const [cat, setCat] = useState<string>("All");
  const [sort, setSort] = useState<Sort>("tvl");
  const [query, setQuery] = useState<string>("");

  // Normalize all rows into a unified model
  const allItems: UnifiedRow[] = useMemo(() => {
    const list: UnifiedRow[] = [];
    const seenSlugs = new Set<string>();

    // 1. Hand-analysed dossiers
    for (const p of rows) {
      seenSlugs.add(p.slug);
      seenSlugs.add(p.name.toLowerCase().replace(/[^a-z0-9]/g, ""));
      list.push({
        kind: "dossier",
        slug: p.slug,
        name: p.name,
        monogram: p.monogram,
        category: p.category,
        chainFocus: p.chainFocus,
        letter: p.letter,
        score: p.score,
        delta7d: p.delta7d,
        tvlUsd: p.tvlUsd,
        apy: p.apy,
        yieldNote: p.yieldNote,
        updatedAt: p.updatedAt,
        isStale: isStale(p),
      });
    }

    // 2. Discovered live protocols
    for (const l of liveRows) {
      const normName = l.name.toLowerCase().replace(/[^a-z0-9]/g, "");
      if (seenSlugs.has(l.slug) || seenSlugs.has(normName)) {
        continue;
      }
      seenSlugs.add(l.slug);
      const scr = screen(l);

      list.push({
        kind: "live",
        slug: l.slug,
        name: l.name,
        monogram: l.monogram,
        category: l.category || "Uncategorised",
        chainFocus: l.arcRoute === "native" ? "Arc (native)" : "Bridged to Arc",
        letter: scr.letter,
        score: scr.partialScore,
        coveragePct: Math.round(scr.coverage * 100),
        delta7d: l.change7d,
        tvlUsd: l.tvlUsd,
        apy: null,
        yieldNote: "Live telemetry",
        updatedAt: l.fetchedAt,
        isStale: false,
      });
    }

    return list;
  }, [rows, liveRows]);

  // Extract categories dynamically
  const categories = useMemo(() => {
    const set = new Set(allItems.map((i) => i.category));
    return ["All", ...Array.from(set).sort()];
  }, [allItems]);

  // Counts for scope tabs
  const dossierCount = useMemo(() => allItems.filter((i) => i.kind === "dossier").length, [allItems]);
  const liveCount = useMemo(() => allItems.filter((i) => i.kind === "live").length, [allItems]);
  const assetCount = useMemo(
    () =>
      allItems.filter((i) => ["Asset", "Stablecoin", "RWA"].includes(i.category)).length,
    [allItems],
  );

  // Filter and sort items
  const view = useMemo(() => {
    let list = [...allItems];

    // Scope filter
    if (scope === "dossiers") {
      list = list.filter((i) => i.kind === "dossier");
    } else if (scope === "screened") {
      list = list.filter((i) => i.kind === "live");
    } else if (scope === "assets") {
      list = list.filter((i) => ["Asset", "Stablecoin", "RWA"].includes(i.category));
    }

    // Category filter
    if (cat !== "All") {
      list = list.filter((i) => i.category === cat);
    }

    // Search query filter
    const q = query.trim().toLowerCase();
    if (q) {
      list = list.filter(
        (i) =>
          i.name.toLowerCase().includes(q) ||
          i.category.toLowerCase().includes(q) ||
          i.slug.toLowerCase().includes(q) ||
          i.monogram.toLowerCase().includes(q),
      );
    }

    // Sorting
    list.sort((a, b) => {
      if (sort === "tvl") return b.tvlUsd - a.tvlUsd;
      if (sort === "score") {
        const scoreA = a.score ?? -1;
        const scoreB = b.score ?? -1;
        return scoreB - scoreA;
      }
      if (sort === "change") return b.delta7d - a.delta7d;
      if (sort === "name") return a.name.localeCompare(b.name);
      return 0;
    });

    return list;
  }, [allItems, scope, cat, query, sort]);

  return (
    <div>
      {/* Scope Navigation Tabs */}
      <div className="no-print mb-4 flex flex-wrap items-center justify-between gap-3 border-b border-paper/[0.08] pb-3">
        <div data-walkthrough="market-tabs" className="flex flex-wrap gap-2">
          <button
            onClick={() => setScope("all")}
            className={`label-xs flex items-center gap-1.5 border-b-2 px-3 py-2 transition-colors ${
              scope === "all"
                ? "border-gold text-gold font-medium"
                : "border-transparent text-quiet hover:text-paper"
            }`}
          >
            <span>All Ecosystem</span>
            <span className="font-mono text-[10px] text-faint">({allItems.length})</span>
          </button>
          <button
            onClick={() => setScope("dossiers")}
            className={`label-xs flex items-center gap-1.5 border-b-2 px-3 py-2 transition-colors ${
              scope === "dossiers"
                ? "border-gold text-gold font-medium"
                : "border-transparent text-quiet hover:text-paper"
            }`}
          >
            <span>Hand-Analysed Research Benchmarks</span>
            <span className="font-mono text-[10px] text-gold/70">({dossierCount})</span>
          </button>
          <button
            onClick={() => setScope("screened")}
            className={`label-xs flex items-center gap-1.5 border-b-2 px-3 py-2 transition-colors ${
              scope === "screened"
                ? "border-gold text-gold font-medium"
                : "border-transparent text-quiet hover:text-paper"
            }`}
          >
            <span>Live Screened dApps</span>
            <span className="font-mono text-[10px] text-faint">({liveCount})</span>
          </button>
          <button
            onClick={() => setScope("assets")}
            className={`label-xs flex items-center gap-1.5 border-b-2 px-3 py-2 transition-colors ${
              scope === "assets"
                ? "border-gold text-gold font-medium"
                : "border-transparent text-quiet hover:text-paper"
            }`}
          >
            <span>Assets & Tokens</span>
            <span className="font-mono text-[10px] text-faint">({assetCount})</span>
          </button>
        </div>

        {/* Quick Filter Input */}
        <div className="relative min-w-[200px] max-w-xs">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Filter by name or symbol…"
            className="w-full rounded-[2px] border border-paper/10 bg-panel px-3 py-1.5 font-mono text-[12px] text-paper placeholder:text-faint focus:border-gold/50 focus:outline-none"
          />
          {query && (
            <button
              onClick={() => setQuery("")}
              className="absolute right-2.5 top-1.5 font-mono text-xs text-faint hover:text-paper"
            >
              &times;
            </button>
          )}
        </div>
      </div>

      {/* Category Pills & Sort Controls */}
      <div className="no-print mb-6 flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap gap-1.5">
          {categories.map((c) => (
            <button
              key={c}
              onClick={() => setCat(c)}
              className={`label-xs rounded-[2px] border px-3 py-1.5 transition-colors ${
                cat === c
                  ? "border-gold/50 bg-gold/[0.08] text-gold"
                  : "border-paper/10 text-quiet hover:border-gold/30 hover:text-paper"
              }`}
            >
              {c}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2">
          <span className="label-xs text-faint">Sort:</span>
          {(
            [
              { key: "tvl", label: "TVL" },
              { key: "score", label: "Score" },
              { key: "change", label: "7d Momentum" },
              { key: "name", label: "Name" },
            ] as const
          ).map((s) => (
            <button
              key={s.key}
              onClick={() => setSort(s.key)}
              className={`label-xs rounded-[2px] px-2.5 py-1 transition-colors ${
                sort === s.key ? "text-gold bg-gold/10" : "text-faint hover:text-paper"
              }`}
            >
              {s.label}
            </button>
          ))}
        </div>
      </div>

      {/* The Ledger Table */}
      <div className="overflow-x-auto">
        <table className="ledger w-full min-w-[880px] text-left text-[13px]">
          <thead>
            <tr className="label-xs border-b border-paper/[0.08]">
              <th className="sticky-col py-3 pr-6 font-normal">Protocol / Asset</th>
              <th className="py-3 pr-6 font-normal">Arc Route</th>
              <th className="py-3 pr-6 font-normal">Rating / Coverage</th>
              <th className="py-3 pr-6 font-normal">Score</th>
              <th className="py-3 pr-6 font-normal">&Delta; 7d</th>
              <th className="py-3 pr-6 font-normal">Arc TVL</th>
              <th className="py-3 pr-6 font-normal">Yield / Utility</th>
              <th className="py-3 font-normal">Status</th>
            </tr>
          </thead>
          <tbody>
            {view.map((item) => (
              <tr key={item.slug} className="group border-t border-paper/[0.06] hover:bg-gold/[0.02]">
                {/* Protocol / Asset Name & Monogram */}
                <td className="sticky-col py-4 pr-6">
                  <Link href={`/p/${item.slug}`} className="flex items-center gap-3">
                    <span className="flex h-7 w-7 items-center justify-center border border-gold/20 font-mono text-[10px] tracking-[0.1em] text-gold">
                      {item.monogram}
                    </span>
                    <span>
                      <span className="block text-paper group-hover:text-gold transition-colors font-medium">
                        {item.name}
                      </span>
                      <span className="label-xs text-quiet">{item.category}</span>
                    </span>
                  </Link>
                </td>

                {/* Arc Route */}
                <td className="py-4 pr-6 text-quiet text-[12px]">{item.chainFocus}</td>

                {/* Rating / Coverage */}
                <td className="py-4 pr-6">
                  {item.letter ? (
                    <div className="flex items-center gap-2">
                      <GradeLetter letter={item.letter} className="text-3xl" />
                      {item.kind === "live" && (
                        <span className="label-xs text-[9px] border border-gold/20 bg-gold/5 px-1 py-0.5 text-gold">
                          Screen
                        </span>
                      )}
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      <span className="rounded-[2px] border border-paper/15 bg-panel px-2 py-1 font-mono text-[11px] text-paper/80">
                        {item.coveragePct}% cov
                      </span>
                    </div>
                  )}
                </td>

                {/* Score */}
                <td className="num py-4 pr-6 font-mono text-[13px] text-paper/85">
                  {item.score !== null ? (
                    item.score
                  ) : (
                    <span className="text-faint">—</span>
                  )}
                </td>

                {/* 7d Delta */}
                <td
                  className={`num py-4 pr-6 font-mono text-[12px] ${
                    item.delta7d > 0
                      ? "text-reserve"
                      : item.delta7d < 0
                      ? "text-stop"
                      : "text-faint"
                  }`}
                >
                  {item.delta7d > 0 ? "+" : ""}
                  {typeof item.delta7d === "number" ? item.delta7d.toFixed(1) : item.delta7d}%
                </td>

                {/* Arc TVL */}
                <td className="num py-4 pr-6 font-mono text-[12px] text-paper/90 font-medium">
                  {formatUsd(item.tvlUsd)}
                </td>

                {/* Yield / Utility */}
                <td className="py-4 pr-6">
                  {item.apy !== null ? (
                    <div>
                      <span className="num font-mono text-[12px] text-paper/80">
                        {formatApy(item.apy)}
                      </span>
                      <span className="mt-0.5 block max-w-[180px] truncate text-[11px] text-faint">
                        {item.yieldNote}
                      </span>
                    </div>
                  ) : (
                    <span className="text-[12px] text-quiet max-w-[180px] truncate block">
                      {item.yieldNote}
                    </span>
                  )}
                </td>

                {/* Status / Updated */}
                <td className="py-4">
                  {item.kind === "dossier" ? (
                    <span
                      className={`num font-mono text-[11px] ${
                        item.isStale ? "text-caution" : "text-gold"
                      }`}
                    >
                      Benchmark ({ageLabel(item.updatedAt)})
                    </span>
                  ) : (
                    <span className="num font-mono text-[11px] text-quiet">
                      Live Telemetry
                    </span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {view.length === 0 && (
        <div className="py-16 text-center text-[13px] text-faint">
          No protocols or assets match your current filters.
        </div>
      )}

      <div className="mt-6 flex flex-wrap items-center justify-between text-faint label-xs">
        <p>
          Showing {view.length} of {allItems.length} protocols & assets on Circle Arc
        </p>
        <p>
          {dossierCount} hand-analysed research benchmarks &middot; {liveCount} live telemetry feeds
        </p>
      </div>
    </div>
  );
}
