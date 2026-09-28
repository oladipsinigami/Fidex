import Link from "next/link";
import { METHODOLOGY_VERSION } from "@/lib/grade";
import { PROTOCOLS, TOTAL_TVL } from "@/data/protocols";
import { formatUsd } from "@/lib/grade";

export function Footer() {
  const year = new Date().getFullYear();
  return (
    <footer className="mt-24 border-t border-paper/[0.07] bg-sunk">
      <div className="mx-auto max-w-[1120px] px-5 py-12">
        <div className="grid gap-10 md:grid-cols-[2fr_1fr_1fr]">
          <div>
            <p className="font-display text-xl text-paper">ArcGrade</p>
            <p className="mt-3 max-w-sm text-[13px] leading-relaxed text-quiet">
              Risk is part of investing. It should be informed and calculated — before
              the deposit, not after the exploit.
            </p>
            <p className="num mt-4 text-[11px] text-faint">
              {PROTOCOLS.length} names rated &middot; {formatUsd(TOTAL_TVL)} tracked
            </p>
          </div>

            <div>
            <p className="label-xs">Product</p>
            <ul className="mt-4 space-y-2.5 text-[13px] text-quiet">
              <li><Link href="/markets" className="hover:text-gold">Markets</Link></li>
              <li><Link href="/guide" className="hover:text-gold">Tutorial &amp; Guide</Link></li>
              <li><Link href="/arc" className="hover:text-gold">Live universe</Link></li>
              <li><Link href="/methodology" className="hover:text-gold">Methodology</Link></li>
              <li><Link href="/agents" className="hover:text-gold">Agent API</Link></li>
            </ul>
          </div>

          <div>
            <p className="label-xs">Chain</p>
            <ul className="mt-4 space-y-2.5 text-[13px] text-quiet">
              <li className="num">Circle Arc Testnet &middot; 5042002</li>
              <li className="num">Gas &amp; payments in USDC</li>
              <li className="num">x402 / Gateway</li>
            </ul>
          </div>
        </div>

        <div className="rule-draw my-8" />

        <div className="flex flex-col gap-3 text-[11px] text-faint md:flex-row md:items-center md:justify-between">
          <p className="num">
            Methodology {METHODOLOGY_VERSION} &middot; © {year}
          </p>
          <p className="max-w-xl leading-relaxed">
            Not financial advice. Not a credit rating. ArcGrade publishes a structured
            read of how a protocol can fail, not a prediction of price. Protocols cannot
            buy a letter.
          </p>
        </div>
      </div>
    </footer>
  );
}
