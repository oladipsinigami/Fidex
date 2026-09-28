"use client";

import { useState } from "react";
import { GradeLetter } from "./RatingPlate";
import { LockGlyph } from "./Axis";
import { WalkthroughTrigger } from "./WalkthroughTour";
import { SITE_URL } from "@/lib/site";

export function WalkthroughLab() {
  const [activeTab, setActiveTab] = useState<"formula" | "wallet" | "paywall" | "killshot">("formula");

  // Formula Simulator State
  const [codeScore, setCodeScore] = useState(85);
  const [liqScore, setLiqScore] = useState(90);
  const [adminScore, setAdminScore] = useState(80);
  const [auditScore, setAuditScore] = useState(85);

  // Compute composite score with weakest link penalty
  const rawAverage = Math.round((codeScore * 0.35) + (liqScore * 0.25) + (adminScore * 0.2) + (auditScore * 0.2));
  const minAxis = Math.min(codeScore, liqScore, adminScore, auditScore);
  // Penalty if minAxis is low
  const penalty = minAxis < 60 ? Math.round((60 - minAxis) * 0.6) : 0;
  const simulatedScore = Math.max(0, Math.min(100, rawAverage - penalty));

  let simulatedLetter: "A" | "B" | "C" | "D" | "F" = "F";
  let letterColor = "text-stop";
  let verdict = "Severe failure risks identified in core axes.";

  if (simulatedScore >= 85) {
    simulatedLetter = "A";
    letterColor = "text-reserve";
    verdict = "Institutional standard. Formal bytecode safety and distributed control.";
  } else if (simulatedScore >= 70) {
    simulatedLetter = "B";
    letterColor = "text-gold";
    verdict = "Audited and sound with strong liquidity and manageable risks.";
  } else if (simulatedScore >= 55) {
    simulatedLetter = "C";
    letterColor = "text-caution";
    verdict = "Speculative tier with elevated admin key or dependency exposure.";
  }

  // Wallet Gate Simulator State
  const [isWalletConnected, setIsWalletConnected] = useState(false);

  // Paywall Simulator State
  const [paywallUnlocked, setPaywallUnlocked] = useState(false);
  const [txHash, setTxHash] = useState<string | null>(null);

  const simulatePayment = () => {
    setPaywallUnlocked(true);
    setTxHash("0x" + Array.from({ length: 64 }, () => Math.floor(Math.random() * 16).toString(16)).join(""));
  };

  const resetPayment = () => {
    setPaywallUnlocked(false);
    setTxHash(null);
  };

  // Kill-Shot Simulator State
  const [activeScenario, setActiveScenario] = useState<number | null>(null);
  const scenarios = [
    {
      title: "Bridge Lockbox Drain",
      description: "Off-chain relayer validators compromised. 15,000 WETH drained from reserve vault.",
      impact: "Instant F grade. System halted. Emergency escape hatch triggered.",
    },
    {
      title: "Collateral Flash Crash (-45%)",
      description: "Underlying token drops 45% in 8 minutes. Liquidator bots encounter high slippage.",
      impact: "Downgrade to C (61). Bad debt buffer absorbing losses.",
    },
    {
      title: "Deployer Admin Key Compromise",
      description: "Single private key attempts to update proxy implementation without timelock.",
      impact: "Downgrade to D (42). Multidimensional penalty triggered.",
    },
  ];

  return (
    <div className="plate border border-gold/30 bg-panel/90 p-6 sm:p-8 shadow-[0_0_50px_rgba(0,0,0,0.5)]">
      {/* Top Bar */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-paper/[0.08] pb-6">
        <div>
          <span className="font-mono text-xs text-gold uppercase tracking-wider">
            Hands-on Testing Environment
          </span>
          <h2 className="mt-1 font-display text-2xl sm:text-3xl text-paper">
            Interactive Walkthrough Lab
          </h2>
          <p className="mt-1 text-[13px] text-quiet">
            Simulate and test how each ArcGrade feature calculates risk in real time.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <WalkthroughTrigger label="Start On-Screen Tour" />
        </div>
      </div>

      {/* Lab Nav Tabs */}
      <div className="mt-6 flex flex-wrap gap-2 border-b border-paper/[0.08] pb-3">
        {[
          { id: "formula", label: "1. Grade Formula Simulator" },
          { id: "wallet", label: "2. Security Gate Simulator" },
          { id: "paywall", label: "3. 1¢ x402 Nanopayment Lab" },
          { id: "killshot", label: "4. Kill-Shot Stress Tester" },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as typeof activeTab)}
            className={`label-xs rounded-[2px] px-3.5 py-2 transition-all ${
              activeTab === tab.id
                ? "border border-gold bg-gold/[0.16] text-paper font-medium"
                : "border border-paper/10 text-quiet hover:border-paper/20 hover:text-paper"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* TAB 1: FORMULA SIMULATOR */}
      {activeTab === "formula" && (
        <div className="mt-8 grid gap-8 lg:grid-cols-12">
          <div className="lg:col-span-7 space-y-5">
            <div>
              <h3 className="font-display text-lg text-paper">
                Weakest-Link Compounding Demo
              </h3>
              <p className="mt-1 text-[13px] text-quiet">
                Drag any individual axis down to observe how ArcGrade prevents high liquidity from
                hiding a critical smart contract flaw.
              </p>
            </div>

            {/* Slider 1 */}
            <div className="plate p-4 border border-paper/10 bg-void/40">
              <div className="flex justify-between text-xs">
                <span className="font-medium text-paper">Code Security (20%)</span>
                <span className="num font-mono text-gold">{codeScore}/100</span>
              </div>
              <input
                type="range"
                min="10"
                max="100"
                value={codeScore}
                onChange={(e) => setCodeScore(Number(e.target.value))}
                className="mt-2 w-full accent-[#E5B75F]"
              />
              <span className="text-[11px] text-faint">Bytecode audit verification & formal proofs</span>
            </div>

            {/* Slider 2 */}
            <div className="plate p-4 border border-paper/10 bg-void/40">
              <div className="flex justify-between text-xs">
                <span className="font-medium text-paper">Liquidity Depth (18%)</span>
                <span className="num font-mono text-gold">{liqScore}/100</span>
              </div>
              <input
                type="range"
                min="10"
                max="100"
                value={liqScore}
                onChange={(e) => setLiqScore(Number(e.target.value))}
                className="mt-2 w-full accent-[#E5B75F]"
              />
              <span className="text-[11px] text-faint">Slippage on $1M withdrawal & pool balance</span>
            </div>

            {/* Slider 3 */}
            <div className="plate p-4 border border-paper/10 bg-void/40">
              <div className="flex justify-between text-xs">
                <span className="font-medium text-paper">Decentralization & Timelocks (15%)</span>
                <span className="num font-mono text-gold">{adminScore}/100</span>
              </div>
              <input
                type="range"
                min="10"
                max="100"
                value={adminScore}
                onChange={(e) => setAdminScore(Number(e.target.value))}
                className="mt-2 w-full accent-[#E5B75F]"
              />
              <span className="text-[11px] text-faint">Multisig threshold & 48h emergency timelock</span>
            </div>

            {/* Slider 4 */}
            <div className="plate p-4 border border-paper/10 bg-void/40">
              <div className="flex justify-between text-xs">
                <span className="font-medium text-paper">Audit Track Record (14%)</span>
                <span className="num font-mono text-gold">{auditScore}/100</span>
              </div>
              <input
                type="range"
                min="10"
                max="100"
                value={auditScore}
                onChange={(e) => setAuditScore(Number(e.target.value))}
                className="mt-2 w-full accent-[#E5B75F]"
              />
              <span className="text-[11px] text-faint">Top-tier reviews (Certora, OpenZeppelin, Spearbit)</span>
            </div>
          </div>

          {/* Result Card */}
          <div className="lg:col-span-5 flex flex-col justify-center">
            <div className="plate border border-gold/40 bg-void/80 p-6 text-center">
              <span className="label-xs text-faint uppercase tracking-wider">Simulated Output</span>
              <div className="mt-4 flex items-center justify-center gap-4">
                <GradeLetter letter={simulatedLetter} className={`text-6xl ${letterColor}`} />
                <div className="text-left">
                  <div className="num font-mono text-3xl font-bold text-paper">{simulatedScore}</div>
                  <span className="text-xs text-faint font-mono">/ 100 composite</span>
                </div>
              </div>

              <div className="rule-draw my-4" />

              <p className="text-[13px] leading-relaxed text-quiet">{verdict}</p>

              {penalty > 0 && (
                <div className="mt-4 rounded-[2px] border border-stop/30 bg-stop/10 p-2.5 text-[11px] text-stop">
                  <strong>Weakest-Link Penalty (-{penalty} pts):</strong> One or more critical axes fell
                  below minimum safety thresholds (&lt;60).
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: WALLET GATE SIMULATOR */}
      {activeTab === "wallet" && (
        <div className="mt-8 space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <h3 className="font-display text-lg text-paper">Web3 Anti-Scraper Security Gate</h3>
              <p className="mt-1 text-[13px] text-quiet">
                Toggle the switch below to see how dossiers are shielded from unauthenticated bots.
              </p>
            </div>

            <button
              onClick={() => setIsWalletConnected((c) => !c)}
              className={`label-xs flex items-center gap-2 rounded-[2px] px-4 py-2 font-display text-sm transition-all ${
                isWalletConnected
                  ? "border border-reserve bg-reserve/15 text-reserve"
                  : "border border-gold bg-gold/20 text-gold"
              }`}
            >
              <span>{isWalletConnected ? "● Wallet Connected (0x71C...3aF)" : "○ Connect Simulated Wallet"}</span>
            </button>
          </div>

          {/* Dossier Mock View */}
          <div className="relative overflow-hidden rounded-[2px] border border-paper/10 bg-void p-6">
            {!isWalletConnected ? (
              <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-void/85 p-6 backdrop-blur-md">
                <div className="max-w-md text-center">
                  <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full border border-gold/40 bg-gold/10 text-gold scale-125">
                    <LockGlyph />
                  </div>
                  <h4 className="mt-3 font-display text-lg text-paper">Dossier Locked &middot; Connect Wallet</h4>
                  <p className="mt-2 text-xs text-quiet">
                    Proprietary rating models and kill-shot vectors are encrypted to prevent automated
                    scraping and frontrunning.
                  </p>
                  <button
                    onClick={() => setIsWalletConnected(true)}
                    className="mt-4 label-xs rounded-[2px] border border-gold bg-gold/20 px-4 py-2 text-gold hover:bg-gold/30"
                  >
                    Simulate Connect Wallet to Decrypt
                  </button>
                </div>
              </div>
            ) : null}

            <div className={`transition-all duration-300 ${!isWalletConnected ? "blur-sm opacity-20" : ""}`}>
              <div className="flex items-center justify-between border-b border-paper/[0.08] pb-4">
                <div>
                  <h4 className="font-display text-xl text-paper">Morpho Blue (Arc Native)</h4>
                  <span className="label-xs text-gold">Permissionless Isolated Lending</span>
                </div>
                <div className="flex items-center gap-3">
                  <GradeLetter letter="A" className="text-3xl text-reserve" />
                  <span className="num font-mono text-xl text-paper">94</span>
                </div>
              </div>

              <div className="mt-4 grid gap-3 sm:grid-cols-3">
                <div className="plate p-3 border border-paper/10">
                  <span className="text-xs text-faint">Code Security</span>
                  <div className="mt-1 font-mono text-sm text-reserve">98/100 (Formally Verified)</div>
                </div>
                <div className="plate p-3 border border-paper/10">
                  <span className="text-xs text-faint">Admin Timelock</span>
                  <div className="mt-1 font-mono text-sm text-reserve">Immutable Core</div>
                </div>
                <div className="plate p-3 border border-paper/10">
                  <span className="text-xs text-faint">Liquidity Slippage</span>
                  <div className="mt-1 font-mono text-sm text-gold">0.02% @ $1M</div>
                </div>
              </div>

              <div className="mt-4 rounded-[2px] border border-gold/20 bg-gold/[0.05] p-3 text-xs text-quiet">
                <strong>Decrypted Kill Shot:</strong> Market risk confined strictly to individual isolated
                vaults. Bad debt in market X cannot contaminate market Y.
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: 1¢ PAYWALL LAB */}
      {activeTab === "paywall" && (
        <div className="mt-8 space-y-6">
          <div>
            <h3 className="font-display text-lg text-paper">x402 Nanopayment Architecture</h3>
            <p className="mt-1 text-[13px] text-quiet">
              See how the open HTTP 402 protocol turns micro-settlements into instantaneous access with zero subscriptions.
            </p>
          </div>

          <div className="grid gap-6 md:grid-cols-2">
            {/* Interactive Request Card */}
            <div className="plate border border-paper/10 bg-void/50 p-5">
              <div className="flex items-center justify-between">
                <span className="font-mono text-xs text-faint">CLIENT / AGENT VIEW</span>
                <span className="num font-mono text-xs text-gold">Cost: 10,000 atomic ($0.01 USDC)</span>
              </div>

              <div className="mt-4 space-y-3 font-mono text-xs">
                <div className="rounded-[2px] bg-void p-3 border border-paper/10 text-quiet">
                  <span className="text-gold">GET</span> /api/v1/grade/aave-v4-arc<br />
                  <span className="text-faint">Host:</span> {new URL(SITE_URL).host}<br />
                  <span className="text-faint">Network:</span> eip155:5042002 (Circle Arc Testnet)
                </div>

                {!paywallUnlocked ? (
                  <div className="rounded-[2px] border border-caution/30 bg-caution/10 p-3 text-caution">
                    HTTP 402 Payment Required<br />
                    PAYMENT-REQUIRED: scheme=exact amount=10000 asset=USDC
                  </div>
                ) : (
                  <div className="rounded-[2px] border border-reserve/30 bg-reserve/10 p-3 text-reserve">
                    HTTP 200 OK &middot; Dossier Decrypted<br />
                    Tx: {txHash?.slice(0, 16)}...
                  </div>
                )}
              </div>

              <div className="mt-5 flex gap-3">
                {!paywallUnlocked ? (
                  <button
                    onClick={simulatePayment}
                    className="label-xs w-full rounded-[2px] border border-gold bg-gold/20 py-2.5 text-center font-display text-sm text-gold hover:bg-gold/30"
                  >
                    Simulate 1¢ USDC Payment via Gateway
                  </button>
                ) : (
                  <button
                    onClick={resetPayment}
                    className="label-xs w-full rounded-[2px] border border-paper/20 py-2.5 text-center text-quiet hover:text-paper"
                  >
                    Reset Simulation
                  </button>
                )}
              </div>
            </div>

            {/* Explanation Card */}
            <div className="plate border border-gold/20 bg-void/30 p-5 flex flex-col justify-between">
              <div>
                <span className="font-mono text-xs text-gold">HOW IT WORKS</span>
                <h4 className="mt-2 font-display text-base text-paper">Why $0.01 is Better Than $50/mo</h4>
                <ul className="mt-3 space-y-2 text-xs text-quiet">
                  <li>• <strong>No Recurring Traps:</strong> You only pay for research you actually read.</li>
                  <li>• <strong>Valid for 24 Hours:</strong> A single 1-cent signature gives full access for a full day.</li>
                  <li>• <strong>Machine-Readable for AI:</strong> Autonomous bots pay via programmatic headers with sub-second finality.</li>
                  <li>• <strong>Integrity Guaranteed:</strong> Ratings cannot be purchased or altered by protocol teams.</li>
                </ul>
              </div>

              <div className="mt-4 pt-3 border-t border-paper/[0.08] text-[11px] text-faint font-mono">
                Verified with 20/20 payment test suites on Circle Arc Gateway.
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 4: KILL-SHOT STRESS TESTER */}
      {activeTab === "killshot" && (
        <div className="mt-8 space-y-6">
          <div>
            <h3 className="font-display text-lg text-paper">Kill-Shot Stress Simulator</h3>
            <p className="mt-1 text-[13px] text-quiet">
              Select a catastrophic market scenario to see how ArcGrade triggers downgrade protection.
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            {scenarios.map((sc, i) => (
              <button
                key={sc.title}
                onClick={() => setActiveScenario(i)}
                className={`plate p-4 text-left transition-all ${
                  activeScenario === i
                    ? "border border-gold bg-gold/[0.12] shadow-md"
                    : "border border-paper/10 hover:border-gold/30 bg-void/40"
                }`}
              >
                <span className="font-mono text-[10px] text-gold uppercase">Scenario 0{i + 1}</span>
                <h4 className="mt-1 font-display text-sm text-paper">{sc.title}</h4>
                <p className="mt-2 text-[12px] text-quiet leading-relaxed">{sc.description}</p>
              </button>
            ))}
          </div>

          {activeScenario !== null && (
            <div className="rounded-[2px] border border-stop/40 bg-stop/10 p-5 text-paper">
              <div className="flex items-center gap-2">
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-stop text-void font-bold text-xs">
                  !
                </span>
                <span className="font-mono text-xs uppercase tracking-wider text-stop font-semibold">
                  Emergency Downgrade Simulation Result
                </span>
              </div>
              <p className="mt-3 text-sm leading-relaxed text-paper">
                <strong>Simulated Trigger:</strong> {scenarios[activeScenario].description}
              </p>
              <p className="mt-1 text-sm text-gold font-mono">
                <strong>ArcGrade Action:</strong> {scenarios[activeScenario].impact}
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
