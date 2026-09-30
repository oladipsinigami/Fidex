"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";
import type { Protocol } from "@/lib/types";

export function LookbookHero({ featured }: { featured: Protocol }) {
  const root = useRef<HTMLElement>(null);

  useEffect(() => {
    const el = root.current;
    if (!el) return;
    const onMove = (e: PointerEvent) => {
      const r = el.getBoundingClientRect();
      el.style.setProperty("--mx", `${((e.clientX - r.left) / r.width) * 100}%`);
      el.style.setProperty("--my", `${((e.clientY - r.top) / r.height) * 100}%`);
    };
    el.addEventListener("pointermove", onMove);
    return () => el.removeEventListener("pointermove", onMove);
  }, []);

  return (
    <section ref={root} className="lookbook-hero">
      <div className="lookbook-hero__still" aria-hidden />
      <div className="lookbook-hero__reveal" aria-hidden />

      <div className="lookbook-hero__grid">
        <div className="lookbook-hero__copy">
          <span className="lookbook-crop lookbook-crop--tl" aria-hidden />
          <p className="lookbook-kicker">
            Circle Arc · 5042002 · {featured.methodologyVersion}
          </p>
          <h1 className="lookbook-display">
            KNOW
            <br />
            THE RISK
            <br />
            <span className="lookbook-display__last">
              FIRST
              <span className="lookbook-pixel" aria-hidden />
            </span>
          </h1>
          <p className="lookbook-lede">
            A letter. A score. A dated dossier — issued before the deposit,
            not after the exploit.
          </p>
          <Link href="/markets" className="lookbook-cta">
            Open the book
            <span aria-hidden>↗</span>
          </Link>
        </div>

        <aside className="lookbook-hero__meta">
          <span className="lookbook-crop lookbook-crop--br" aria-hidden />
          <p className="lookbook-meta-label">Issued plate</p>
          <p className="lookbook-meta-name">{featured.name}</p>
          <p className="lookbook-meta-score">
            {featured.letter} · {featured.score}/100
          </p>
          <Link href={`/p/${featured.slug}`} className="lookbook-meta-link">
            Read the plate →
          </Link>
        </aside>
      </div>
    </section>
  );
}
