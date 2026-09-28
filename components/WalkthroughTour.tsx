"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";

export interface WalkthroughStep {
  id: string;
  badge: string;
  title: string;
  subtitle: string;
  explanation: string;
  selector: string;
  pageUrl?: string;
  position?: "bottom" | "top" | "left" | "right";
  actionLabel?: string;
  actionUrl?: string;
  previewType?: "plate" | "markets" | "gate" | "axes" | "paywall" | "search";
}

export const WALKTHROUGH_STEPS: WalkthroughStep[] = [
  {
    id: "nav-brand",
    badge: "Step 1 of 8 · Platform",
    title: "Circle Arc Native Risk Desk",
    subtitle: "Built exclusively for USDC-native execution on Chain 5042.",
    explanation:
      "ArcGrade sits at the top of the Circle Arc stack. Unlike chains where gas and fees are paid in volatile tokens, Arc operates with native USDC. ArcGrade tracks every protocol and token deploying on Arc.",
    selector: '[data-walkthrough="nav-brand"]',
    position: "bottom",
    previewType: "search",
  },
  {
    id: "nav-search",
    badge: "Step 2 of 8 · Discovery",
    title: "Universal Command Palette (⌘K)",
    subtitle: "Search 53+ hand-analysed dossiers and live screened dApps.",
    explanation:
      "Press ⌘K anywhere or click Search to find any asset, protocol, bridge, or token on Arc. Results show real-time scores, letter grades, and direct links to dossiers.",
    selector: '[data-walkthrough="nav-search"]',
    position: "bottom",
    actionLabel: "Try Search Palette",
    previewType: "search",
  },
  {
    id: "rating-plate",
    badge: "Step 3 of 8 · Core Rating",
    title: "The Rating Plate & Weakest-Link Grade",
    subtitle: "A letter from A to F, backed by a 0–100 composite score.",
    explanation:
      "ArcGrade's rating plate operates like a restaurant health grade. Using multiplicative compounding, high TVL cannot mask a critical security vulnerability or unaudited bytecode.",
    selector: '[data-walkthrough="rating-plate"]',
    pageUrl: "/",
    position: "left",
    actionLabel: "View Featured Dossier",
    actionUrl: "/p/aave-v4-arc",
    previewType: "plate",
  },
  {
    id: "market-tabs",
    badge: "Step 4 of 8 · Market Ledger",
    title: "Universe Scope & Protocol Filters",
    subtitle: "Switch between in-depth dossiers and live auto-screened dApps.",
    explanation:
      "In the Markets view, you can filter by Hand-Analysed Dossiers (19 names), Live Screened dApps (34 names), and Assets/Tokens. Sort by safety score, TVL, or letter grade with instant search.",
    selector: '[data-walkthrough="market-tabs"]',
    pageUrl: "/markets",
    position: "bottom",
    actionLabel: "Go to Markets Table",
    actionUrl: "/markets",
    previewType: "markets",
  },
  {
    id: "wallet-gate",
    badge: "Step 5 of 8 · Security Gate",
    title: "Web3 Wallet Security Gate",
    subtitle: "Protecting proprietary analysis from scraper bots and frontrunning.",
    explanation:
      "All deep dossiers are heavily blurred and locked until you connect an authenticated Arc Web3 wallet (MetaMask, Rabby, or Coinbase Wallet). This ensures human-verified access and guards our proprietary risk models.",
    selector: '[data-walkthrough="wallet-gate"]',
    pageUrl: "/p/aave-v4-arc",
    position: "top",
    actionLabel: "Inspect Gated Dossier",
    actionUrl: "/p/aave-v4-arc",
    previewType: "gate",
  },
  {
    id: "axes-breakdown",
    badge: "Step 6 of 8 · 9 Safety Axes",
    title: "The 9 Compounded Safety Axes",
    subtitle: "Deep-dive into every risk vector before committing capital.",
    explanation:
      "Every dossier breaks down 9 distinct vectors: Code Security (20%), Liquidity Depth (18%), Decentralization (15%), Audits (14%), Oracles (10%), Dependencies (8%), Yield (7%), Legal (4%), and Team (4%).",
    selector: '[data-walkthrough="axes-breakdown"]',
    pageUrl: "/p/aave-v4-arc",
    position: "top",
    actionLabel: "Read Methodology",
    actionUrl: "/methodology",
    previewType: "axes",
  },
  {
    id: "killshots",
    badge: "Step 7 of 8 · Worst-Case Scenarios",
    title: "Kill Shots: What Breaks This Grade",
    subtitle: "Pre-identified catastrophe scenarios explained in plain English.",
    explanation:
      "Instead of burying critical flaws in 60-page PDF audits, ArcGrade highlights explicit failure modes—like bridge lockbox drains or flash liquidations—that would trigger an immediate downgrade or capital loss.",
    selector: '[data-walkthrough="killshots"]',
    pageUrl: "/p/aave-v4-arc",
    position: "top",
    previewType: "axes",
  },
  {
    id: "paywall-box",
    badge: "Step 8 of 8 · x402 Micropayments",
    title: "The 1-Cent ($0.01) Paywall & Agent API",
    subtitle: "No $50/mo subscriptions. Pay per report in native USDC.",
    explanation:
      "Built on the open x402 protocol and Circle Gateway. Humans and autonomous AI trading agents pay 1 penny ($0.01 USDC) on Arc to unlock an in-depth dossier for 24 hours. No recurring subscriptions or lock-ins.",
    selector: '[data-walkthrough="paywall-box"]',
    pageUrl: "/p/aave-v4-arc",
    position: "top",
    actionLabel: "Explore Agent API",
    actionUrl: "/agents",
    previewType: "paywall",
  },
];

interface ElementRect {
  top: number;
  left: number;
  width: number;
  height: number;
}

export function WalkthroughTour() {
  const router = useRouter();
  const pathname = usePathname();
  const [active, setActive] = useState(false);
  const [stepIndex, setStepIndex] = useState(0);
  const [targetRect, setTargetRect] = useState<ElementRect | null>(null);
  const [hasScrolled, setHasScrolled] = useState(false);

  const step = WALKTHROUGH_STEPS[stepIndex];

  // Auto-start walkthrough whenever the page loads
  useEffect(() => {
    const autoTimer = setTimeout(() => {
      setActive(true);
      setStepIndex(0);
      setHasScrolled(false);
    }, 600);

    return () => clearTimeout(autoTimer);
  }, []);

  // Listen to open event
  useEffect(() => {
    const handleStart = (e?: Event) => {
      const customEvent = e as CustomEvent<{ step?: number }>;
      setStepIndex(customEvent?.detail?.step ?? 0);
      setActive(true);
      setHasScrolled(false);
    };

    window.addEventListener("arcgrade:walkthrough", handleStart);
    return () => window.removeEventListener("arcgrade:walkthrough", handleStart);
  }, []);

  // Keyboard navigation
  useEffect(() => {
    if (!active) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setActive(false);
      } else if (e.key === "ArrowRight") {
        if (stepIndex < WALKTHROUGH_STEPS.length - 1) {
          setStepIndex((i) => i + 1);
          setHasScrolled(false);
        } else {
          setActive(false);
        }
      } else if (e.key === "ArrowLeft") {
        if (stepIndex > 0) {
          setStepIndex((i) => i - 1);
          setHasScrolled(false);
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [active, stepIndex]);

  // Locate target element on page
  const updateTargetRect = useCallback(() => {
    if (!active || !step) return;

    const el = document.querySelector(step.selector);
    if (el) {
      const rect = el.getBoundingClientRect();
      setTargetRect({
        top: rect.top,
        left: rect.left,
        width: rect.width,
        height: rect.height,
      });

      if (!hasScrolled) {
        el.scrollIntoView({ behavior: "smooth", block: "center" });
        setHasScrolled(true);
      }
    } else {
      setTargetRect(null);
    }
  }, [active, step, hasScrolled]);

  useEffect(() => {
    if (!active) return;

    // Small delay to allow any page transitions
    const timer = setTimeout(() => {
      updateTargetRect();
    }, 150);

    const onScrollOrResize = () => {
      const el = document.querySelector(step.selector);
      if (el) {
        const rect = el.getBoundingClientRect();
        setTargetRect({
          top: rect.top,
          left: rect.left,
          width: rect.width,
          height: rect.height,
        });
      }
    };

    window.addEventListener("scroll", onScrollOrResize, { passive: true });
    window.addEventListener("resize", onScrollOrResize);

    return () => {
      clearTimeout(timer);
      window.removeEventListener("scroll", onScrollOrResize);
      window.removeEventListener("resize", onScrollOrResize);
    };
  }, [active, stepIndex, pathname, updateTargetRect, step]);

  if (!active) return null;

  const isFirst = stepIndex === 0;
  const isLast = stepIndex === WALKTHROUGH_STEPS.length - 1;

  const handleNext = () => {
    if (!isLast) {
      setStepIndex((i) => i + 1);
      setHasScrolled(false);
    } else {
      setActive(false);
    }
  };

  const handlePrev = () => {
    if (!isFirst) {
      setStepIndex((i) => i - 1);
      setHasScrolled(false);
    }
  };

  const handleNavigateToTarget = (url: string) => {
    router.push(url);
    setHasScrolled(false);
  };

  return (
    <div className="no-print fixed inset-0 z-[200] overflow-hidden">
      {/* Target spotlight cutout curtains */}
      {targetRect ? (
        <>
          {/* Top Curtain */}
          <div
            className="absolute left-0 right-0 top-0 bg-void/80 backdrop-blur-[3px] transition-all duration-300"
            style={{ height: Math.max(0, targetRect.top - 6) }}
            onClick={() => setActive(false)}
          />
          {/* Bottom Curtain */}
          <div
            className="absolute bottom-0 left-0 right-0 bg-void/80 backdrop-blur-[3px] transition-all duration-300"
            style={{
              top: Math.min(window.innerHeight, targetRect.top + targetRect.height + 6),
            }}
            onClick={() => setActive(false)}
          />
          {/* Left Curtain */}
          <div
            className="absolute left-0 bg-void/80 backdrop-blur-[3px] transition-all duration-300"
            style={{
              top: Math.max(0, targetRect.top - 6),
              height: targetRect.height + 12,
              width: Math.max(0, targetRect.left - 6),
            }}
            onClick={() => setActive(false)}
          />
          {/* Right Curtain */}
          <div
            className="absolute right-0 bg-void/80 backdrop-blur-[3px] transition-all duration-300"
            style={{
              top: Math.max(0, targetRect.top - 6),
              height: targetRect.height + 12,
              left: Math.min(
                window.innerWidth,
                targetRect.left + targetRect.width + 6
              ),
            }}
            onClick={() => setActive(false)}
          />

          {/* Spotlight Glowing Frame around Target */}
          <div
            className="pointer-events-none absolute rounded-[4px] border-2 border-gold shadow-[0_0_30px_rgba(229,183,95,0.45)] transition-all duration-300"
            style={{
              top: targetRect.top - 6,
              left: targetRect.left - 6,
              width: targetRect.width + 12,
              height: targetRect.height + 12,
            }}
          >
            <span className="absolute -top-3 -right-3 flex h-6 w-6 items-center justify-center rounded-full bg-gold text-void font-mono text-xs font-bold shadow-md animate-pulse">
              {stepIndex + 1}
            </span>
          </div>
        </>
      ) : (
        /* Full backdrop if element not on this specific page */
        <div
          className="absolute inset-0 bg-void/85 backdrop-blur-md transition-all duration-300"
          onClick={() => setActive(false)}
        />
      )}

      {/* Floating Walkthrough Card */}
      <div className="fixed inset-x-0 bottom-6 sm:bottom-10 z-[210] flex justify-center px-4 pointer-events-none">
        <div className="plate pointer-events-auto max-w-xl w-full border border-gold/50 bg-panel/95 p-6 shadow-[0_0_50px_rgba(0,0,0,0.85)] backdrop-blur-2xl transition-all">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-paper/[0.08] pb-3">
            <div className="flex items-center gap-2">
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-gold/20 text-gold text-xs font-mono font-bold">
                {stepIndex + 1}
              </span>
              <span className="label-xs font-mono uppercase tracking-widest text-gold">
                {step.badge}
              </span>
            </div>

            <div className="flex items-center gap-3">
              {/* Stepper dots */}
              <div className="flex items-center gap-1.5">
                {WALKTHROUGH_STEPS.map((s, idx) => (
                  <button
                    key={s.id}
                    onClick={() => {
                      setStepIndex(idx);
                      setHasScrolled(false);
                    }}
                    className={`h-1.5 rounded-full transition-all ${
                      idx === stepIndex
                        ? "w-5 bg-gold"
                        : idx < stepIndex
                        ? "w-2 bg-gold/40"
                        : "w-2 bg-paper/20"
                    }`}
                    aria-label={`Jump to step ${idx + 1}`}
                  />
                ))}
              </div>

              <button
                onClick={() => setActive(false)}
                className="text-faint hover:text-paper text-lg font-mono leading-none ml-2"
                title="Close Walkthrough (Esc)"
              >
                &times;
              </button>
            </div>
          </div>

          {/* Body */}
          <div className="mt-4">
            <h3 className="font-display text-xl sm:text-2xl text-paper">{step.title}</h3>
            <p className="mt-1 text-[13px] font-medium text-gold">{step.subtitle}</p>
            <p className="mt-2 text-[13px] leading-relaxed text-quiet">{step.explanation}</p>
          </div>

          {/* If element is not present on this page, offer direct navigation */}
          {!targetRect && step.pageUrl && pathname !== step.pageUrl && (
            <div className="mt-4 flex items-center justify-between rounded-[2px] border border-gold/20 bg-gold/[0.06] p-3">
              <span className="text-[12px] text-paper">
                This feature lives on <strong>{step.pageUrl}</strong>.
              </span>
              <button
                onClick={() => handleNavigateToTarget(step.pageUrl!)}
                className="label-xs rounded-[2px] border border-gold bg-gold/20 px-3 py-1 text-gold hover:bg-gold/30 transition-colors"
              >
                Go to page &amp; highlight &rarr;
              </button>
            </div>
          )}

          {/* Footer Controls */}
          <div className="mt-6 flex items-center justify-between border-t border-paper/[0.08] pt-4">
            <div className="flex items-center gap-2">
              <button
                disabled={isFirst}
                onClick={handlePrev}
                className="label-xs rounded-[2px] border border-paper/15 px-3 py-2 text-quiet transition-colors hover:border-gold/40 hover:text-paper disabled:opacity-30"
              >
                &larr; Prev
              </button>

              <button
                onClick={() => setActive(false)}
                className="label-xs text-faint hover:text-paper transition-colors px-2 py-2"
              >
                Skip Tour
              </button>
            </div>

            <div className="flex items-center gap-2">
              {step.actionUrl && (
                <Link
                  href={step.actionUrl}
                  onClick={() => setActive(false)}
                  className="label-xs text-faint hover:text-gold transition-colors hidden sm:inline-block mr-2"
                >
                  {step.actionLabel || "View Feature"} &rarr;
                </Link>
              )}

              <button
                onClick={handleNext}
                className="flex items-center gap-1.5 rounded-[2px] border border-gold bg-gold/[0.16] px-4 py-2 font-display text-[13px] font-medium text-paper transition-all hover:bg-gold/[0.28]"
              >
                <span>{isLast ? "Finish Walkthrough" : "Next Step"}</span>
                {!isLast && <span>&rarr;</span>}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/** Trigger button to launch the live walkthrough */
export function WalkthroughTrigger({
  label = "Walkthrough",
  startStep = 0,
}: {
  label?: string;
  startStep?: number;
}) {
  return (
    <button
      onClick={() =>
        window.dispatchEvent(
          new CustomEvent("arcgrade:walkthrough", { detail: { step: startStep } })
        )
      }
      className="label-xs flex items-center gap-1.5 rounded-[2px] border border-gold/40 bg-gold/[0.12] px-2.5 py-1 text-gold transition-all hover:border-gold hover:bg-gold/[0.22] hover:shadow-[0_0_12px_rgba(229,183,95,0.25)]"
      title="Start Interactive Product Walkthrough"
    >
      <span className="flex h-3.5 w-3.5 items-center justify-center rounded-full bg-gold text-void text-[10px] font-bold font-mono">
        ▶
      </span>
      <span>{label}</span>
    </button>
  );
}
