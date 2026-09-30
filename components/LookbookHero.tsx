"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";
import Image from "next/image";
import type { Protocol } from "@/lib/types";
import { Barcode } from "./Barcode";
import { CropMark } from "./CropMark";

export function LookbookHero({ featured }: { featured: Protocol }) {
  const root = useRef<HTMLElement>(null);

  useEffect(() => {
    const el = root.current;
    if (!el) return;
    const onMove = (e: PointerEvent) => {
      const r = el.getBoundingClientRect();
      const x = (e.clientX - r.left) / r.width - 0.5;
      const y = (e.clientY - r.top) / r.height - 0.5;
      el.style.setProperty("--tilt-x", `${y * 5}deg`);
      el.style.setProperty("--tilt-y", `${-x * 5}deg`);
    };
    el.addEventListener("pointermove", onMove);
    return () => el.removeEventListener("pointermove", onMove);
  }, []);

  return (
    <section ref={root} className="lookbook-hero">
      <div className="lookbook-hero__grid">
        <div className="lookbook-hero__copy">
          <CropMark corner="tl" size={24} className="-top-4 -left-4 sm:-top-6 sm:-left-6" />

          <h1 className="lookbook-display">
            KNOW
            <br />
            THE RISK
            <br />
            <span className="lookbook-display__last">
              FIRST
              <Barcode className="h-8 sm:h-12 w-20 sm:w-28 text-current inline-block ml-3" />
            </span>
          </h1>

          <p className="lookbook-lede">
            Institutional risk intelligence for uncertain markets.
          </p>

          <Link href="/markets" className="lookbook-cta">
            <span>OPEN THE BOOK</span>
            <span aria-hidden="true">↗</span>
          </Link>
        </div>

        <div className="lookbook-hero__asset">
          <div className="lookbook-sculpture-wrap">
            {/* Light Mode 3D Sculpture */}
            <Image
              src="/plates/letter-b-gold.jpg"
              alt="Sculptural Letter B Rating Plate"
              className="lookbook-sculpture-img block [html[data-theme='dark']_&]:hidden"
              style={{
                transform:
                  "perspective(1000px) rotateX(var(--tilt-x, 0deg)) rotateY(var(--tilt-y, 0deg))",
              }}
              width={560}
              height={560}
              priority
            />
            {/* Dark Mode 3D Sculpture */}
            <Image
              src="/plates/letter-b-dark.jpg"
              alt="Sculptural Letter B Rating Plate"
              className="lookbook-sculpture-img hidden [html[data-theme='dark']_&]:block"
              style={{
                transform:
                  "perspective(1000px) rotateX(var(--tilt-x, 0deg)) rotateY(var(--tilt-y, 0deg))",
              }}
              width={560}
              height={560}
              priority
            />
          </div>

          <aside className="lookbook-hero__meta">
            <CropMark corner="br" size={16} className="-bottom-2 -right-2" />
            <p className="lookbook-meta-label">ISSUED PLATE</p>
            <p className="lookbook-meta-name">MORPHO /</p>
            <p className="lookbook-meta-score">
              {featured.letter} · {featured.score}/100
            </p>
          </aside>
        </div>
      </div>
    </section>
  );
}
