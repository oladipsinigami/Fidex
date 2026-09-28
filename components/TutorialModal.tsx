"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { GradeLetter } from "./RatingPlate";
import { LockGlyph } from "./Axis";

interface Step {
  id: string;
  badge: string;
  title: string;
  subtitle: string;
  explanation: string;
  keyPoints: string[];
  visualType: "grade" | "axes" | "killshots" | "paywall" | "wallet" | "ledger" | "agents";
}

const STEPS: Step[] = [
  {
    id: "overview",
    badge: "Step 1 of 7 · Core Concept",
    title: "What is ArcGrade?",
    subtitle: "A safety rating system before you deposit money.",
    explanation:
      "Think of ArcGrade as a restaurant health inspection letter grade (A, B, C, D, F) or a credit rating (like Moody's or S&P), but built specifically for crypto apps on Circle's Arc blockchain. It analyzes protocols to protect you from hacks, hidden developer backdoors, and unsustainable yields.",
    keyPoints: [
      "Grade A (85–100): Institutional reserve standard (USDC, Morpho, Aave)",
      "Grade B (70–84): Audited, high-liquidity apps with solid safety track records",
      "Grade C (55–69): Speculative or unproven bridges with moderate admin risk",
      "Grade D / F (<55): Danger zone: unaudited code or critical vulnerability",
    ],
    visualType: "grade",
  },
  {
    id: "axes",
    badge: "Step 2 of 7 · Risk Model",
    title: "The 9 Safety Axes",
    subtitle: "Why liquidity cannot hide a missing audit.",
    explanation:
      "Unlike simple averages that let high trading volume hide fatal code flaws, ArcGrade scores 9 separate risk dimensions and uses 'weakest link' compounding. If a protocol has $500M in deposits but has zero audits and a single admin master key, its grade drops sharply.",
    keyPoints: [
      "Code Security (20%) & Audits (14%): Bytecode safety and professional audit reviews",
      "Liquidity Depth (18%): Ability to withdraw without crashing the price",
      "Decentralization (15%): Multisig signers, timelocks, and freeze permissions",
      "Yield Sustainability (7%): Real organic trading fees vs fake inflationary emissions",
    ],
    visualType: "axes",
  },
  {
    id: "killshots",
    badge: "Step 3 of 7 · Worst-Case Scenarios",
    title: "What Breaks This Grade (Kill Shots)",
    subtitle: "Every nightmare scenario, explained in plain English.",
    explanation:
      "Every dossier features explicit 'Kill Shots'—pre-identified failure vectors that would immediately drop the grade or cause a total loss of funds. Instead of burying risks in 60-page PDF audits, we list the exact events that could get you wrecked.",
    keyPoints: [
      "Bridge Lockbox Drain: What happens if an off-chain bridge validator is compromised",
      "Collateral Liquidation Shock: What happens if an asset drops 40% in an hour",
      "Admin Key Unilateral Action: If a creator can freeze accounts without notice",
    ],
    visualType: "killshots",
  },
  {
    id: "unlocks",
    badge: "Step 4 of 7 · Token Dilution",
    title: "Unlock Calendars & Insider Float",
    subtitle: "Know when venture capital and team tokens hit the market.",
    explanation:
      "Many tokens look profitable until early investors unlock millions of cheap tokens and dump them on retail buyers. ArcGrade tracks the exact dates, token quantities, and percentage of float unlocking so you are never blindsided by dilution.",
    keyPoints: [
      "Exact dates of upcoming vesting epochs",
      "Percentage of liquid market float unlocking",
      "Early backer vs team vs liquidity reward allocations",
    ],
    visualType: "ledger",
  },
  {
    id: "wallet-gate",
    badge: "Step 5 of 7 · Security Gate",
    title: "Wallet-Gated Protection",
    subtitle: "Why dossiers are locked until you connect a wallet.",
    explanation:
      "To prevent automated scraping, malicious bot extraction, and frontrunning, ArcGrade gates proprietary risk evaluations behind an authenticated Web3 connection. Connecting your Arc wallet verifies you as a human user or authorized agent.",
    keyPoints: [
      "Completely shields ratings and vulnerability data from malicious scrapers",
      "Connects seamlessly with MetaMask, Rabby, or Coinbase Wallet",
      "Operates natively on Circle Arc (Chain 5042 / Testnet 5042002)",
    ],
    visualType: "wallet",
  },
  {
    id: "paywall",
    badge: "Step 6 of 7 · Micropayments",
    title: "The 1-Cent ($0.01) Paywall",
    subtitle: "No $50/month subscriptions. Pay per report in USDC.",
    explanation:
      "Basic summaries are accessible, and full deep-dive dossiers cost exactly 1 penny ($0.01 USDC). Using Circle Gateway nanopayments and the x402 open standard, your wallet authorizes a sub-cent payment directly on Arc. No credit cards, no passwords, no recurring subscription traps.",
    keyPoints: [
      "One click, 1 cent ($0.01 USDC), valid for 24 hours on your device",
      "Settles in native USDC with sub-second finality on Circle Arc",
      "Protocols cannot buy higher grades; payments only unlock research",
    ],
    visualType: "paywall",
  },
  {
    id: "agents",
    badge: "Step 7 of 7 · AI Agents & Studio",
    title: "Built for Humans & AI Agents",
    subtitle: "How autonomous bots query ArcGrade before trading.",
    explanation:
      "ArcGrade is built for the coming era of AI portfolio managers. Autonomous trading bots and python scripts can ping our API, pay 1 cent automatically via the x402 protocol, read the JSON risk grade, and reject high-risk deposits before committing funds.",
    keyPoints: [
      "REST & x402 API endpoints at /api/v1/grade/[slug]",
      "Analyst Studio at /studio where researchers cryptographically sign ratings",
      "Unified Ledger covering all 53+ decentralized applications on Arc",
    ],
    visualType: "agents",
  },
];

export function TutorialModal() {
  const [open, setOpen] = useState(false);
  const [stepIndex, setStepIndex] = useState(0);

  useEffect(() => {
    const handleOpen = () => setOpen(true);
    window.addEventListener("arcgrade:tutorial", handleOpen);
    return () => window.removeEventListener("arcgrade:tutorial", handleOpen);
  }, []);

  if (!open) return null;

  const current = STEPS[stepIndex];
  const isFirst = stepIndex === 0;
  const isLast = stepIndex === STEPS.length - 1;

  const next = () => {
    if (!isLast) setStepIndex((i) => i + 1);
    else setOpen(false);
  };

  const prev = () => {
    if (!isFirst) setStepIndex((i) => i - 1);
  };

  return (
    <div className="no-print fixed inset-0 z-[100] flex items-center justify-center p-4">
      {/* Backdrop */}
      <button
        aria-label="Close tutorial"
        onClick={() => setOpen(false)}
        className="absolute inset-0 bg-void/85 backdrop-blur-md transition-opacity"
      />

      {/* Modal Dialog */}
      <div className="plate relative max-w-2xl w-full border border-gold/40 bg-panel/95 p-6 sm:p-8 shadow-[0_0_60px_rgba(0,0,0,0.85)] backdrop-blur-2xl">
        {/* Top Stepper Bar */}
        <div className="flex items-center justify-between border-b border-paper/[0.08] pb-4">
          <div className="flex items-center gap-2">
            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-gold/15 text-gold text-xs font-mono font-semibold">
              ?
            </span>
            <span className="label-xs font-mono uppercase tracking-widest text-gold">
              {current.badge}
            </span>
          </div>

          <div className="flex items-center gap-3">
            {/* Step progress pills */}
            <div className="flex items-center gap-1.5">
              {STEPS.map((s, i) => (
                <button
                  key={s.id}
                  onClick={() => setStepIndex(i)}
                  className={`h-1.5 rounded-full transition-all ${
                    i === stepIndex
                      ? "w-6 bg-gold"
                      : i < stepIndex
                      ? "w-2 bg-gold/40"
                      : "w-2 bg-paper/15"
                  }`}
                  aria-label={`Go to step ${i + 1}`}
                />
              ))}
            </div>

            <button
              onClick={() => setOpen(false)}
              className="text-faint hover:text-paper text-lg font-mono leading-none ml-2"
              title="Close Tutorial"
            >
              &times;
            </button>
          </div>
        </div>

        {/* Content Body */}
        <div className="mt-6">
          <h2 className="font-display text-2xl sm:text-3xl text-paper">{current.title}</h2>
          <p className="mt-1 text-[14px] text-gold font-medium">{current.subtitle}</p>
          <p className="mt-3.5 text-[14px] leading-relaxed text-quiet">{current.explanation}</p>

          {/* Interactive Feature Visual Preview */}
          <div className="mt-5 rounded-[2px] border border-paper/[0.08] bg-void/60 p-4">
            {current.visualType === "grade" && (
              <div className="flex items-center justify-around py-3">
                <div className="text-center">
                  <GradeLetter letter="A" className="text-4xl text-reserve" />
                  <p className="label-xs mt-1 text-reserve">Institutional Safe</p>
                </div>
                <div className="text-center">
                  <GradeLetter letter="B" className="text-4xl text-gold" />
                  <p className="label-xs mt-1 text-gold">Audited Solid</p>
                </div>
                <div className="text-center">
                  <GradeLetter letter="C" className="text-4xl text-caution" />
                  <p className="label-xs mt-1 text-caution">Speculative</p>
                </div>
                <div className="text-center">
                  <GradeLetter letter="F" className="text-4xl text-stop" />
                  <p className="label-xs mt-1 text-stop">Danger Zone</p>
                </div>
              </div>
            )}

            {current.visualType === "axes" && (
              <div className="space-y-2 py-1 font-mono text-[12px]">
                <div className="flex justify-between text-paper/85">
                  <span>Security (Code math)</span>
                  <span className="text-reserve">94/100</span>
                </div>
                <div className="h-1.5 w-full rounded-[1px] bg-paper/10 overflow-hidden">
                  <div className="h-full bg-reserve" style={{ width: "94%" }} />
                </div>
                <div className="flex justify-between text-paper/85 pt-1">
                  <span>Decentralization (Admin keys)</span>
                  <span className="text-caution">58/100</span>
                </div>
                <div className="h-1.5 w-full rounded-[1px] bg-paper/10 overflow-hidden">
                  <div className="h-full bg-caution" style={{ width: "58%" }} />
                </div>
              </div>
            )}

            {current.visualType === "killshots" && (
              <div className="border border-stop/30 bg-stop/[0.06] p-3 text-[12px] text-paper/85">
                <p className="label-xs text-stop flex items-center gap-1 font-mono">
                  <span>⚠</span> Kill Shot: Unilateral Bridge Validator Freeze
                </p>
                <p className="mt-1 text-quiet">
                  If the 3 validator signers act or are subpoenaed, all bridged collateral halts.
                </p>
              </div>
            )}

            {current.visualType === "wallet" && (
              <div className="flex items-center justify-between p-2 font-mono text-xs">
                <span className="flex items-center gap-2 text-gold">
                  <LockGlyph />
                  <span>Encrypted by Wallet Gate</span>
                </span>
                <span className="border border-gold/40 bg-gold/10 px-2 py-0.5 text-[11px] text-gold">
                  Arc Web3 Only
                </span>
              </div>
            )}

            {current.visualType === "paywall" && (
              <div className="flex items-center justify-between p-2 font-mono text-xs">
                <span className="text-quiet">Unlock Full Report via x402</span>
                <span className="text-gold font-bold text-sm">$0.01 USDC on Arc</span>
              </div>
            )}

            {current.visualType === "ledger" && (
              <div className="flex justify-between items-center text-xs font-mono py-1">
                <span className="text-quiet">Next Unlock: 2,500,000 veAERO</span>
                <span className="text-gold">3.2% of Float</span>
              </div>
            )}

            {current.visualType === "agents" && (
              <div className="font-mono text-[11px] text-quiet">
                <p className="text-gold">$ curl -H &quot;PAYMENT-SIGNATURE: ...&quot; /api/v1/grade/aave-v4-arc</p>
                <p className="text-reserve mt-1">&gt; 200 OK &middot; letter: &quot;A&quot;, score: 92, status: &quot;pass&quot;</p>
              </div>
            )}

            {/* Bullet points */}
            <ul className="mt-4 space-y-2 border-t border-paper/[0.08] pt-3 text-[12.5px] text-paper/80">
              {current.keyPoints.map((point) => (
                <li key={point} className="flex items-start gap-2">
                  <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-gold" />
                  <span>{point}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Footer Navigation Buttons */}
        <div className="mt-8 flex items-center justify-between border-t border-paper/[0.08] pt-4">
          <button
            disabled={isFirst}
            onClick={prev}
            className="label-xs rounded-[2px] border border-paper/15 px-4 py-2.5 text-quiet transition-colors hover:border-gold/40 hover:text-paper disabled:opacity-30"
          >
            &larr; Previous
          </button>

          <div className="flex items-center gap-3">
            <Link
              href="/guide"
              onClick={() => setOpen(false)}
              className="label-xs text-faint hover:text-gold transition-colors hidden sm:inline-block mr-2"
            >
              Read Full Guide Page &rarr;
            </Link>

            <button
              onClick={next}
              className="flex items-center gap-2 rounded-[2px] border border-gold bg-gold/[0.14] px-5 py-2.5 font-display text-[14px] font-medium text-paper transition-all hover:bg-gold/[0.25]"
            >
              <span>{isLast ? "Got it, Enter ArcGrade" : "Next Step"}</span>
              {!isLast && <span>&rarr;</span>}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/** Trigger button that can be embedded anywhere */
export function TutorialTrigger({ label = "Tutorial & Guide" }: { label?: string }) {
  return (
    <button
      onClick={() => window.dispatchEvent(new CustomEvent("arcgrade:tutorial", { detail: {} }))}
      className="label-xs flex items-center gap-1.5 rounded-[2px] border border-gold/30 bg-gold/[0.08] px-2.5 py-1 text-gold transition-colors hover:border-gold hover:bg-gold/[0.16]"
      title="Open ArcGrade Interactive Tutorial"
    >
      <span className="font-mono text-xs">?</span>
      <span>{label}</span>
    </button>
  );
}
