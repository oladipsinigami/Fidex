"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { PROTOCOLS } from "@/data/protocols";
import { GradeLetter } from "./RatingPlate";
import type { Letter } from "@/lib/types";

interface SearchItem {
  slug: string;
  name: string;
  category: string;
  letter: Letter | null;
  kind: "dossier" | "live";
}

/** Ticker search box across every asset and dApp on Arc. */
export function SearchBox() {
  const [q, setQ] = useState("");
  const [extraItems, setExtraItems] = useState<SearchItem[]>([]);
  const router = useRouter();

  // Load live Arc universe dynamically
  useEffect(() => {
    fetch("/api/v1/arc")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!data?.protocols) return;
        const mapped: SearchItem[] = data.protocols.map(
          (p: { slug: string; name: string; category?: string; screen?: { letter?: Letter | null } }) => ({
            slug: p.slug,
            name: p.name,
            category: p.category || "dApp",
            letter: p.screen?.letter ?? null,
            kind: "live" as const,
          }),
        );
        setExtraItems(mapped);
      })
      .catch(() => {});
  }, []);

  const allItems: SearchItem[] = useMemo(() => {
    const list: SearchItem[] = PROTOCOLS.map((p) => ({
      slug: p.slug,
      name: p.name,
      category: p.category,
      letter: p.letter,
      kind: "dossier",
    }));

    const seen = new Set(list.map((i) => i.slug));
    for (const e of extraItems) {
      if (!seen.has(e.slug)) {
        seen.add(e.slug);
        list.push(e);
      }
    }
    return list;
  }, [extraItems]);

  const hits = useMemo(() => {
    const t = q.trim().toLowerCase();
    if (!t) return [];
    return allItems
      .filter((p) =>
        (p.name + " " + p.category + " " + p.slug).toLowerCase().includes(t),
      )
      .slice(0, 7);
  }, [q, allItems]);

  return (
    <div className="relative mt-10 max-w-lg">
      <div className="plate flex items-center gap-3 px-4 py-3.5">
        <span className="font-mono text-xs text-faint">&gt;</span>
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && hits[0]) router.push(`/p/${hits[0].slug}`);
            if (e.key === "Escape") setQ("");
          }}
          placeholder="Search any protocol, token, or dApp on Arc…"
          aria-label="Search Arc protocols and tokens"
          className="w-full bg-transparent font-mono text-[13px] text-paper outline-none placeholder:text-faint"
        />
        <kbd className="label-xs hidden text-faint sm:block">↵</kbd>
      </div>

      {hits.length > 0 && (
        <ul className="plate mt-px overflow-hidden shadow-2xl">
          {hits.map((p) => (
            <li key={p.slug}>
              <button
                onClick={() => {
                  router.push(`/p/${p.slug}`);
                  setQ("");
                }}
                className="flex w-full items-center gap-3 px-4 py-2.5 text-left transition-colors hover:bg-gold/[0.07]"
              >
                {p.letter ? (
                  <GradeLetter letter={p.letter} className="text-lg" />
                ) : (
                  <span className="border border-gold/30 bg-gold/10 px-1.5 py-0.5 font-mono text-[10px] text-gold">
                    LIVE
                  </span>
                )}
                <span className="flex-1 truncate text-[13px] text-paper font-medium">{p.name}</span>
                <span className="label-xs text-quiet">{p.category}</span>
                {p.kind === "dossier" && (
                  <span className="label-xs text-[9px] text-gold">Dossier</span>
                )}
              </button>
            </li>
          ))}
        </ul>
      )}

      {q.trim().length > 0 && hits.length === 0 && (
        <p className="plate mt-px px-4 py-3 text-[12px] text-faint">
          No protocol or asset found on Arc under that name.
        </p>
      )}
    </div>
  );
}
