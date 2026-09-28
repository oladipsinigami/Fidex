import { ax, c, type Raw } from "./axes";

export const weth: Raw = {
  slug: "weth-arc",
  name: "Wrapped Ether (Arc)",
  monogram: "WE",
  category: "Asset",
  chainFocus: "Arc mainnet (bridged via Gateway/CCTP)",
  arcRoute: "bridged-gateway",
  tagline: "The premier non-native collateral asset across Arc money markets.",
  verdict:
    "Liquid collateral asset on Arc lending pools. Security is bound to Circle Gateway bridge verification and mainnet L1 custody.",
  dossierVerdict:
    "Wrapped Ether on Arc represents canonical bridged ETH escrowed via Circle Gateway and verified bridge validators. It acts as the primary non-stable collateral asset across Morpho Blue and Aave V4 instances on Arc. Price discovery follows global ETH spot markets tightly via arbitrage against native USDC. The fundamental tail risk sits with bridge validator consensus and L1 lockbox contract integrity.",
  axes: [
    ax(
      "security",
      88,
      "Standard canonical WETH9 contract bytecode on Arc.",
      "The contract implementation matches standard canonical WETH wrappers without proprietary modifications. Arc EVM execution prevents reentrancy issues at the gas scheduling level.",
      [
        c("WETH Contract", "https://explorer.arc.io", "explorer"),
        c("Circle Gateway Specs", "https://docs.circle.com/gateway", "docs"),
      ],
    ),
    ax(
      "liquidity",
      86,
      "Deepest non-stable asset pool on Arc AMMs.",
      "Active liquidity exceeds $42M across Arctide and Uniswap pools on Arc. Price divergence against Binance/Coinbase ETH/USD remains under 4 basis points at institutional sizing.",
      [
        c("Arctide WETH-USDC", "https://explorer.arc.io", "defi"),
        c("DeFiLlama Arc", "https://defillama.com/chain/Arc", "defi"),
      ],
    ),
    ax(
      "decentralization",
      74,
      "Bridge attestations require multisig quorum.",
      "Minting on Arc requires cryptographic attestation of L1 deposit events signed by the validator set. There is no single master private key that can mint unbacked WETH.",
      [
        c("Bridge Validator Set", "https://docs.circle.com/gateway", "docs"),
      ],
    ),
    ax(
      "audits",
      92,
      "Bridge and token wrappers audited by top security firms.",
      "The underlying bridge infrastructure has passed comprehensive formal audits from OpenZeppelin and Trail of Bits with zero critical findings outstanding.",
      [
        c("OpenZeppelin Audit", "https://www.openzeppelin.com", "audit"),
      ],
    ),
    ax(
      "concentration",
      78,
      "Collateral held in shared Morpho & Aave escrow pools.",
      "Over 65% of floating WETH on Arc is deposited as collateral in lending markets, distributing ownership across thousands of unique liquidator bots and market makers.",
      [
        c("Arc Explorer Holders", "https://explorer.arc.io", "explorer"),
      ],
    ),
    ax(
      "history",
      94,
      "Underlying asset has 10+ years of flawless operation.",
      "Ethereum spot backing has survived major market liquidation cascades and proof-of-stake transitions without systemic ledger halts.",
      [
        c("Ethereum Foundation", "https://ethereum.org", "docs"),
      ],
    ),
    ax(
      "governance",
      82,
      "Decentralized Ethereum L1 governance.",
      "Core token parameters cannot be altered on Arc without full consensus upgrades. The wrapper contract itself is immutable.",
      [
        c("EIP Repository", "https://eips.ethereum.org", "docs"),
      ],
    ),
    ax(
      "yieldSustainability",
      70,
      "Non-yielding spot commodity asset.",
      "Base WETH provides 0% organic yield. Depositors seeking returns must supply to Morpho or provide liquidity on Arctide AMMs.",
      [
        c("Morpho Arc Vaults", "https://morpho.org", "defi"),
      ],
    ),
    ax(
      "arcFit",
      84,
      "Essential collateral for Arc lending ecosystems.",
      "Bridged through canonical Circle Gateway routes to provide non-stable collateral essential for capital efficiency on Arc.",
      [
        c("Arc Docs", "https://docs.arc.network", "arc"),
      ],
    ),
  ],
  delta7d: 2,
  tvlUsd: 42_500_000,
  apy: null,
  yieldNote: "Spot commodity asset. Supply to Morpho Blue for ~2.4% APY.",
  killShots: [
    {
      title: "Bridge Lockbox Compromise",
      detail: "If the Ethereum L1 custody contract were drained, Arc WETH would become unbacked and experience a severe depeg.",
      axis: "security",
    },
    {
      title: "Sudden Liquidation Cascade",
      detail: "A 40% rapid drop in global ETH spot price could trigger automated lending liquidations that overwhelm Arc AMM depth.",
      axis: "liquidity",
    },
  ],
  unlocks: [],
  incidents: [],
  updatedAt: "2026-09-26T18:00:00.000Z",
  analystId: "analyst-001",
  contentHash: "0x7a3e9c1b5d8f2a4e6c0b3d5f7a9e1c3b5d7f9a1e3c5b7d9f1a3e5c7b9d1f3a5e",
  related: ["morpho-arc", "aave-v4-arc", "arctide-dex"],
};
