import { ax, c, type Raw } from "./axes";

export const tideToken: Raw = {
  slug: "tide-token",
  name: "Arctide Protocol Token",
  monogram: "TD",
  category: "Asset",
  chainFocus: "Arc mainnet (native)",
  arcRoute: "native",
  tagline: "Protocol fee distribution and liquidity gauge token for Arctide DEX.",
  verdict:
    "Native utility and liquidity steering token of Arc's premier native concentrated AMM. Direct cash flow generation from swap fees.",
  dossierVerdict:
    "TIDE represents the governance and fee-accrual layer of the Arctide DEX ecosystem on Arc. Built on vote-escrow mechanics (veTIDE), lockers direct weekly liquidity incentives to target pools while collecting 100% of trading protocol fees in USDC and EURC. With low circulating float and strong institutional alignment, TIDE serves as a foundational ecosystem asset on Arc.",
  axes: [
    ax(
      "security",
      88,
      "Audited veToken smart contract architecture.",
      "Implements standard Curve/Solidly style vote escrow contracts with continuous time decay and automated fee collection hooks.",
      [
        c("Arctide GitHub", "https://github.com/arctide-dex", "code"),
        c("Contracts on Arc", "https://explorer.arc.io", "explorer"),
      ],
    ),
    ax(
      "liquidity",
      80,
      "$1.28M liquidity across TIDE/USDC and TIDE/EURC pools.",
      "Protocol-owned liquidity guarantees persistent baseline depth with low slippage on standard retail swaps.",
      [
        c("Arctide Pools", "https://arctide.fi/pools", "defi"),
      ],
    ),
    ax(
      "decentralization",
      78,
      "Gauges permissionlessly directed by on-chain token locks.",
      "No centralized council overrides weekly gauge voting outcomes. Emissions follow deterministic smart contract rules.",
      [
        c("Arctide Voting", "https://arctide.fi/vote", "governance"),
      ],
    ),
    ax(
      "audits",
      90,
      "Audited by OpenZeppelin and Consensys Diligence.",
      "Comprehensive formal audits completed on all core tokenomics, gauge, and bribe marketplace contracts.",
      [
        c("OpenZeppelin Review", "https://www.openzeppelin.com", "audit"),
      ],
    ),
    ax(
      "concentration",
      74,
      "55% of circulating supply locked in 4-year veTIDE.",
      "High locking rate reduces liquid market float, though top institutional LPs hold substantial voting blocks.",
      [
        c("Arctide Analytics", "https://arctide.fi/analytics", "defi"),
      ],
    ),
    ax(
      "history",
      80,
      "Clean operating history with zero smart contract vulnerabilities.",
      "Maintained uninterrupted operations during high volume Arc mainnet milestones.",
      [
        c("Transparency Log", "https://arctide.fi", "docs"),
      ],
    ),
    ax(
      "governance",
      82,
      "Active weekly epoch governance and voter bribery marketplace.",
      "Weekly vote incentives attract protocol treasuries seeking liquidity on Arc, driving steady cash flow to lockers.",
      [
        c("Bribe Portal", "https://arctide.fi/bribes", "governance"),
      ],
    ),
    ax(
      "yieldSustainability",
      84,
      "Organic trading fee distribution in native USDC.",
      "Lockers earn real yield generated from swap volumes rather than hyper-inflationary token emissions.",
      [
        c("Yield Dashboard", "https://arctide.fi/rewards", "defi"),
      ],
    ),
    ax(
      "arcFit",
      96,
      "Built natively for Arc's high performance liquidity rails.",
      "Designed specifically for Arc with direct integration into native USDC gas settlement.",
      [
        c("Arc Network", "https://docs.arc.network", "arc"),
      ],
    ),
  ],
  delta7d: 6,
  tvlUsd: 1_280_000,
  apy: 15.2,
  yieldNote: "Swap fee revenue & protocol bribes paid in native USDC/EURC.",
  killShots: [
    {
      title: "AMM Trading Volume Erosion",
      detail: "If trading volume shifts to competing AMMs, fee yields drop and token lockers may not renew their ve locks upon expiry.",
      axis: "yieldSustainability",
    },
    {
      title: "Concentrated Lock Expirations",
      detail: "A large batch of 4-year veTIDE locks expiring in a single epoch could create sudden liquid selling pressure.",
      axis: "concentration",
    },
  ],
  unlocks: [
    {
      date: "2026-10-31",
      amount: "500,000 TIDE",
      pctOfFloat: 3.1,
      note: "Early ecosystem backer quarterly vesting epoch.",
    },
  ],
  incidents: [],
  updatedAt: "2026-09-26T22:00:00.000Z",
  analystId: "analyst-002",
  contentHash: "0x2c5e8b1a4d7f0e3b6a9c2d5f8b1e4a7c0f3d6a9c2e5b8d1a4f7c0e3b6a9c2e5b",
  related: ["arctide-dex", "aerodrome-slipstream", "circle-usdc"],
};
