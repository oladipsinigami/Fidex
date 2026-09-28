import Link from "next/link";
import type { Protocol } from "@/lib/types";

/** Market tape: a slow mono crawl of every letter we publish. */
export function MarketTape({ items }: { items: Protocol[] }) {
  const doubled = [...items, ...items];
  return (
    <div className="relative overflow-hidden border-y border-paper/[0.07] bg-sunk py-3">
      <div
        className="flex w-max gap-8 whitespace-nowrap"
        style={{ animation: "tape 46s linear infinite" }}
      >
        {doubled.map((p, i) => (
          <Link
            key={`${p.slug}-${i}`}
            href={`/p/${p.slug}`}
            className="flex items-center gap-2.5 font-mono text-[12px] text-quiet transition-colors hover:text-gold"
          >
            <span className="text-paper/80">{p.monogram}</span>
            <span
              className="font-display text-base leading-none"
              style={{ color: "var(--color-gold)" }}
            >
              <GradeLetterInline letter={p.letter} />
            </span>
            <span className="num text-faint">{p.score}</span>
            <span className="text-faint/50">/</span>
          </Link>
        ))}
      </div>
    </div>
  );
}

function GradeLetterInline({ letter }: { letter: Protocol["letter"] }) {
  return <span>{letter}</span>;
}
