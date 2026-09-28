import type { Protocol } from "@/lib/types";

/**
 * The decision module. Deliberately blunt: a B is a green path, a C is amber
 * with conditions, a D/F refuses the savings-account framing outright.
 */
export function DecisionCard({ protocol: p }: { protocol: Protocol }) {
  const letter = p.letter;
  const band =
    letter === "A" || letter === "B"
      ? { tone: "reserve" as const, head: "Green path", act: "Size as core collateral." }
      : letter === "C"
        ? {
            tone: "caution" as const,
            head: "Amber, with conditions",
            act: "Size down. Re-check the weakest axis monthly.",
          }
        : {
            tone: "stop" as const,
            head: "Do not size this like a savings account",
            act: "Treat as speculative. Small size, or pass.",
          };

  const color =
    band.tone === "reserve"
      ? "text-reserve"
      : band.tone === "caution"
        ? "text-caution"
        : "text-stop";
  const border =
    band.tone === "reserve"
      ? "border-reserve/30"
      : band.tone === "caution"
        ? "border-caution/30"
        : "border-stop/35";

  return (
    <div className={`plate h-full p-7 ${border}`}>
      <p className="label-xs">Would I deposit?</p>
      <h3 className={`mt-4 font-display text-2xl leading-snug ${color}`}>{band.head}</h3>
      <p className="mt-4 text-[13px] leading-relaxed text-quiet">{band.act}</p>

      <ul className="mt-6 space-y-3 border-t border-paper/[0.07] pt-5">
        {p.killShots.slice(0, 2).map((k) => (
          <li key={k.title} className="text-[12.5px] leading-relaxed text-quiet">
            <span className="text-paper/85">{k.title}.</span> {k.detail}
          </li>
        ))}
      </ul>

      <p className="mt-6 text-[11px] leading-relaxed text-faint">
        A letter is a read on structure, not a forecast. Position size is yours to
        decide.
      </p>
    </div>
  );
}
