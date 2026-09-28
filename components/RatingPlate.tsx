import type { Letter, Protocol } from "@/lib/types";
import { ageLabel, isStale, toneFor } from "@/lib/grade";

/** Material treatments. Not flat chips: leaf, brass, oxide, rust, dried blood. */
const LEAF: Record<Letter, string> = {
  A: "linear-gradient(174deg,#FBF0CE 0%,#E9CE8C 34%,#C7A45C 60%,#8A6F38 100%)",
  B: "linear-gradient(174deg,#F0E1B4 0%,#DCC082 36%,#A98A46 72%,#6E5729 100%)",
  C: "linear-gradient(174deg,#F3CE96 0%,#E0A45A 38%,#A96B2C 74%,#6B3F17 100%)",
  D: "linear-gradient(174deg,#EEA288 0%,#E2745C 38%,#A8452F 74%,#5E2418 100%)",
  F: "linear-gradient(174deg,#E88C80 0%,#E25B4C 34%,#9C2E22 72%,#4A140E 100%)",
};

const WASH: Record<Letter, string> = {
  A: "radial-gradient(ellipse 70% 60% at 30% 20%, rgba(111,207,151,0.16), transparent 70%)",
  B: "radial-gradient(ellipse 70% 60% at 30% 20%, rgba(228,195,122,0.13), transparent 70%)",
  C: "radial-gradient(ellipse 70% 60% at 30% 20%, rgba(224,164,90,0.13), transparent 70%)",
  D: "radial-gradient(ellipse 70% 60% at 30% 20%, rgba(226,116,92,0.14), transparent 70%)",
  F: "radial-gradient(ellipse 70% 60% at 30% 20%, rgba(226,91,76,0.16), transparent 70%)",
};

export function GradeLetter({
  letter,
  className = "",
  slam = false,
}: {
  letter: Letter;
  className?: string;
  slam?: boolean;
}) {
  return (
    <span
      aria-label={`Grade ${letter}`}
      className={`font-display font-semibold leading-[0.78] tracking-[-0.03em] ${
        slam ? "grade-slam" : ""
      } ${className}`}
      style={{
        backgroundImage: LEAF[letter],
        WebkitBackgroundClip: "text",
        backgroundClip: "text",
        color: "transparent",
        textShadow: "none",
      }}
    >
      {letter}
    </span>
  );
}

/** Thin gold arc. Reads as an instrument dial, not a progress bar. */
export function ScoreRing({
  score,
  size = 132,
  stroke = 3,
  className = "",
}: {
  score: number;
  size?: number;
  stroke?: number;
  className?: string;
}) {
  const r = (size - stroke) / 2;
  const circ = 2 * Math.PI * r;
  const offset = circ * (1 - score / 100);
  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      className={className}
      role="img"
      aria-label={`Score ${score} of 100`}
    >
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        fill="none"
        stroke="rgba(232,214,176,0.10)"
        strokeWidth={stroke}
      />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        fill="none"
        stroke="var(--color-gold)"
        strokeWidth={stroke}
        strokeLinecap="butt"
        strokeDasharray={circ}
        strokeDashoffset={offset}
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
        style={{ transition: "stroke-dashoffset 900ms cubic-bezier(0.22,1,0.36,1)" }}
      />
      <text
        x="50%"
        y="50%"
        textAnchor="middle"
        dominantBaseline="central"
        className="num"
        fill="var(--color-paper)"
        fontSize={size * 0.27}
        fontFamily="var(--font-geist-mono)"
      >
        {score}
      </text>
    </svg>
  );
}


export function StaleChip({ updatedAt }: { updatedAt: string }) {
  if (!isStale({ updatedAt } as Protocol)) {
    return (
      <span className="label-xs inline-flex items-center gap-1.5 text-reserve/80">
        <span className="inline-block h-1 w-1 rounded-full bg-reserve" />
        Current
      </span>
    );
  }
  return (
    <span className="label-xs inline-flex items-center gap-1.5 rounded-[2px] border border-caution/35 bg-caution/10 px-2 py-1 text-caution">
      Stale &middot; {ageLabel(updatedAt)}
    </span>
  );
}


/* ------------------------------------------------------------------
   RatingPlate — the certificate. This is the product's physical object:
   engraved plate, corner ticks, letter watermark, dial, crest.
   ------------------------------------------------------------------ */

export function RatingPlate({
  protocol,
  size = "hero",
  showMeta = true,
  slam = false,
}: {
  protocol: Protocol;
  size?: "hero" | "row" | "compact";
  showMeta?: boolean;
  slam?: boolean;
}) {
  const tone = toneFor(protocol.letter);
  const stale = isStale(protocol);

  const dims = {
    hero: { plate: "p-8 sm:p-10", letter: "text-[11rem] sm:text-[15rem]", ring: 168, crest: "h-11 w-11 text-sm" },
    row: { plate: "p-5", letter: "text-6xl", ring: 0, crest: "h-8 w-8 text-[11px]" },
    compact: { plate: "p-4", letter: "text-5xl", ring: 0, crest: "h-7 w-7 text-[10px]" },
  }[size];

  return (
    <div
      className={`plate ${dims.plate} relative overflow-hidden`}
      style={{ backgroundImage: `${WASH[protocol.letter]}, linear-gradient(168deg, var(--color-elev) 0%, var(--color-panel) 62%, var(--color-sunk) 100%)` }}
    >
      {/* Watermark: the letter, ghosted into the plate at 6%. */}
      <span
        aria-hidden
        className="pointer-events-none absolute -right-6 -top-10 select-none font-display font-semibold leading-none text-paper/[0.06]"
        style={{ fontSize: size === "hero" ? "22rem" : "9rem" }}
      >
        {protocol.letter}
      </span>

      {/* Engraved hairline frame. */}
      <span
        aria-hidden
        className="pointer-events-none absolute inset-3 border border-paper/[0.05]"
      />

      <div className="relative flex items-start justify-between gap-6">
        <div className="min-w-0">
          {/* Crest */}
          <div
            className={`plate ${dims.crest} mb-6 flex items-center justify-center border-gold/25 font-mono font-medium tracking-[0.14em] text-gold`}
            style={{ backgroundImage: "none", borderRadius: 1 }}
          >
            {protocol.monogram}
          </div>

          <GradeLetter letter={protocol.letter} slam={slam} className={dims.letter} />

          <h3 className="mt-5 font-display text-2xl leading-tight text-paper sm:text-3xl">
            {protocol.name}
          </h3>
          <p className="mt-2 max-w-[26ch] text-[10.5px] uppercase leading-[1.5] tracking-[0.1em] text-quiet">
            {protocol.tagline}
          </p>
        </div>

        {dims.ring > 0 && (
          <div className="shrink-0 pt-2">
            <ScoreRing score={protocol.score} size={dims.ring} />
            <p className="label-xs mt-3 text-center">Score</p>
          </div>
        )}
      </div>

      {showMeta && (
        <div className="relative mt-7 border-t border-paper/[0.07] pt-4">
          <dl className="grid grid-cols-2 gap-x-5 gap-y-3">
            <Meta label="Band" value={tone.label} />
            <Meta label="Updated" value={ageLabel(protocol.updatedAt)} warn={stale} />
            <Meta label="Method" value={protocol.methodologyVersion} mono small />
            <Meta label="Hash" value={`${protocol.contentHash.slice(0, 8)}…`} mono small />
          </dl>
        </div>
      )}
    </div>
  );
}

function Meta({
  label,
  value,
  mono,
  small,
  warn,
}: {
  label: string;
  value: string;
  mono?: boolean;
  small?: boolean;
  warn?: boolean;
}) {
  return (
    <div>
      <dt className="label-xs">{label}</dt>
      <dd
        className={`mt-1.5 truncate ${mono ? "font-mono" : ""} ${
          small ? "text-[10.5px]" : "text-[13px]"
        } ${warn ? "text-caution" : "text-paper/85"}`}
      >
        {value}
      </dd>
    </div>
  );
}

