"use client";

import { useSyncExternalStore } from "react";
import { useAccount, useConnect } from "wagmi";
import { injected } from "wagmi/connectors";
import { arcTestnet } from "@/lib/wagmi";
import { LockGlyph } from "./Axis";

function shortAddress(a?: string) {
  return a ? `${a.slice(0, 6)}…${a.slice(-4)}` : "";
}

const emptySubscribe = () => () => {};

/**
 * Security gate: Locks proprietary ratings, scores, and dossier intelligence
 * until a Web3 wallet is connected on Arc to prevent bot exploitation and scraping.
 */
export function WalletGate({
  protocolName,
  category,
  children,
}: {
  protocolName: string;
  category: string;
  children: React.ReactNode;
}) {
  const { address, isConnected, chain } = useAccount();
  const { connect, connectors, isPending } = useConnect();
  const mounted = useSyncExternalStore(emptySubscribe, () => true, () => false);

  // During SSR or before mount, render in locked state to prevent flash of content
  if (!mounted || !isConnected || !address) {
    return (
      <div data-walkthrough="wallet-gate" className="relative min-h-[60vh]">
        {/* Protected Skeleton (prevents leaking confidential dossier in SSR HTML) */}
        <div
          aria-hidden
          className="pointer-events-none select-none opacity-10 blur-sm filter p-6 space-y-6 max-w-[1120px] mx-auto"
        >
          <div className="h-40 rounded bg-paper/20" />
          <div className="h-64 rounded bg-paper/15" />
          <div className="h-48 rounded bg-paper/10" />
        </div>

        {/* The Security Gate Modal Overlay */}
        <div className="absolute inset-0 z-30 flex items-start justify-center pt-8 sm:pt-16 px-4">
          <div className="plate relative max-w-xl w-full border border-gold/40 p-8 sm:p-10 shadow-[0_0_50px_rgba(0,0,0,0.8)] backdrop-blur-xl bg-void/90">
            {/* Pulsing Lock Header */}
            <div className="flex items-center gap-2.5 text-gold">
              <span className="flex h-6 w-6 items-center justify-center rounded-full border border-gold/40 bg-gold/10 animate-pulse">
                <LockGlyph />
              </span>
              <span className="label-xs font-mono tracking-widest uppercase text-gold">
                Security Gate &middot; Wallet Required
              </span>
            </div>

            <h2 className="mt-4 font-display text-2xl sm:text-3xl text-paper">
              {protocolName} Risk Dossier is Locked
            </h2>
            <p className="label-xs mt-1 text-gold/80">{category} &middot; Protected Surface</p>
            <p className="mt-2.5 text-[14px] leading-relaxed text-quiet">
              To prevent automated data extraction, bot scraping, and unauthorized exploitation,
              ArcGrade requires an authenticated Web3 wallet on Circle Arc before decrypting
              ratings, scores, and vulnerability assessments.
            </p>

            {/* Protected Data Surface Breakdown */}
            <div className="mt-6 rounded-[2px] border border-paper/[0.08] bg-panel/60 p-4">
              <p className="label-xs text-faint mb-3">Protected Intelligence Surface</p>
              <ul className="space-y-2 text-[12.5px] text-paper/80">
                <li className="flex items-center gap-2.5">
                  <span className="font-mono text-[11px] text-gold">🔒</span>
                  <span>Composite Risk Score (0–100) & Letter Grade</span>
                </li>
                <li className="flex items-center gap-2.5">
                  <span className="font-mono text-[11px] text-gold">🔒</span>
                  <span>9 Weighted Risk Axes with Primary Audit Citations</span>
                </li>
                <li className="flex items-center gap-2.5">
                  <span className="font-mono text-[11px] text-gold">🔒</span>
                  <span>Failure Kill Shots (Contract & Economic Breakdown Modes)</span>
                </li>
                <li className="flex items-center gap-2.5">
                  <span className="font-mono text-[11px] text-gold">🔒</span>
                  <span>Insider Unlock Calendar & Dilution Velocity</span>
                </li>
              </ul>
            </div>

            {/* Connect Action Button */}
            <button
              disabled={isPending}
              onClick={() => {
                const connector = connectors[0] ?? injected();
                connect({ connector, chainId: arcTestnet.id });
              }}
              className="mt-6 flex w-full items-center justify-center gap-3 rounded-[2px] border border-gold bg-gold/[0.14] px-6 py-4 font-display text-[16px] font-semibold text-paper transition-all hover:bg-gold/[0.25] hover:shadow-[0_0_25px_rgba(212,175,55,0.25)] disabled:opacity-50"
            >
              <LockGlyph />
              <span>{isPending ? "Connecting Wallet…" : "Connect Wallet to Decrypt Dossier"}</span>
            </button>

            <div className="mt-4 flex flex-wrap items-center justify-between text-[11px] text-faint">
              <span>Supports MetaMask, Rabby, Coinbase Wallet</span>
              <span className="font-mono text-gold/80">Circle Arc Testnet (Chain 5042002)</span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // User is authenticated and connected with a wallet
  return (
    <div data-walkthrough="wallet-gate" className="relative">
      {/* Verified Wallet Banner */}
      <div className="border-b border-paper/[0.08] bg-panel/40 px-5 py-2">
        <div className="mx-auto flex max-w-[1120px] items-center justify-between text-[11.5px]">
          <span className="flex items-center gap-2 text-reserve">
            <span className="h-2 w-2 rounded-full bg-reserve animate-pulse" />
            <span>Decrypted for wallet: <span className="font-mono text-paper font-medium">{shortAddress(address)}</span></span>
          </span>
          <span className="font-mono text-faint text-[10.5px]">
            {chain?.name ?? "Arc Testnet"} &middot; Authenticated
          </span>
        </div>
      </div>

      {children}
    </div>
  );
}
