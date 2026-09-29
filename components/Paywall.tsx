"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAccount, useConnect, useDisconnect, useSendTransaction, useSwitchChain } from "wagmi";
import { injected } from "wagmi/connectors";
import { arc, arcTestnet } from "@/lib/wagmi";
import { IS_TESTNET } from "@/lib/arcchain";
import { toast } from "@/lib/toast";
import { LockGlyph } from "./Axis";

function shortAddress(a?: string) {
  return a ? `${a.slice(0, 6)}…${a.slice(-4)}` : "";
}

/**
 * Real Arc Testnet x402 / USDC Paywall.
 * Requires genuine payment on Arc Testnet to unlock proprietary dossiers.
 */
export function Paywall({
  slug,
  priceUsd = "$0.01",
}: {
  slug: string;
  priceUsd?: string;
}) {
  const { address, isConnected, chain } = useAccount();
  const { connect, connectors, isPending: isConnecting } = useConnect();
  const { disconnect } = useDisconnect();
  const { switchChainAsync } = useSwitchChain();
  const { sendTransactionAsync } = useSendTransaction();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  async function handleUnlock(scope: "dossier" | "axis" = "dossier", axisId?: string) {
    if (!isConnected || !address) {
      toast({
        title: "Wallet Required",
        body: "Please connect your Web3 wallet on Arc Testnet to unlock.",
        kind: "warn",
      });
      return;
    }

    setError(null);
    setBusy(true);

    try {
      const targetChain = IS_TESTNET ? arcTestnet : arc;

      // 1. Ensure user is on the correct Arc network
      if (chain?.id !== targetChain.id && switchChainAsync) {
        toast({
          title: "Network Switch Required",
          body: `Switching wallet to ${targetChain.name}…`,
          kind: "info",
        });
        await switchChainAsync({ chainId: targetChain.id });
      }

      // 2. Fetch the x402 payment challenge from the server
      const challengeRes = await fetch("/api/v1/unlock", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug, scope, axisId }),
      });
      const challengeData = await challengeRes.json();
      const accept = challengeData?.accepts?.[0];

      if (!accept || !accept.payTo) {
        throw new Error(challengeData?.message ?? "Failed to retrieve payment challenge.");
      }

      const payTo = accept.payTo as `0x${string}`;
      const isAxis = scope === "axis";
      const valueWei = isAxis ? 1_000_000_000_000_000n : 10_000_000_000_000_000n; // $0.001 vs $0.01
      const priceLabel = isAxis ? "$0.001" : "$0.01";

      toast({
        title: "Confirm Payment",
        body: `Please sign the ${priceLabel} USDC transfer in your wallet…`,
        kind: "info",
      });

      // 3. Execute real transaction: native USDC on Arc (18 decimals)
      const txHash = await sendTransactionAsync({
        to: payTo,
        value: valueWei,
      });

      toast({
        title: "Payment Submitted",
        body: `Verifying transaction on ${targetChain.name} (${txHash.slice(0, 10)}…)`,
        kind: "info",
      });

      // 4. Verify transaction on server and mint HMAC receipt cookie
      const verifyRes = await fetch("/api/v1/unlock", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug, scope, axisId, txHash }),
      });

      const verifyData = await verifyRes.json();
      if (!verifyRes.ok) {
        throw new Error(verifyData?.message || verifyData?.reason || "Transaction verification failed.");
      }

      toast({
        title: "Dossier Unlocked",
        body: `Payment verified on Arc Testnet for ${shortAddress(address)}. Valid 24 hours.`,
        kind: "ok",
        ref: `tx ${txHash.slice(0, 12)}…`,
      });

      router.refresh();
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Payment failed.";
      setError(msg);
      toast({ title: "Unlock Failed", body: msg, kind: "error" });
    } finally {
      setBusy(false);
    }
  }

  // -------------------------------------------------------------------------
  // 1. UNCONNECTED STATE -> STRICTLY LOCKED SECURITY GATE
  // -------------------------------------------------------------------------
  if (!isConnected || !address) {
    return (
      <div className="plate relative overflow-hidden border border-paper/15 p-6 shadow-2xl">
        <div className="flex items-center gap-2 text-gold">
          <span className="animate-pulse">
            <LockGlyph />
          </span>
          <span className="label-xs font-mono uppercase tracking-wider text-gold">
            Security Gate &middot; Wallet Required
          </span>
        </div>

        <h3 className="mt-3 font-display text-xl text-paper">
          Connect Wallet to Unlock Dossier
        </h3>
        <p className="mt-2 text-[13px] leading-relaxed text-quiet">
          Access to proprietary 9-axis evaluations, failure killshots, and insider unlock
          schedules is locked to prevent bot exploitation and unauthorized automated scraping.
        </p>

        <ul className="mt-5 space-y-2 border-t border-paper/[0.08] pt-4 text-[12.5px] text-faint">
          {[
            "Nine weighted risk axes with audit citations",
            "What breaks this grade (Kill Shots)",
            "Insider token unlock calendar & float schedule",
            "x402 machine-readable agent JSON endpoint",
          ].map((item) => (
            <li key={item} className="flex items-center gap-2.5">
              <span className="font-mono text-[10px] text-gold/70">🔒</span>
              <span className="text-paper/75">{item}</span>
            </li>
          ))}
        </ul>

        <button
          disabled={isConnecting}
          onClick={() => {
            const connector = connectors[0] ?? injected();
            connect({ connector, chainId: arcTestnet.id });
          }}
          className="mt-6 flex w-full items-center justify-center gap-2.5 rounded-[2px] border border-gold/60 bg-gold/[0.12] px-5 py-3.5 font-display text-[15px] font-medium text-paper transition-all hover:border-gold hover:bg-gold/[0.22] hover:shadow-[0_0_20px_rgba(212,175,55,0.18)] disabled:opacity-50"
        >
          <LockGlyph />
          <span>{isConnecting ? "Connecting to Arc Testnet…" : "Connect Wallet to Unlock"}</span>
        </button>

        <p className="mt-3 text-center text-[11px] text-faint">
          Connect MetaMask, Rabby, or Coinbase Wallet on Circle Arc Testnet (Chain 5042002).
        </p>

        <div className="mt-3 text-center">
          <a
            href="https://faucet.circle.com"
            target="_blank"
            rel="noreferrer"
            className="label-xs text-gold/70 hover:text-gold transition-colors inline-flex items-center gap-1"
          >
            <span>Need Testnet USDC? Circle Faucet</span>
            <span>&rarr;</span>
          </a>
        </div>
      </div>
    );
  }

  // -------------------------------------------------------------------------
  // 2. CONNECTED STATE -> AUTHENTICATED UNLOCK GATE
  // -------------------------------------------------------------------------
  return (
    <div className="plate border border-gold/30 p-6 shadow-2xl">
      <div className="mb-4 flex items-center justify-between border-b border-paper/[0.08] pb-3">
        <span className="label-xs flex items-center gap-1.5 text-reserve">
          <span className="h-2 w-2 rounded-full bg-reserve animate-pulse" />
          Wallet Connected (Arc Testnet)
        </span>
        <div className="flex items-center gap-2">
          <span className="font-mono text-xs text-gold">
            {shortAddress(address)} {chain?.name ? `(${chain.name})` : ""}
          </span>
          <button
            onClick={() => disconnect()}
            className="label-xs text-faint hover:text-paper"
            title="Disconnect"
          >
            &times;
          </button>
        </div>
      </div>

      <div className="flex items-start gap-4">
        <span className="mt-1 text-gold">
          <LockGlyph />
        </span>
        <div className="min-w-0 flex-1">
          <h3 className="font-display text-xl text-paper">Unlock the full dossier</h3>
          <p className="mt-1.5 text-[13px] leading-relaxed text-quiet">
            All nine axes with evidence and citations, token unlock calendar, incident
            log, kill shots, and the agent JSON view.
          </p>
        </div>
      </div>

      <ul className="mt-5 space-y-2 border-t border-paper/[0.07] pt-4 text-[12.5px] text-quiet">
        {[
          "Nine weighted axes, scores and evidence",
          "Primary citations: audits, explorer, governance",
          "Token unlock calendar and insider float",
          "Incident log and kill shots",
          "Agent JSON endpoint, unlocked for 24h",
        ].map((line) => (
          <li key={line} className="flex items-start gap-2.5">
            <span className="mt-[7px] inline-block h-px w-2.5 shrink-0 bg-gold/50" />
            {line}
          </li>
        ))}
      </ul>

      <button
        disabled={busy}
        onClick={() => handleUnlock("dossier")}
        className="group mt-6 flex w-full items-center justify-between rounded-[2px] border border-gold/60 bg-gold/[0.10] px-5 py-4 transition-colors hover:border-gold hover:bg-gold/[0.20] disabled:opacity-60"
      >
        <span className="font-display text-lg text-paper">
          {busy ? "Authorizing on Arc Testnet…" : "Unlock full dossier"}
        </span>
        <span className="num font-mono text-sm text-gold">{priceUsd} USDC</span>
      </button>

      <p className="mt-3 text-center text-[11px] leading-relaxed text-faint">
        Settled in USDC on Arc Testnet (5042002) for <span className="font-mono text-paper/80">{shortAddress(address)}</span>. Valid 24 hours.
      </p>

      <div className="mt-3 border-t border-paper/[0.06] pt-3 text-center">
        <a
          href="https://faucet.circle.com"
          target="_blank"
          rel="noreferrer"
          className="label-xs text-gold/70 hover:text-gold transition-colors inline-flex items-center gap-1"
        >
          <span>Need testnet funds? Get free USDC from Circle Faucet</span>
          <span>&rarr;</span>
        </a>
      </div>

      {error && (
        <p className="mt-3 rounded-[2px] border border-stop/40 bg-stop/10 px-3 py-2 text-center text-[12px] text-stop">
          {error}
        </p>
      )}
    </div>
  );
}
