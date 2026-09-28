import { ax, c, type Raw } from "./axes";

export const argus: Raw = {
  slug: "argus-world",
  name: "Argus World",
  monogram: "AW",
  category: "Launchpad",
  chainFocus: "Arc mainnet",
  arcRoute: "native",
  tagline: "Execution-focused game engine and fair launch platform on Arc ($1.87M TVL).",
  verdict:
    "Next-generation gaming runtime and world launchpad on Arc utilizing deterministic state transitions and sharded world state.",
  dossierVerdict:
    "Argus World is built on the World Engine, a sharded execution environment designed for sovereign on-chain games and virtual worlds. On Arc, Argus provides token launch, asset bonding, and world-state settlement in native USDC. High TVL reflects committed game studio escrows and world-state liquidity bonds. The primary vulnerability stems from complex off-chain state synchronizers and custom game engine rollups.",
  axes: [
    ax(
      "security",
      81,
      "Modular rollup architecture with fraud proof verification.",
      "Game tick execution runs in high-throughput shards with periodic state checkpointing to Arc EVM smart contracts.",
      [
        c("World Engine Docs", "https://argus.gg/docs", "docs"),
        c("Arc Explorer", "https://explorer.arc.io", "explorer"),
      ],
    ),
    ax(
      "liquidity",
      79,
      "$1.87M locked in world treasury and launchpad bonding curves.",
      "Sufficient liquidity for in-game currency exchanges and world plot auctions denominated in USDC.",
      [
        c("DeFiLlama Argus", "https://defillama.com/protocol/argus-world", "defi"),
      ],
    ),
    ax(
      "decentralization",
      72,
      "Decentralizing sequencers across partner gaming studios.",
      "Studio partner nodes validate game state transitions; full permissionless validator onboarding is currently in testnet phase.",
      [
        c("Argus Architecture", "https://argus.gg", "docs"),
      ],
    ),
    ax(
      "audits",
      85,
      "Smart contracts audited by Halborn and OtterSec.",
      "Core token contracts, bonding curves, and bridge connectors completed full audits with clean resolution status.",
      [
        c("Halborn Security Audit", "https://halborn.com", "audit"),
      ],
    ),
    ax(
      "concentration",
      68,
      "Significant treasury concentration in pilot game ecosystems.",
      "The top three game titles account for roughly 60% of total world TVL and active user transaction throughput.",
      [
        c("Ecosystem Dashboard", "https://argus.gg/ecosystem", "defi"),
      ],
    ),
    ax(
      "history",
      80,
      "Over 2 years of active development and high load stress tests.",
      "Successfully processed millions of simulated gameplay ticks without state divergence or loss of escrowed assets.",
      [
        c("Stress Test Reports", "https://argus.gg/blog", "docs"),
      ],
    ),
    ax(
      "governance",
      74,
      "World council governance with studio stakeholder voting.",
      "Upgrades to core world parameters require multi-party consensus between game operators and player delegates.",
      [
        c("Council Framework", "https://argus.gg/governance", "governance"),
      ],
    ),
    ax(
      "yieldSustainability",
      75,
      "Real revenue from game marketplace fees and land sales.",
      "Platform income is derived from organic in-game asset transactions rather than inflationary token printing.",
      [
        c("Revenue Analytics", "https://argus.gg", "defi"),
      ],
    ),
    ax(
      "arcFit",
      91,
      "Arc's low-latency block times match game tick settlement requirements.",
      "Fast finality and cheap USDC micro-transactions allow real-time game item mints and world trade settlement.",
      [
        c("Arc Network Integration", "https://docs.arc.network", "arc"),
      ],
    ),
  ],
  delta7d: 5,
  tvlUsd: 1_868_758,
  apy: null,
  yieldNote: "Marketplace transaction fees & world asset leasing revenue.",
  killShots: [
    {
      title: "Game Shard State Desync",
      detail: "A state divergence between the off-chain game execution engine and Arc on-chain settlement could freeze in-game asset withdrawals.",
      axis: "security",
    },
    {
      title: "Studio Departure Liquidity Shock",
      detail: "If a marquee game title migrates to an alternative network, associated bonding curve liquidity would withdraw sharply.",
      axis: "concentration",
    },
  ],
  unlocks: [],
  incidents: [],
  updatedAt: "2026-09-26T21:00:00.000Z",
  analystId: "analyst-002",
  contentHash: "0x5a1e3c7b9d0f2a4e6c8b1d3f5a7e9c1b3d5f7a0e2c4b6d8f1a3c5e7b9d1f3a5e",
  related: ["tolly", "circle-usdc", "arctide-dex"],
};
