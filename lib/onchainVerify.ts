import { ARC } from "./arcchain";
import { isTxHashUsed } from "./db";

const RPC_URL = process.env.ARCGRADE_TESTNET_RPC ?? ARC.testnetRpc;

export interface OnChainVerificationResult {
  ok: boolean;
  payer?: string;
  txHash?: string;
  reason?: string;
}

/**
 * Verifies that a transaction on Arc Testnet successfully transferred
 * at least $0.01 USDC (10,000 atomic ERC-20 units or equivalent native USDC)
 * to the configured ARCGRADE_PAY_TO address.
 */
export async function verifyArcTestnetTx(
  txHash: string,
  expectedPayTo: string,
): Promise<OnChainVerificationResult> {
  const cleanHash = txHash.trim().toLowerCase();
  if (!/^0x[a-f0-9]{64}$/.test(cleanHash)) {
    return { ok: false, reason: "invalid_tx_hash_format" };
  }

  // Prevent double-spending / transaction replay attacks via persistent SQLite.
  //
  // This MUST fail closed. `isTxHashUsed` throws when the receipt store is
  // unreachable, because a store that cannot answer is not the same as a store
  // that has never seen the hash. Treating "cannot tell" as "not spent" would
  // hand out a free receipt for any payment whose hash is not in the live
  // instance's memory -- exactly the bypass the paywall exists to prevent.
  try {
    if (isTxHashUsed(cleanHash)) {
      return { ok: false, reason: "transaction_already_used" };
    }
  } catch (err) {
    return {
      ok: false,
      reason: `replay_check_unavailable: ${err instanceof Error ? err.message : String(err)}`,
    };
  }

  const cleanPayTo = expectedPayTo.toLowerCase().replace(/^0x/, "");

  try {
    // 1. Fetch transaction receipt from Arc Testnet RPC
    const receiptRes = await fetch(RPC_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "eth_getTransactionReceipt",
        params: [cleanHash],
      }),
      signal: AbortSignal.timeout(10_000),
    });

    const receiptData = await receiptRes.json();
    const receipt = receiptData?.result;

    if (!receipt) {
      return { ok: false, reason: "tx_receipt_not_found_or_pending" };
    }

    // Status 0x1 means execution succeeded
    if (receipt.status !== "0x1") {
      return { ok: false, reason: "transaction_reverted" };
    }

    // 2. Fetch transaction details to inspect value/input
    const txRes = await fetch(RPC_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 2,
        method: "eth_getTransactionByHash",
        params: [cleanHash],
      }),
      signal: AbortSignal.timeout(10_000),
    });

    const txData = await txRes.json();
    const tx = txData?.result;

    if (!tx) {
      return { ok: false, reason: "tx_details_not_found" };
    }

    const payer = (tx.from as string).toLowerCase();

    // Check Case A: ERC-20 USDC transfer on Arc Testnet
    // Contract: 0x3600000000000000000000000000000000000000
    // Transfer method: 0xa9059cbb + 32-byte recipient + 32-byte amount
    const isErc20Usdc = (tx.to as string)?.toLowerCase() === ARC.usdc.toLowerCase();
    const input = (tx.input as string)?.toLowerCase() ?? "";

    if (isErc20Usdc && input.startsWith("0xa9059cbb")) {
      const recipient = input.slice(34, 74);
      const amountHex = "0x" + input.slice(74, 138);
      const amount = BigInt(amountHex || "0x0");

      if (recipient !== cleanPayTo) {
        return { ok: false, reason: "wrong_erc20_recipient" };
      }

      // Minimum 10,000 atomic units ($0.01 USDC)
      if (amount < 10_000n) {
        return { ok: false, reason: "insufficient_usdc_amount" };
      }

      return { ok: true, payer, txHash: cleanHash };
    }

    // Check Case B: Native USDC transfer on Arc (where gas/native token is USDC)
    const isNativeTransfer = (tx.to as string)?.toLowerCase() === expectedPayTo.toLowerCase();
    const nativeValue = BigInt(tx.value ?? "0x0");

    // Native USDC on Arc has 18 decimals, so $0.01 = 10,000,000,000,000,000 wei (10^16)
    if (isNativeTransfer && nativeValue >= 10_000_000_000_000_000n) {
      return { ok: true, payer, txHash: cleanHash };
    }

    return { ok: false, reason: "transaction_does_not_pay_seller" };
  } catch (err) {
    return {
      ok: false,
      reason: `rpc_error: ${err instanceof Error ? err.message : String(err)}`,
    };
  }
}
