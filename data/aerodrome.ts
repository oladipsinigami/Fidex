import { ax, c, type Raw } from "./axes";

export const aerodrome: Raw = {
  slug: "aerodrome-slipstream",
  name: "Aerodrome Slipstream",
  monogram: "AS",
  category: "DEX",
  chainFocus: "Arc mainnet",
  arcRoute: "native",
  tagline: "Concentrated liquidity engine on Arc with over $3.08M in tracked TVL.",
  verdict:
    "Primary AMM engine bringing Velodrome/Aerodrome concentrated liquidity mechanics and ve-tokenomics to Arc.",
  dossierVerdict:
    "Aerodrome Slipstream on Arc delivers ticks-based concentrated liquidity alongside gauge voting and automated emissions. Contracts derive from the battle-tested Uniswap V3 core with Aerodrome's proprietary veAERO voter governance. Liquidity depth is backed by high-volume USDC pairs. The primary risk surfaces involve gauge manipulation and rapid emissions dilution during token volatility.",
  axes: [
    ax(
      "security",
      87,
      "Battle-tested concentrated AMM math.",
      "Slipstream code inherits audited Uniswap V3 concentrated liquidity math combined with Aerodrome gauge mechanics. No critical vulnerabilities found across 2+ years of production.",
      [
        c("Aerodrome GitHub", "https://github.com/aerodrome-finance", "code"),
        c("Audits Directory", "https://aerodrome.finance/audits", "audit"),
      ],
    ),
    ax(
      "liquidity",
      84,
      "$3.08M TVL deployed across major Arc pools.",
      "Aerodrome holds the largest non-USDC AMM liquidity book on Arc, featuring ultra-tight spreads for USDC, EURC, and WETH swaps.",
      [
        c("DeFiLlama Aerodrome Arc", "https://defillama.com/protocol/aerodrome-slipstream", "defi"),
        c("Arc Explorer", "https://explorer.arc.io", "explorer"),
      ],
    ),
    ax(
      "decentralization",
      75,
      "Gauges directed by locked veAERO votes.",
      "Pool emissions are controlled trustlessly by on-chain voting gauges. Timelocks protect pool factory configuration updates.",
      [
        c("Aerodrome Governance", "https://aerodrome.finance/vote", "governance"),
      ],
    ),
    ax(
      "audits",
      89,
      "Audited by OpenZeppelin, yAcademy, and Spearbit.",
      "Multiple independent security audits conducted prior to deployment, covering concentrated liquidity CLPools and voting escrow.",
      [
        c("Spearbit Security Review", "https://spearbit.com", "audit"),
      ],
    ),
    ax(
      "concentration",
      73,
      "Liquidity concentrated in top 3 pools.",
      "USDC/EURC and WETH/USDC account for 78% of total protocol TVL, exposing overall platform volume to pair-specific flow.",
      [
        c("Pool Analytics", "https://aerodrome.finance", "defi"),
      ],
    ),
    ax(
      "history",
      86,
      "Proven track record with zero smart contract exploits.",
      "Consistently processed hundreds of millions in volume without liquidity drain incidents or mathematical exploit vectors.",
      [
        c("Incident Log", "https://aerodrome.finance", "docs"),
      ],
    ),
    ax(
      "governance",
      80,
      "Active weekly epoch governance and voter rewards.",
      "Weekly bribe distributions and emissions weighting provide high governance participation from institutional allocators.",
      [
        c("Bribes & Gauges", "https://aerodrome.finance", "governance"),
      ],
    ),
    ax(
      "yieldSustainability",
      76,
      "Real trading fees augmented by ve emissions.",
      "High trading volumes on Arc USDC pairs generate real organic fee yield, reducing reliance on pure speculative emissions.",
      [
        c("Fee Analytics", "https://defillama.com", "defi"),
      ],
    ),
    ax(
      "arcFit",
      92,
      "Custom gas optimizations for Arc's native USDC fee structure.",
      "Deploys directly on Arc, taking advantage of predictable sub-cent gas fees denominated in native USDC.",
      [
        c("Arc Ecosystem", "https://docs.arc.network", "arc"),
      ],
    ),
  ],
  delta7d: 4,
  tvlUsd: 3_081_635,
  apy: 18.4,
  yieldNote: "Swap fee revenue + veAERO weekly gauge voting rewards.",
  killShots: [
    {
      title: "Gauge Voting Manipulation",
      detail: "A large capital provider could acquire dominant ve voting power to redirect emissions to malicious or unbacked liquidity pools.",
      axis: "governance",
    },
    {
      title: "Concentrated Tick Depletion",
      detail: "Severe market volatility can move prices out of active concentrated ranges, causing LP fee dry-ups.",
      axis: "liquidity",
    },
  ],
  unlocks: [
    {
      date: "2026-10-15",
      amount: "2,500,000 veAERO",
      pctOfFloat: 3.2,
      note: "Quarterly institutional LP lock vesting epoch.",
    },
  ],
  incidents: [],
  updatedAt: "2026-09-26T20:00:00.000Z",
  analystId: "analyst-002",
  contentHash: "0x8b4f1d3c6e9a2b5d7f0e3a6c9b2d5f8a1c4e7b0d3f6a9c2e5b8d1a4f7c0e3b6a",
  related: ["uniswap-v3-arc", "arctide-dex", "circle-usdc"],
};
