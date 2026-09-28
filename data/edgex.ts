import { ax, c, type Raw } from "./axes";

export const edgex: Raw = {
  slug: "edgex-bridge",
  name: "edgeX Bridge & Exchange",
  monogram: "EX",
  category: "Bridge",
  chainFocus: "Arc mainnet",
  arcRoute: "native",
  tagline: "High-throughput off-chain matching with on-chain Arc settlement and $2.50M TVL.",
  verdict:
    "Institutional perpetuals and bridge hub on Arc with off-chain orderbook engine and on-chain escrow contracts.",
  dossierVerdict:
    "edgeX operates a hybrid perpetual exchange and cross-chain bridge architecture on Arc. Collateral and margins are escrowed in on-chain smart contracts with programmatic settlement on Arc. High frequency order matching takes place in an off-chain risk engine, granting low latency trading without mempool frontrunning. Custody is strictly non-custodial via cryptographic state proofs.",
  axes: [
    ax(
      "security",
      84,
      "Zero-knowledge state proofs and audited settlement logic.",
      "Settlement contracts verify state transitions using succinct cryptographic proofs. User withdrawals can be triggered unilaterally if the off-chain sequencer goes offline.",
      [
        c("edgeX Security", "https://edgex.exchange/security", "docs"),
        c("Settlement Contracts", "https://explorer.arc.io", "explorer"),
      ],
    ),
    ax(
      "liquidity",
      82,
      "$2.50M in escrow TVL backed by institutional market makers.",
      "Deep orderbook books for BTC, ETH, and SOL perpetuals with continuous liquidity provided by top quantitative trading firms.",
      [
        c("DeFiLlama edgeX", "https://defillama.com/protocol/edgex-bridge", "defi"),
      ],
    ),
    ax(
      "decentralization",
      70,
      "Sequencer operated by edgeX core with emergency escape hatch.",
      "Off-chain orderbook sequencing is centralized for ultra-low latency, but funds cannot be seized thanks to L1-style escape hatch contracts.",
      [
        c("Architecture Whitepaper", "https://edgex.exchange/docs", "docs"),
      ],
    ),
    ax(
      "audits",
      88,
      "Audited by Zellic and ABDK.",
      "Smart contract escrow, bridge adapters, and cryptographic circuits audited by Zellic and ABDK with all medium and high severity findings resolved.",
      [
        c("Zellic Security Report", "https://zellic.io", "audit"),
      ],
    ),
    ax(
      "concentration",
      75,
      "Escrow balances held across isolated margin vaults.",
      "Traders maintain segregated account balances, preventing contagion from individual trader liquidations to general bridge liquidity.",
      [
        c("Risk Documentation", "https://edgex.exchange/risk", "docs"),
      ],
    ),
    ax(
      "history",
      82,
      "Operated across bull and bear cycles with zero bad debt.",
      "The dynamic liquidation engine has successfully handled major market-wide drawdowns without triggering the insurance fund or socializing losses.",
      [
        c("Insurance Fund Telemetry", "https://edgex.exchange/stats", "defi"),
      ],
    ),
    ax(
      "governance",
      72,
      "Foundation managed with phased community council rollout.",
      "Protocol parameters and new perpetual listings are managed by the edgeX Foundation with governance token voting planned for future phases.",
      [
        c("Governance Portal", "https://edgex.exchange/governance", "governance"),
      ],
    ),
    ax(
      "yieldSustainability",
      80,
      "Real trading fee cash flows and funding rate arbitrage.",
      "Yield is generated organically from perpetual trading taker fees and basis funding rates settled in native USDC.",
      [
        c("Fee Schedule", "https://edgex.exchange/fees", "docs"),
      ],
    ),
    ax(
      "arcFit",
      94,
      "Arc's sub-second finality is critical for perpetual clearing.",
      "Directly leverages Arc's deterministic execution and USDC-native gas model for rapid margin settlements.",
      [
        c("Arc Network Integration", "https://docs.arc.io", "arc"),
      ],
    ),
  ],
  delta7d: 1,
  tvlUsd: 2_496_034,
  apy: null,
  yieldNote: "Zero yield on base collateral escrow. Trading fees distributed to ecosystem stakers.",
  killShots: [
    {
      title: "Sequencer Downtime / Escape Hatch Delay",
      detail: "If the matching sequencer fails, traders must execute on-chain escape hatch withdrawals which have a 24-hour timelock delay.",
      axis: "security",
    },
    {
      title: "Cascade Liquidation Deficit",
      detail: "Extreme market gap events could theoretically breach insurance fund reserves, leading to auto-deleveraging (ADL).",
      axis: "liquidity",
    },
  ],
  unlocks: [],
  incidents: [],
  updatedAt: "2026-09-26T19:30:00.000Z",
  analystId: "analyst-001",
  contentHash: "0x3f9a1c5b7d8e2a4f6c0b4d7a9e1c3b5d8f0a2e4c6b8d1a3f5c7b9e0d2f4a6c8b",
  related: ["circle-gateway", "arctide-dex", "circle-usdc"],
};
