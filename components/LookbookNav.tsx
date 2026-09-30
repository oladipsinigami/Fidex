"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
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
        Fidex
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
          aria-label="Open command palette"
        >
          Search <kbd>⌘K</kbd>
        </button>
        <WalletButton />
      </div>
    </header>
  );
}
