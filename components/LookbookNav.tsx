"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ThemeToggle } from "./ThemeToggle";
import { WalletButton } from "./WalletButton";

const LINKS = [
  { href: "/markets", label: "Markets" },
  { href: "/arc", label: "Universe" },
  { href: "/methodology", label: "Method" },
  { href: "/agents", label: "Agents" },
];

export function LookbookNav() {
  const path = usePathname();
  const campaign = path === "/";

  return (
    <header className={`lookbook-nav ${campaign ? "lookbook-nav--campaign" : ""}`}>
      <Link href="/" className="lookbook-logo" data-walkthrough="nav-brand">
        <span className="lookbook-logo__mark" aria-hidden>
          F
        </span>
        <span>F I D E X</span>
      </Link>

      <nav className="lookbook-links">
        {LINKS.map((l) => (
          <Link
            key={l.href}
            href={l.href}
            className={path === l.href || path.startsWith(`${l.href}/`) ? "is-on" : ""}
          >
            {l.label}
          </Link>
        ))}
      </nav>

      <div className="lookbook-nav__end">
        <button
          data-walkthrough="nav-search"
          className="lookbook-search"
          onClick={() => {
            window.dispatchEvent(new CustomEvent("fidex:command", { detail: {} }));
            window.dispatchEvent(new CustomEvent("arcgrade:command", { detail: {} }));
          }}
          aria-label="Open search command palette"
        >
          <svg
            className="h-3.5 w-3.5"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth="2"
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
            />
          </svg>
          <span>Search</span>
        </button>

        <ThemeToggle />
        <WalletButton />
      </div>
    </header>
  );
}
