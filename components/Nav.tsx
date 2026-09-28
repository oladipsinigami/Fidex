"use client";

import Link from "next/link";
import { WalletButton } from "./WalletButton";
import { TutorialTrigger } from "./TutorialModal";
import { WalkthroughTrigger } from "./WalkthroughTour";

const LINKS = [
  { href: "/markets", label: "Markets" },
  { href: "/arc", label: "Live universe" },
  { href: "/methodology", label: "Methodology" },
  { href: "/guide", label: "Guide" },
  { href: "/agents", label: "Agents" },
  { href: "/studio", label: "Studio" },
];

export function Nav() {
  return (
    <header className="sticky top-0 z-50 border-b border-paper/[0.07] bg-void/85 backdrop-blur-sm">
      <div className="mx-auto flex h-14 max-w-[1120px] items-center gap-6 px-5">
        <Link
          href="/"
          data-walkthrough="nav-brand"
          className="group flex items-baseline gap-2.5"
        >
          <span className="font-display text-[19px] font-semibold tracking-[-0.01em] text-paper">
            ArcGrade
          </span>
          <span className="label-xs hidden text-faint group-hover:text-gold sm:inline">
            Ratings for USDC allocation
          </span>
        </Link>

        <nav className="ml-auto hidden items-center gap-6 md:flex">
          {LINKS.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className="label-xs transition-colors hover:text-gold"
            >
              {l.label}
            </Link>
          ))}
        </nav>

        <div className="ml-auto flex items-center gap-2.5 md:ml-0">
          <WalkthroughTrigger label="Walkthrough" />
          <TutorialTrigger label="Tutorial" />
          <button
            data-walkthrough="nav-search"
            onClick={() =>
              window.dispatchEvent(new CustomEvent("arcgrade:command", { detail: {} }))
            }
            className="label-xs hidden items-center gap-2 rounded-[2px] border border-paper/10 px-2.5 py-1.5 text-faint transition-colors hover:border-gold/40 hover:text-gold lg:inline-flex"
            aria-label="Open command palette"
          >
            Search
            <kbd className="font-mono text-[10px] text-faint">⌘K</kbd>
          </button>
          <WalletButton />
        </div>
      </div>
      <div className="rule-draw" />
    </header>
  );
}
