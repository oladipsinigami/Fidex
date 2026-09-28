"use client";

import { useState } from "react";
import { createConfig, http } from "wagmi";
import { WagmiProvider, useConnect, useDisconnect, useAccount } from "wagmi";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { injected } from "wagmi/connectors";
import { arc, arcTestnet } from "@/lib/wagmi";

const config = createConfig({
  chains: [arcTestnet, arc],
  connectors: [injected()],
  transports: {
    [arcTestnet.id]: http(),
    [arc.id]: http(),
  },
  ssr: true,
});

const queryClient = new QueryClient();

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </WagmiProvider>
  );
}

function shortAddress(a?: string) {
  return a ? `${a.slice(0, 6)}…${a.slice(-4)}` : "";
}

/** Wallet state for the nav. USDC is the native gas and balance asset on Arc. */
export function WalletButton() {
  const { address, isConnected, chain } = useAccount();
  const { connect, connectors, isPending } = useConnect();
  const { disconnect } = useDisconnect();
  const [err, setErr] = useState<string | null>(null);

  if (isConnected && address) {
    return (
      <div className="flex items-center gap-3">
        <span className="label-xs text-faint">
          {chain?.name === "Arc Testnet" ? "Testnet" : "Arc"}
        </span>
        <button
          onClick={() => disconnect()}
          className="num rounded-[2px] border border-gold/25 px-3 py-1.5 font-mono text-[11px] text-gold transition-colors hover:border-gold/60"
          title="Disconnect"
        >
          {shortAddress(address)}
        </button>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2">
      {err && <span className="label-xs text-stop">{err}</span>}
      <button
        disabled={isPending}
        onClick={async () => {
          setErr(null);
          try {
            const c = connectors[0] ?? injected();
            connect({ connector: c, chainId: arcTestnet.id });
          } catch {
            setErr("No wallet found");
          }
        }}
        className="label-xs rounded-[2px] border border-gold/30 px-3 py-2 text-gold transition-colors hover:border-gold/70 disabled:opacity-50"
      >
        {isPending ? "Connecting" : "Connect wallet"}
      </button>
    </div>
  );
}
