import { defineChain } from "viem";
import type { Chain } from "viem";
import { ARC } from "./arcchain";

/**
 * Arc mainnet. Gas is paid in USDC, not ETH: nativeCurrency is USDC at
 * 18 decimals for the native view, while the ERC-20 interface at USDC_ARC
 * is 6 decimals. Do not mix the two.
 *
 * RPC and explorer values come from docs.arc.io and were confirmed live:
 * eth_chainId on the RPC returns 0x13b2 (5042).
 */
export const arc = defineChain({
  id: ARC.chainId,
  name: "Arc",
  nativeCurrency: { name: "USDC", symbol: "USDC", decimals: ARC.nativeDecimals },
  rpcUrls: { default: { http: [ARC.rpc] } },
  blockExplorers: { default: { name: "Arc Explorer", url: ARC.explorer } },
  testnet: false,
}) as Chain;

export const arcTestnet = defineChain({
  id: ARC.testnetChainId,
  name: "Arc Testnet",
  nativeCurrency: { name: "USDC", symbol: "USDC", decimals: ARC.nativeDecimals },
  rpcUrls: { default: { http: [ARC.testnetRpc] } },
  blockExplorers: { default: { name: "Arc Testnet Explorer", url: ARC.testnetExplorer } },
  testnet: true,
}) as Chain;

/** ERC-20 USDC on Arc: 6 decimals, verified via decimals() = 0x06. */
export const USDC_ARC = ARC.usdc;

export { ARC } from "./arcchain";
export { AG, LIVE as PAYMENT_FACILITATOR, PAY_TO, PRICE_DOSSIER, PRICE_AXIS } from "./x402";

