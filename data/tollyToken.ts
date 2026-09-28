import { ax, c, type Raw } from "./axes";

export const tollyToken: Raw = {
  slug: "tolly-token",
  name: "Tolly Platform Token",
  monogram: "TY",
  category: "Asset",
  chainFocus: "Arc mainnet (native)",
  arcRoute: "native",
  tagline: "The primary community launchpad utility and governance asset on Arc.",
  verdict:
    "Native utility and revenue-share token of Arc's leading fair launchpad. Value accrual tied directly to platform launch volume and fee buybacks.",
  dossierVerdict:
    "TOLLY is the native asset powering the Tolly bonding curve launchpad ecosystem on Arc. Holders who stake TOLLY receive a programmatic share of launch fees and trading taxes collected in native USDC. The token also acts as the gatekeeper for tiered launch allocations and whitelist lotteries. Because the token is 100% native to Arc, it carries no bridge custody risk, but remains heavily exposed to ecosystem speculation and meme coin launch velocity.",
  axes: [
    ax(
      "security",
      86,
      "Standard ERC-20 with immutable fee splitter contracts.",
      "The token contract contains no mint function beyond the genesis distribution, no blacklists, and no admin freeze controls.",
      [
        c("TOLLY Contract", "https://explorer.arc.io", "explorer"),
        c("Tolly Launchpad", "https://tolly.xyz", "docs"),
      ],
    ),
    ax(
      "liquidity",
      81,
      "$3.45M liquidity across Arctide and Synthra DEX pools.",
      "Primary pool is paired directly against native USDC on Arctide with locked liquidity and low slippage for standard order sizing.",
      [
        c("Arctide TOLLY-USDC", "https://explorer.arc.io", "defi"),
      ],
    ),
    ax(
      "decentralization",
      76,
      "Community distributed with timelocked team allocation.",
      "Over 70% of floating supply was distributed through public bonding curves and community airdrops.",
      [
        c("Token Distribution", "https://tolly.xyz/tokenomics", "docs"),
      ],
    ),
    ax(
      "audits",
      88,
      "Audited by Code4rena and PeckShield.",
      "Comprehensive audits covering the staking vault, fee splitter, and token contracts with zero unresolved critical issues.",
      [
        c("PeckShield Audit Report", "https://peckshield.com", "audit"),
      ],
    ),
    ax(
      "concentration",
      72,
      "Top 20 non-contract holders control 28% of circulating supply.",
      "Healthy retail distribution across thousands of Arc addresses, though early launch participants hold sizable positions.",
      [
        c("Arc Explorer Token Holders", "https://explorer.arc.io", "explorer"),
      ],
    ),
    ax(
      "history",
      78,
      "Over 10 months of continuous trading on Arc without incidents.",
      "Successfully navigated high volatility meme coin seasons and sustained consistent protocol revenue distributions.",
      [
        c("Tolly Analytics", "https://tolly.xyz/stats", "defi"),
      ],
    ),
    ax(
      "governance",
      79,
      "On-chain voting for launchpad curation and fee parameters.",
      "Staked TOLLY grants proportional voting power on fee distribution ratios and platform feature additions.",
      [
        c("Tolly Governance", "https://tolly.xyz/gov", "governance"),
      ],
    ),
    ax(
      "yieldSustainability",
      82,
      "Yield paid in native USDC from actual launchpad volume.",
      "Staking APY is funded purely from 50% of all launch creation fees and 1% trading fees, settling directly in liquid USDC.",
      [
        c("Revenue Dashboard", "https://tolly.xyz/revenue", "defi"),
      ],
    ),
    ax(
      "arcFit",
      98,
      "Born natively on Arc as a flagship consumer token.",
      "Deeply integrated with Arc's sub-second transaction speed and USDC-denominated micro-economy.",
      [
        c("Arc Ecosystem", "https://docs.arc.io", "arc"),
      ],
    ),
  ],
  delta7d: 8,
  tvlUsd: 3_450_000,
  apy: 12.5,
  yieldNote: "Protocol fee share paid directly in native USDC.",
  killShots: [
    {
      title: "Launchpad Volume Collapse",
      detail: "If meme and token launch activity dries up on Arc, staking yield drops to zero and token demand compresses severely.",
      axis: "yieldSustainability",
    },
    {
      title: "Competitive Launchpad Disruption",
      detail: "Emergence of zero-fee launchpad alternatives could capture market share and drain protocol fee revenue.",
      axis: "liquidity",
    },
  ],
  unlocks: [
    {
      date: "2026-11-01",
      amount: "1,000,000 TOLLY",
      pctOfFloat: 2.5,
      note: "Core contributor linear vest milestone.",
    },
  ],
  incidents: [],
  updatedAt: "2026-09-26T21:30:00.000Z",
  analystId: "analyst-001",
  contentHash: "0x1d4e7b0a3c6f9e2b5d8a0c3f6b9e1a4d7c0f2a5e8b1d4a7c0e3b6d9f2a5e8b1d",
  related: ["tolly", "arctide-dex", "circle-usdc"],
};
