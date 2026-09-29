"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { PROTOCOLS } from "@/data/protocols";
import { GradeLetter } from "./RatingPlate";
import type { Letter } from "@/lib/types";

const PAGES = [
  { href: "/", label: "Home" },
  { href: "/markets", label: "All markets & ecosystem" },
  { href: "/methodology", label: "Methodology" },
  { href: "/agents", label: "Agent API" },
  { href: "/studio", label: "Analyst studio" },
];

interface PaletteItem {
  slug: string;
  name: string;
  category: string;
  letter: Letter | null;
  score: number | null;
}

export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [extraProtocols, setExtraProtocols] = useState<PaletteItem[]>([]);
  const router = useRouter();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((o) => !o);
      }
      if (e.key === "Escape") setOpen(false);
    };
    const onOpen = () => setOpen(true);
    window.addEventListener("keydown", onKey);
    window.addEventListener("fidex:command", onOpen);
    window.addEventListener("arcgrade:command", onOpen);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("fidex:command", onOpen);
      window.removeEventListener("arcgrade:command", onOpen);
    };
  }, []);

  // Fetch live protocols to allow ⌘K search across all 40+ Arc dApps
  useEffect(() => {
    fetch("/api/v1/arc")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!data?.protocols) return;
        const mapped: PaletteItem[] = data.protocols.map(
          (p: {
            slug: string;
            name: string;
            category?: string;
            screen?: { letter?: Letter | null; partialScore?: number | null };
          }) => ({
            slug: p.slug,
            name: p.name,
            category: p.category || "dApp",
            letter: p.screen?.letter ?? null,
            score: p.screen?.partialScore ?? null,
          }),
        );
        setExtraProtocols(mapped);
      })
      .catch(() => {});
  }, []);

  const allProtocols: PaletteItem[] = useMemo(() => {
    const list: PaletteItem[] = PROTOCOLS.map((p) => ({
      slug: p.slug,
      name: p.name,
      category: p.category,
      letter: p.letter,
      score: p.score,
    }));

    const seen = new Set(list.map((p) => p.slug));
    for (const e of extraProtocols) {
      if (!seen.has(e.slug)) {
        seen.add(e.slug);
        list.push(e);
      }
    }
    return list;
  }, [extraProtocols]);

  const results = useMemo(() => {
    const term = q.trim().toLowerCase();
    if (!term) {
      return {
        protocols: allProtocols.slice(0, 8),
        pages: PAGES,
      };
    }
    return {
      protocols: allProtocols
        .filter((p) =>
          (p.name + " " + p.category + " " + p.slug).toLowerCase().includes(term),
        )
        .slice(0, 10),
      pages: PAGES.filter((p) => p.label.toLowerCase().includes(term)),
    };
  }, [q, allProtocols]);

  if (!open) return null;

  const go = (href: string) => {
    setOpen(false);
    setQ("");
    router.push(href);
  };

  return (
    <div className="no-print fixed inset-0 z-[90] flex items-start justify-center pt-[18vh]">
      <button
        aria-label="Close search"
        className="absolute inset-0 bg-void/80 backdrop-blur-sm"
        onClick={() => setOpen(false)}
      />
      <div className="plate relative w-[min(640px,calc(100vw-2rem))] overflow-hidden shadow-2xl">
        <div className="flex items-center gap-3 border-b border-paper/[0.08] px-4">
          <span className="font-mono text-xs text-gold">⌘K</span>
          <input
            autoFocus
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search all protocols, tokens, and pages on Arc…"
            className="w-full bg-transparent py-4 text-[14px] text-paper outline-none placeholder:text-faint"
          />
        </div>

        <div className="max-h-[56vh] overflow-y-auto p-2">
          {results.protocols.length > 0 && (
            <>
              <p className="label-xs px-3 py-2 text-faint">Protocols & Assets on Arc</p>
              {results.protocols.map((p) => (
                <button
                  key={p.slug}
                  onClick={() => go(`/p/${p.slug}`)}
                  className="flex w-full items-center gap-3 rounded-[2px] px-3 py-2.5 text-left transition-colors hover:bg-gold/[0.07]"
                >
                  <span className="w-6 shrink-0 text-center">
                    {p.letter ? (
                      <GradeLetter letter={p.letter} className="text-xl" />
                    ) : (
                      <span className="font-mono text-[10px] text-gold border border-gold/30 px-1 py-0.5">
                        LIVE
                      </span>
                    )}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[13px] text-paper font-medium">{p.name}</span>
                    <span className="label-xs text-quiet">{p.category}</span>
                  </span>
                  {p.score !== null && (
                    <span className="num font-mono text-[11px] text-paper/80">{p.score}</span>
                  )}
                </button>
              ))}
            </>
          )}

          {results.pages.length > 0 && (
            <>
              <p className="label-xs px-3 py-2 text-faint">Go to</p>
              {results.pages.map((p) => (
                <button
                  key={p.href}
                  onClick={() => go(p.href)}
                  className="block w-full rounded-[2px] px-3 py-2.5 text-left text-[13px] text-paper/85 transition-colors hover:bg-gold/[0.07]"
                >
                  {p.label}
                </button>
              ))}
            </>
          )}

          {results.protocols.length === 0 && results.pages.length === 0 && (
            <p className="px-3 py-8 text-center text-[13px] text-faint">
              Nothing found on Arc under that name.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
