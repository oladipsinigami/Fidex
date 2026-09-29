import type { Metadata } from "next";
import Link from "next/link";
import { GradeLetter } from "@/components/RatingPlate";
import { LockGlyph } from "@/components/Axis";
import { TutorialTrigger } from "@/components/TutorialModal";
import { WalkthroughTrigger } from "@/components/WalkthroughTour";
import { WalkthroughLab } from "@/components/WalkthroughLab";

export const metadata: Metadata = {
  title: "Tutorial & Guide — How Fidex Works",
  description:
    "Complete breakdown of every feature on Fidex: letter grades, the 9 risk axes, kill shots, unlock calendars, x402 nanopayments, and the security gate.",
};

export default function GuidePage() {
  return (
    <div className="mx-auto max-w-[1120px] px-5 py-14">
      {/* Header */}
      <header className="border-b border-paper/[0.08] pb-10">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <p className="label-xs text-gold">Feature Tutorial &middot; Comprehensive Guide</p>
          <div className="flex flex-wrap items-center gap-2.5">
            <WalkthroughTrigger label="Start Spotlight Walkthrough" />
            <TutorialTrigger label="7-Step Overview" />
          </div>
        </div>
        <h1 className="mt-4 font-display text-[clamp(2.5rem,5vw,3.75rem)] leading-[1.02] tracking-[-0.02em] text-paper">
          How Fidex Works
        </h1>
        <p className="mt-4 max-w-2xl text-[16px] leading-relaxed text-quiet">
          A complete, layman-accessible guide explaining every feature, metric, and safety
          mechanism built into Fidex. Learn how we evaluate risk on Circle Arc before you
          commit your capital.
        </p>
      </header>

      {/* Interactive Hands-on Walkthrough Simulator */}
      <section className="py-12 border-b border-paper/[0.08]">
        <WalkthroughLab />
      </section>

      {/* Feature 1: Letter Grades */}
      <section className="py-12 border-b border-paper/[0.08]">
        <div className="grid gap-10 lg:grid-cols-12">
          <div className="lg:col-span-5">
            <span className="font-mono text-xs text-gold/80">FEATURE 01</span>
            <h2 className="mt-2 font-display text-2xl sm:text-3xl text-paper">
              The Letter Grade System
            </h2>
            <p className="mt-3 text-[14px] leading-relaxed text-quiet">
              Every protocol is assigned a letter from <strong>A to F</strong> and a composite score
              from <strong>0 to 100</strong>. This works just like a school report card or a restaurant
              health inspection score.
            </p>
            <p className="mt-3 text-[13px] leading-relaxed text-faint">
              <strong>The Weakest-Link Rule:</strong> Unlike naive averages that let $500M in trading
              volume mask a fatal smart contract backdoor, Fidex uses multiplicative compounding.
              A critical vulnerability in code security or admin keys drags down the entire letter.
            </p>
          </div>

          <div className="lg:col-span-7">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="plate p-5 border-l-2 border-l-reserve">
                <div className="flex items-center justify-between">
                  <GradeLetter letter="A" className="text-4xl text-reserve" />
                  <span className="font-mono text-xs text-reserve">Score 85–100</span>
                </div>
                <h3 className="mt-3 font-display text-base text-paper">Institutional Safe</h3>
                <p className="mt-1 text-[12px] leading-relaxed text-quiet">
                  Highest-grade reserve standard. Formal bytecode verification, distributed
                  timelocks, and multi-year production resilience (e.g. native USDC, Morpho Blue, Aave V4).
                </p>
              </div>

              <div className="plate p-5 border-l-2 border-l-gold">
                <div className="flex items-center justify-between">
                  <GradeLetter letter="B" className="text-4xl text-gold" />
                  <span className="font-mono text-xs text-gold">Score 70–84</span>
                </div>
                <h3 className="mt-3 font-display text-base text-paper">Audited & Solid</h3>
                <p className="mt-1 text-[12px] leading-relaxed text-quiet">
                  Battle-tested protocols with high liquidity and reputable third-party audits, but
                  manageable operational or market dependency risks (e.g. Aerodrome, Arctide, Wrapped Ether).
                </p>
              </div>

              <div className="plate p-5 border-l-2 border-l-caution">
                <div className="flex items-center justify-between">
                  <GradeLetter letter="C" className="text-4xl text-caution" />
                  <span className="font-mono text-xs text-caution">Score 55–69</span>
                </div>
                <h3 className="mt-3 font-display text-base text-paper">Speculative Tier</h3>
                <p className="mt-1 text-[12px] leading-relaxed text-quiet">
                  Moderate central admin authority, newer contract deployments, or reliance on
                  off-chain bridge validators without emergency escape hatches.
                </p>
              </div>

              <div className="plate p-5 border-l-2 border-l-stop">
                <div className="flex items-center justify-between">
                  <GradeLetter letter="F" className="text-4xl text-stop" />
                  <span className="font-mono text-xs text-stop">Score &lt; 55</span>
                </div>
                <h3 className="mt-3 font-display text-base text-paper">High Danger Zone</h3>
                <p className="mt-1 text-[12px] leading-relaxed text-quiet">
                  Unaudited bytecodes, unilateral developer freeze authority, extreme whale
                  concentration, or unsustainable hyper-inflationary yield emissions.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Feature 2: The 9 Axes */}
      <section className="py-12 border-b border-paper/[0.08]">
        <div className="grid gap-10 lg:grid-cols-12">
          <div className="lg:col-span-5">
            <span className="font-mono text-xs text-gold/80">FEATURE 02</span>
            <h2 className="mt-2 font-display text-2xl sm:text-3xl text-paper">
              The Nine Safety Axes
            </h2>
            <p className="mt-3 text-[14px] leading-relaxed text-quiet">
              We evaluate every protocol across nine distinct risk dimensions. Each axis has a specific
              mathematical weight reflecting how catastrophic a failure on that axis would be.
            </p>
            <p className="mt-3 text-[13px] leading-relaxed text-faint">
              Every score on a paid dossier links directly to external proof: block explorer bytecodes,
              audit PDF reports, or on-chain governance vote logs.
            </p>
          </div>

          <div className="lg:col-span-7 space-y-3">
            {[
              {
                title: "1. Code Security (Weight: 20%)",
                desc: "Evaluates reentrancy protections, mathematical edge cases, and upgradeability backdoors.",
              },
              {
                title: "2. Liquidity Depth (Weight: 18%)",
                desc: "Tests how much capital you can deposit or withdraw without causing severe price slippage.",
              },
              {
                title: "3. Decentralization (Weight: 15%)",
                desc: "Audits admin multisigs, emergency pause functions, and whether one person can freeze your money.",
              },
              {
                title: "4. Professional Audits (Weight: 14%)",
                desc: "Verifies reports from top security firms (OpenZeppelin, Spearbit, Trail of Bits) and checks for unresolved bugs.",
              },
              {
                title: "5. Holder Concentration (Weight: 10%)",
                desc: "Measures whether top insider wallets own a disproportionate share of liquidity or voting power.",
              },
              {
                title: "6. Production History (Weight: 8%)",
                desc: "How long the code has run on mainnet without a security exploit or economic depeg event.",
              },
              {
                title: "7. DAO Governance (Weight: 8%)",
                desc: "Examines proposal timelocks, quorum requirements, and community voting participation.",
              },
              {
                title: "8. Yield Sustainability (Weight: 7%)",
                desc: "Separates real cash flows (swap and borrow fees) from inflationary, worthless token printing.",
              },
              {
                title: "9. Arc Fit (Display Axis)",
                desc: "Tracks whether contracts run natively on Circle Arc vs relying on cross-chain bridges.",
              },
            ].map((ax) => (
              <div key={ax.title} className="plate p-4">
                <h3 className="font-display text-sm text-paper font-medium">{ax.title}</h3>
                <p className="mt-1 text-[12px] text-quiet leading-relaxed">{ax.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Feature 3: Failure Kill Shots */}
      <section className="py-12 border-b border-paper/[0.08]">
        <div className="grid gap-10 lg:grid-cols-12">
          <div className="lg:col-span-5">
            <span className="font-mono text-xs text-gold/80">FEATURE 03</span>
            <h2 className="mt-2 font-display text-2xl sm:text-3xl text-paper">
              What Breaks This Grade (Kill Shots)
            </h2>
            <p className="mt-3 text-[14px] leading-relaxed text-quiet">
              Instead of hiding critical risks behind polite language or dense math, each protocol dossier
              includes explicit <strong>Kill Shots</strong>: the exact disaster scenarios that would destroy
              the protocol or cause a total loss.
            </p>
          </div>

          <div className="lg:col-span-7">
            <div className="space-y-3">
              <div className="plate p-5 border border-stop/30 bg-stop/[0.04]">
                <span className="label-xs text-stop font-mono uppercase">Sample Kill Shot &middot; Security Axis</span>
                <h3 className="mt-2 font-display text-base text-paper">Bridge Lockbox Custody Drain</h3>
                <p className="mt-1.5 text-[12.5px] leading-relaxed text-quiet">
                  If the Ethereum L1 custody contract were drained or the validator signer quorum compromised,
                  bridged assets on Arc would depeg to near-zero with no smart contract recourse.
                </p>
              </div>

              <div className="plate p-5 border border-caution/30 bg-caution/[0.04]">
                <span className="label-xs text-caution font-mono uppercase">Sample Kill Shot &middot; Liquidity Axis</span>
                <h3 className="mt-2 font-display text-base text-paper">Sudden Market Liquidation Cascade</h3>
                <p className="mt-1.5 text-[12.5px] leading-relaxed text-quiet">
                  A rapid 40% drawdown in spot collateral could trigger automated liquidations that overwhelm
                  on-chain DEX orderbooks, leaving lending pools with unhedged bad debt.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Feature 4: Wallet Security Gate */}
      <section className="py-12 border-b border-paper/[0.08]">
        <div className="grid gap-10 lg:grid-cols-12">
          <div className="lg:col-span-5">
            <span className="font-mono text-xs text-gold/80">FEATURE 04</span>
            <h2 className="mt-2 font-display text-2xl sm:text-3xl text-paper">
              The Wallet Security Gate
            </h2>
            <p className="mt-3 text-[14px] leading-relaxed text-quiet">
              Why are protocol dossiers locked until you connect a wallet?
            </p>
            <p className="mt-3 text-[13px] leading-relaxed text-faint">
              Proprietary risk grades, vulnerabilities, and killshots are high-value intelligence.
              To protect the platform from automated scraping, commercial web crawlers, and frontrunning
              bots, dossiers are encrypted behind an authenticated Web3 connection on Arc.
            </p>
          </div>

          <div className="lg:col-span-7">
            <div className="plate p-6 border border-gold/40">
              <div className="flex items-center gap-2 text-gold">
                <LockGlyph />
                <span className="label-xs font-mono uppercase tracking-wider text-gold">
                  Security Gate Active
                </span>
              </div>
              <h3 className="mt-3 font-display text-lg text-paper">
                Zero Personal Data Required
              </h3>
              <p className="mt-2 text-[13px] leading-relaxed text-quiet">
                Connecting your wallet does not share your name, email, or passwords. It simply verifies
                that you possess a legitimate Web3 address on Circle Arc (Chain ID 5042) to decrypt the
                research surface.
              </p>
              <div className="mt-4 flex flex-wrap gap-2 text-[11px] font-mono text-faint">
                <span className="border border-paper/10 px-2.5 py-1">MetaMask</span>
                <span className="border border-paper/10 px-2.5 py-1">Rabby</span>
                <span className="border border-paper/10 px-2.5 py-1">Coinbase Wallet</span>
                <span className="border border-paper/10 px-2.5 py-1">Circle Web3 Wallet</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Feature 5: The 1-Cent x402 Paywall */}
      <section className="py-12 border-b border-paper/[0.08]">
        <div className="grid gap-10 lg:grid-cols-12">
          <div className="lg:col-span-5">
            <span className="font-mono text-xs text-gold/80">FEATURE 05</span>
            <h2 className="mt-2 font-display text-2xl sm:text-3xl text-paper">
              The 1-Cent ($0.01) Paywall
            </h2>
            <p className="mt-3 text-[14px] leading-relaxed text-quiet">
              Fidex rejects predatory $50/month subscriptions. Instead, you pay exactly{" "}
              <strong>1 penny ($0.01 USDC)</strong> per dossier using the <strong>x402 protocol</strong>.
            </p>
            <p className="mt-3 text-[13px] leading-relaxed text-faint">
              Your payment settles gaslessly in native USDC via Circle Gateway on Arc. A cryptographic
              receipt is minted to your device, granting 24-hour unredacted access.
            </p>
          </div>

          <div className="lg:col-span-7">
            <div className="plate p-6">
              <h3 className="font-display text-lg text-paper">How x402 Micropayments Work</h3>
              <ol className="mt-4 space-y-3 text-[13px] text-quiet">
                <li className="flex items-start gap-3">
                  <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-gold/15 text-gold font-mono text-xs">
                    1
                  </span>
                  <span>
                    Your wallet signs an authorization payload for <strong>0.01 USDC</strong> (10,000 atomic units).
                  </span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-gold/15 text-gold font-mono text-xs">
                    2
                  </span>
                  <span>
                    Circle Gateway validates the signature and credits the payment in native USDC on Arc.
                  </span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-gold/15 text-gold font-mono text-xs">
                    3
                  </span>
                  <span>
                    The dossier unlocks instantly on your screen, revealing all 9 unredacted evidence summaries and primary audit citations.
                  </span>
                </li>
              </ol>
            </div>
          </div>
        </div>
      </section>

      {/* Feature 6: All-Markets Ledger & Agent API */}
      <section className="py-12">
        <div className="grid gap-10 lg:grid-cols-12">
          <div className="lg:col-span-5">
            <span className="font-mono text-xs text-gold/80">FEATURE 06</span>
            <h2 className="mt-2 font-display text-2xl sm:text-3xl text-paper">
              Ecosystem Ledger & AI Agent API
            </h2>
            <p className="mt-3 text-[14px] leading-relaxed text-quiet">
              Fidex tracks <strong>53+ protocols and assets</strong> across the entire Circle Arc
              ecosystem—from DEXs and launchpads to bridges and privacy tools.
            </p>
            <p className="mt-3 text-[13px] leading-relaxed text-faint">
              Autonomous AI agents can query any protocol via our REST API at{" "}
              <code className="text-gold font-mono">GET /api/v1/grade/[slug]</code> to make programmatic
              allocation decisions before routing liquidity.
            </p>
          </div>

          <div className="lg:col-span-7">
            <div className="grid gap-4 sm:grid-cols-2">
              <Link href="/markets" className="plate p-5 hover:border-gold/50 transition-colors block">
                <span className="label-xs text-gold">Explorer</span>
                <h3 className="mt-2 font-display text-base text-paper">All Markets Ledger</h3>
                <p className="mt-1 text-[12px] text-quiet">
                  Browse, filter, and sort every dApp on Arc by TVL, letter grade, and 7-day momentum.
                </p>
                <span className="link-gold label-xs mt-4 inline-block">Open Ledger &rarr;</span>
              </Link>

              <Link href="/agents" className="plate p-5 hover:border-gold/50 transition-colors block">
                <span className="label-xs text-gold">API Documentation</span>
                <h3 className="mt-2 font-display text-base text-paper">Autonomous Agent API</h3>
                <p className="mt-1 text-[12px] text-quiet">
                  Code samples for Python, Node.js, and curl to integrate Fidex into automated bots.
                </p>
                <span className="link-gold label-xs mt-4 inline-block">Read API Docs &rarr;</span>
              </Link>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
