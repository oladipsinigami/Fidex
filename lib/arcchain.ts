/**
 * Arc network facts.
 *
 * Every value in this file was verified against Arc mainnet over JSON-RPC
 * (eth_chainId / eth_call) or quoted verbatim from docs.arc.io, not guessed.
 * See AGENTS.md "Verified chain facts" for the reproduction commands.
 *
 * Gas on Arc is USDC, not ETH. The native asset has 18 decimals, while the
 * ERC-20 interface at USDC_ARC has 6. Never mix them.
 */

export const ARC = {
  chainId: 5042,
  testnetChainId: 5042002,
  /** eth_chainId returned 0x13b2 = 5042. */
  rpc: "https://rpc.mainnet.arc.io",
  testnetRpc: "https://rpc.testnet.arc.io",
  /** docs.arc.io manual-setup tables, all three wallets. */
  explorer: "https://explorer.arc.io",
  testnetExplorer: "https://explorer.testnet.arc.io",
  nativeSymbol: "USDC",
  nativeDecimals: 18,
  /** CCTP domain for Arc, from Circle's contract-address reference. */
  cctpDomain: 26,
  /** Same canonical address on Arc mainnet and testnet. */
  usdc: "0x3600000000000000000000000000000000000000",
  /** USDC ERC-20 decimals() returned 0x06. */
  usdcDecimals: 6,
  tokenMessengerV2: "0x28b5a0e9C621a5BadaA536219b3a228C8168cf5d",
  multicall3: "0xcA11bde05977b3631167028862bE2a173976CA11",
} as const;

export const IS_TESTNET = process.env.NEXT_PUBLIC_ARCGRADE_NETWORK !== "mainnet";

export function explorerAddress(address: string): string {
  const base = process.env.NEXT_PUBLIC_ARCGRADE_NETWORK === "mainnet" ? ARC.explorer : ARC.testnetExplorer;
  return `${base}/address/${address}`;
}

export function explorerTx(hash: string): string {
  const base = process.env.NEXT_PUBLIC_ARCGRADE_NETWORK === "mainnet" ? ARC.explorer : ARC.testnetExplorer;
  return `${base}/tx/${hash}`;
}

/** USDC amounts: 6 decimals on the wire, so always BigInt. */
export function formatUsdc(atomic: bigint, dp = 2): string {
  const whole = atomic / 1_000_000n;
  const frac = atomic % 1_000_000n;
  if (dp <= 0) return whole.toString();
  const f = frac.toString().padStart(6, "0").slice(0, dp);
  return `${whole}.${f}`;
}
