"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import type { Letter, LiveProtocol } from "@/lib/types";
import { formatUsd } from "@/lib/grade";
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
  /** Live DeFiLlama TVL when we have a verified mapping; null means the row
   *  is showing the stored analyst snapshot, which is labelled as such. */
  liveTvlUsd?: number | null;
  apy: number | null;
  yieldNote?: string;
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
  rows: UnifiedRow[];
  liveRows?: LiveProtocol[];
}) {
  const [scope, setScope] = useState<Scope>("all");
  const [cat, setCat] = useState<string>("All");
  const [sort, setSort] = useState<Sort>("tvl");
  const [query, setQuery] = useState<string>("");

  // Normalize all rows into a unified model
  const allItems: UnifiedRow[] = useMemo(() => {
    const list: UnifiedRow[] = [...rows];
    const seenSlugs = new Set<string>(
      rows.map((r) => r.slug).concat(rows.map((r) => r.name.toLowerCase().replace(/[^a-z0-9]/g, ""))),
    );

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
        // Discovered rows come straight from DeFiLlama -- but only when the
        // fetch actually succeeded. When it did not, discover.ts hands back the
        // curated fallback, which is hardcoded and must not be labelled live.
        liveTvlUsd: l.source === "defillama" ? l.tvlUsd : null,
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
      {/* Scope Navigation & Quick Search */}
      <div className="no-print mb-6 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="specimen-filter-bar mt-0">
            {(
              [
                { key: "all", label: "All Specimen", count: allItems.length },
                { key: "dossiers", label: "Research Benchmarks", count: dossierCount },
                { key: "screened", label: "Live Telemetry", count: liveCount },
                { key: "assets", label: "Assets & Tokens", count: assetCount },
              ] as const
            ).map((t) => (
              <button
                key={t.key}
                onClick={() => setScope(t.key)}
                className={`specimen-pill ${scope === t.key ? "is-active" : ""}`}
              >
                {t.label} ({t.count})
              </button>
            ))}
          </div>

          {/* Quick Filter Input */}
          <div className="relative min-w-[220px] max-w-xs">
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search specimen or symbol…"
              className="w-full border border-current/20 bg-transparent px-3 py-1.5 font-mono text-[12px] placeholder:opacity-40 focus:border-current focus:outline-none"
            />
            {query && (
              <button
                onClick={() => setQuery("")}
                className="absolute right-2.5 top-1.5 font-mono text-xs opacity-50 hover:opacity-100"
              >
                &times;
              </button>
            )}
          </div>
        </div>

        {/* Category Filter Pills & Sort Controls */}
        <div className="flex flex-wrap items-center justify-between gap-4 pt-2">
          <div className="specimen-filter-bar mt-0">
            {categories.map((c) => (
              <button
                key={c}
                onClick={() => setCat(c)}
                className={`specimen-pill ${cat === c ? "is-active" : ""}`}
              >
                {c}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2">
            <span className="text-[10px] font-mono uppercase tracking-widest opacity-60">Sort:</span>
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
                className={`specimen-pill text-[9px] py-1 px-2.5 ${
                  sort === s.key ? "is-active" : ""
                }`}
              >
                {s.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* The Specimen Ledger Table */}
      <div className="overflow-x-auto">
        <table className="specimen-table min-w-[920px]">
          <thead>
            <tr>
              <th className="w-16">Grade</th>
              <th>Protocol / Specimen</th>
              <th>Category</th>
              <th className="text-right">TVL</th>
              <th>Risk Verdict</th>
              <th className="text-right w-36">Action</th>
            </tr>
          </thead>
          <tbody>
            {view.map((item) => (
              <tr key={item.slug}>
                {/* Grade Stamp */}
                <td>
                  {item.letter ? (
                    <span className={`grade-badge-solid grade-badge-solid--${item.letter}`}>
                      {item.letter}
                    </span>
                  ) : (
                    <span className="font-mono text-xs opacity-60">{item.coveragePct}% cov</span>
                  )}
                </td>

                {/* Protocol Name */}
                <td>
                  <Link href={`/p/${item.slug}`} className="flex items-center gap-3 no-underline text-inherit group">
                    <span className="flex h-6 w-6 items-center justify-center border border-current/20 font-mono text-[10px] font-bold">
                      {item.monogram}
                    </span>
                    <div>
                      <span className="font-semibold group-hover:underline block">
                        {item.name}
                      </span>
                      <span className="font-mono text-[11px] opacity-60 block">
                        {item.chainFocus}
                      </span>
                    </div>
                  </Link>
                </td>

                {/* Category */}
                <td className="text-xs uppercase tracking-wider opacity-75 font-mono">
                  {item.category}
                </td>

                {/* TVL */}
                <td className="text-right font-mono font-medium text-xs">
                  <div>{formatUsd(item.liveTvlUsd ?? item.tvlUsd)}</div>
                  <span className="text-[10px] uppercase tracking-widest opacity-50 block">
                    {item.liveTvlUsd == null ? "snapshot" : "live telemetry"}
                  </span>
                </td>

                {/* Risk Verdict */}
                <td className="text-xs opacity-80 max-w-xs">
                  <div className="line-clamp-1 font-mono text-[11px]">
                    {item.score !== null ? `Score ${item.score}/100` : "Under Screen"} · {item.yieldNote}
                  </div>
                </td>

                {/* Action */}
                <td className="text-right">
                  <Link href={`/p/${item.slug}`} className="lookbook-connect-btn inline-block no-underline">
                    VIEW PLATE ↗
                  </Link>
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
