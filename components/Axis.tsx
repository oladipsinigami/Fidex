import type { Protocol } from "@/lib/types";
import { bandFor, toneFor } from "@/lib/grade";

/** SVG axis bar. Fills left-to-right, staggered 40ms after the letter. */
export function AxisBar({
  score,
  index,
  locked,
  weight,
}: {
  score: number;
  index: number;
  locked: boolean;
  weight: number;
}) {
  const tone =
    score >= 85 ? "#3b7a57" : score >= 70 ? "#d9822b" : score >= 55 ? "#bf5b30" : "#a63a3a";
  return (
    <div className="relative h-[8px] w-full overflow-hidden rounded-[1px] bg-[var(--line)]">
      <div
        className="axis-bar-fill h-full transition-all duration-500 ease-out"
        style={{
          width: `${score}%`,
          background: locked ? "var(--line-strong)" : tone,
          animationDelay: `${index * 40}ms`,
        }}
      />
      {weight === 0 && (
        <span className="absolute -top-5 right-0 font-mono text-[10px] uppercase text-[var(--mute)]">display only</span>
      )}
    </div>
  );
}

export function AxisRow({
  axis,
  index,
  paid,
  locked,
}: {
  axis: Protocol["axes"][number];
  index: number;
  paid: boolean;
  locked?: boolean;
}) {
  const isLocked = locked ?? !paid;
  const tone = toneFor(bandFor(axis.score));
  return (
    <div className="border-t border-[var(--line)] py-6 first:border-t-0">
      <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-2">
        <div className="flex items-baseline gap-3">
          <h3 className="font-campaign text-xl font-bold uppercase tracking-tight text-[var(--ink)]">{axis.label}</h3>
          {axis.weight > 0 && (
            <span className="font-mono text-[10px] uppercase text-[var(--mute)]">
              w {(axis.weight * 100).toFixed(0)}%
            </span>
          )}
        </div>
        {paid ? (
          <span className="font-mono text-sm font-bold" style={{ color: tone.ink }}>
            {axis.score}
          </span>
        ) : (
          <span className="font-mono text-xs uppercase inline-flex items-center gap-1.5 text-[var(--mute)]">
            <LockGlyph />
            Locked
          </span>
        )}
      </div>

      <div className="mt-3">
        <AxisBar score={axis.score} index={index} locked={isLocked} weight={axis.weight} />
      </div>

      <p className="mt-3 max-w-[68ch] text-[13px] leading-relaxed text-[var(--mute)]">
        {paid ? axis.evidence : axis.summary}
      </p>

      {paid && axis.citations.length > 0 && (
        <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-2">
          {axis.citations.map((cit) => (
            <li key={cit.href + cit.label}>
              <a
                href={cit.href}
                target="_blank"
                rel="noopener noreferrer"
                className="font-mono text-[10.5px] uppercase tracking-[0.1em] text-[var(--gold)] hover:underline"
              >
                {cit.kind} &middot; {cit.label}
              </a>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function LockGlyph() {
  return (
    <svg width="9" height="11" viewBox="0 0 9 11" fill="none" aria-hidden>
      <rect x="0.75" y="4.75" width="7.5" height="5.5" stroke="currentColor" strokeWidth="1" />
      <path d="M2.25 4.75V3a2.25 2.25 0 0 1 4.5 0v1.75" stroke="currentColor" strokeWidth="1" />
    </svg>
  );
}

/** Locked teaser: bars at 30% opacity, no numbers. */
export function LockedAxes({ protocol }: { protocol: Protocol }) {
  return (
    <div aria-hidden className="pointer-events-none select-none">
      {protocol.axes.map((a, i) => (
        <div key={a.id} className="border-t border-[var(--line)] py-5 opacity-40 first:border-t-0">
          <div className="flex items-baseline justify-between">
            <h3 className="font-campaign text-lg font-bold uppercase tracking-tight text-[var(--ink)]">{a.label}</h3>
            <span className="font-mono text-xs uppercase inline-flex items-center gap-1.5 text-[var(--mute)]">
              <LockGlyph />
            </span>
          </div>
          <div className="mt-3 h-[6px] w-full overflow-hidden rounded-[1px] bg-[var(--line)]">
            <div
              className="h-full bg-[var(--ink)] opacity-30"
              style={{ width: `${a.score}%`, transitionDelay: `${i * 40}ms` }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}
