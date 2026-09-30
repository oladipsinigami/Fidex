/**
 * Live x402 settlement on Arc via Circle Gateway nanopayments.
 *
 * Buys one real dossier with real USDC and asserts the server returns 200 with
 * a settlement reference. Network comes from FIDEX_NETWORK / ARCGRADE_NETWORK
 * and DEFAULTS TO TESTNET, so an unset environment can never spend mainnet
 * funds. Testnet settlement is well exercised; mainnet has never been settled
 * before, which is why the challenge is asserted against the per-network
 * Gateway wallet as well as the chain id.
 *
 *   ARCGRADE_BUYER_PRIVATE_KEY  0x... with USDC on the target network
 *   ARCGRADE_PAY_TO             your seller address (receives the funds)
 *   ARCGRADE_URL                default http://127.0.0.1:4597
 *   SLUG                        default aave-v4-arc
 *
 * Must differ from the buyer. Circle's facilitator rejects a payment whose
 * payer equals its payTo with self_transfer, which is correct: if paying
 * yourself were allowed, anyone could unlock paid content with a wallet that
 * never spends anything, so the payment would prove nothing.
 *
 * Testnet USDC: https://faucet.circle.com
 *
 *   FIDEX_NETWORK=testnet  node scripts/settle-live.mjs
 *   FIDEX_NETWORK=mainnet  node scripts/settle-live.mjs
 */
import { spawn } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import crypto from "node:crypto";
import readline from "node:readline";
import { privateKeyToAccount } from "viem/accounts";
import { keccak256 } from "viem";

// Load local environment if present
if (existsSync(".env.local") && typeof process.loadEnvFile === "function") {
  process.loadEnvFile(".env.local");
} else if (existsSync(".env") && typeof process.loadEnvFile === "function") {
  process.loadEnvFile(".env");
}

const PORT = 4597;
const URL = process.env.FIDEX_URL ?? process.env.ARCGRADE_URL ?? `http://127.0.0.1:${PORT}`;
const SLUG = process.env.FIDEX_SLUG ?? process.env.ARCGRADE_SLUG ?? process.env.SLUG ?? "aave-v4-arc";
const PAY_TO = process.env.FIDEX_PAY_TO ?? process.env.ARCGRADE_PAY_TO;

/**
 * Network selection.
 *
 * Previously hardcoded to testnet: the RPC, the env handed to the spawned
 * server, and a bare assertion on eip155:5042002. That made mainnet settlement
 * impossible to test at all, which is the one thing that most needed proving
 * before a mainnet flip. Defaults to testnet so an unset environment can never
 * accidentally spend real USDC.
 *
 * Circle runs a separate Gateway per network, and each serves only its own
 * chains, so the wrong host answers unsupported_network for a chain it supports
 * on the other host. lib/x402.ts picks the host from the same variable.
 */
const NETWORK = (process.env.FIDEX_NETWORK ?? process.env.ARCGRADE_NETWORK ?? "testnet").toLowerCase();
const NETWORKS = {
  mainnet: {
    chainId: 5042,
    caip: "eip155:5042",
    rpc: "https://rpc.mainnet.arc.io",
    rpcEnv: ["FIDEX_MAINNET_RPC", "ARCGRADE_MAINNET_RPC"],
    label: "Arc mainnet",
    fundHint: "fund the buyer with mainnet USDC (native gas on Arc) before re-running",
  },
  testnet: {
    chainId: 5042002,
    caip: "eip155:5042002",
    rpc: "https://rpc.testnet.arc.io",
    rpcEnv: ["FIDEX_TESTNET_RPC", "ARCGRADE_TESTNET_RPC"],
    label: "Arc testnet",
    fundHint: "use the Circle Faucet (https://faucet.circle.com), then re-run",
  },
};
if (!NETWORKS[NETWORK]) {
  console.error(`Unknown FIDEX_NETWORK "${NETWORK}". Use testnet or mainnet.`);
  process.exit(1);
}
const NET = NETWORKS[NETWORK];
// Override the RPC if the public endpoint is unreachable.
const ARC_RPC =
  NET.rpcEnv.map((k) => process.env[k]).find(Boolean) ?? NET.rpc;

async function promptKeystorePassword(accountName) {
  // Foundry's own convention: honour the env var so this can run
  // non-interactively (CI, or an agent that cannot type into a TTY). The
  // interactive prompt stays the default.
  const fromEnv = process.env.FOUNDRY_PASSWORD ?? process.env.ARCGRADE_KEYSTORE_PASSWORD;
  if (fromEnv) {
    process.stdout.write(`Password for Foundry keystore [${accountName}] from env\n`);
    return fromEnv;
  }
  return new Promise((resolve) => {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });
    process.stdout.write(`Enter password for Foundry keystore [${accountName}]: `);
    const stdin = process.stdin;
    const isTTY = Boolean(stdin.isTTY);
    if (isTTY) stdin.setRawMode(true);
    let password = "";
    const onData = (chunk) => {
      const s = chunk.toString("utf8");
      for (const char of s) {
        if (char === "\r" || char === "\n" || char === "\u0004") {
          if (isTTY) stdin.setRawMode(false);
          stdin.removeListener("data", onData);
          process.stdout.write("\n");
          rl.close();
          resolve(password);
          return;
        }
        if (char === "\u0003") {
          process.exit(1);
        }
        if (char === "\b" || char === "\x7f") {
          if (password.length > 0) password = password.slice(0, -1);
        } else {
          password += char;
        }
      }
    };
    stdin.on("data", onData);
  });
}

function decryptKeystore(ks, password) {
  const { crypto: c } = ks;
  let derivedKey;
  if (c.kdf === "scrypt") {
    const { dklen, n, r, p, salt } = c.kdfparams;
    derivedKey = crypto.scryptSync(password, Buffer.from(salt, "hex"), dklen, {
      N: n,
      r,
      p,
      maxmem: 64 * 1024 * 1024,
    });
  } else if (c.kdf === "pbkdf2") {
    const { c: iterations, dklen, prf, salt } = c.kdfparams;
    derivedKey = crypto.pbkdf2Sync(
      password,
      Buffer.from(salt, "hex"),
      iterations,
      dklen,
      prf === "hmac-sha256" ? "sha256" : prf,
    );
  } else {
    throw new Error(`Unsupported KDF: ${c.kdf}`);
  }

  const ciphertextBuf = Buffer.from(c.ciphertext, "hex");
  const macBuf = Buffer.concat([derivedKey.subarray(16, 32), ciphertextBuf]);
  const calculatedMac = keccak256(macBuf).replace(/^0x/, "");
  if (calculatedMac.toLowerCase() !== c.mac.toLowerCase()) {
    throw new Error("Incorrect keystore password.");
  }

  const cipherKey = derivedKey.subarray(0, 16);
  const iv = Buffer.from(c.cipherparams.iv, "hex");
  const decipher = crypto.createDecipheriv("aes-128-ctr", cipherKey, iv);
  const privKey = Buffer.concat([decipher.update(ciphertextBuf), decipher.final()]);
  return `0x${privKey.toString("hex")}`;
}

let buyerPrivateKey = process.env.ARCGRADE_BUYER_PRIVATE_KEY;

if (!buyerPrivateKey) {
  const accountName = process.env.ARCGRADE_BUYER_ACCOUNT || "defaultkey";
  const keystorePath = path.join(os.homedir(), ".foundry", "keystores", accountName);
  if (existsSync(keystorePath)) {
    try {
      const ks = JSON.parse(readFileSync(keystorePath, "utf8"));
      const pass = await promptKeystorePassword(accountName);
      buyerPrivateKey = decryptKeystore(ks, pass);
    } catch (err) {
      console.error(`Keystore error: ${err.message}`);
      process.exit(1);
    }
  }
}

if (!buyerPrivateKey || !PAY_TO) {
  console.error(
    [
      "Missing configuration. To settle a real payment you need:",
      "  ARCGRADE_PAY_TO             the seller address to be paid (configured in .env.local)",
      "  Foundry Keystore            ~/.foundry/keystores/defaultkey (or set ARCGRADE_BUYER_ACCOUNT)",
      "                              (Private keys are decrypted in-memory and NEVER stored in .env)",
      "",
      `Network: ${NETWORK} (${NET.label}, ${NET.caip})`,
      "",
      `Fund the buyer first: ${NET.fundHint}`,
    ].join("\n"),
  );
  process.exit(2);
}

const account = privateKeyToAccount(buyerPrivateKey);
/**
 * A single flaky TLS connect should not abort a settlement test. Undici's
 * default connect timeout is 10s, which is tight on some networks, so retry
 * with backoff and report the real cause instead of a bare "fetch failed".
 */
async function rpc(method, params = [], attempts = 4) {
  let lastErr;
  for (let i = 1; i <= attempts; i++) {
    try {
      const res = await fetch(ARC_RPC, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
        signal: AbortSignal.timeout(30_000),
      });
      const json = await res.json();
      if (json.error) throw new Error(`${method}: ${json.error.message}`);
      return json.result;
    } catch (err) {
      lastErr = err;
      const code = err?.cause?.code ?? err?.code ?? err?.name ?? "unknown";
      if (i < attempts) {
        console.log(`   rpc ${method} attempt ${i}/${attempts} failed (${code}), retrying…`);
        await new Promise((r) => setTimeout(r, 1500 * i));
      } else {
        console.error(
          `\nRPC unreachable after ${attempts} attempts: ${ARC_RPC}\n` +
            `  cause: ${code} ${err?.cause?.message ?? err?.message}\n` +
            `  If this persists, try a different Arc testnet RPC or a wired connection.`,
        );
      }
    }
  }
  throw lastErr;
}

console.log(`buyer  ${account.address}`);
console.log(`seller ${PAY_TO}`);

// Circle's facilitator rejects a payment whose payer equals its payTo with
// `self_transfer`, because moving funds to yourself proves nothing about the
// payment path and would let anyone trivially unlock paid content for free
// with a wallet that never spends anything. Fail fast with an explanation
// rather than letting the buyer pay, sign, and only then read "self_transfer".
if (PAY_TO.toLowerCase() === account.address.toLowerCase()) {
  console.error(
    `\nBuyer and seller are the SAME wallet (${account.address}).\n` +
      `Circle refuses self-payments with reason "self_transfer".\n\n` +
      `Point ARCGRADE_PAY_TO at a different address -- a second account you\n` +
      `control, or a throwaway address for a one-off test. The seller does NOT\n` +
      `need funds: it only receives, and USDC arrives without needing gas.\n\n` +
      `  setx ARCGRADE_PAY_TO 0x<some other address>\n`,
  );
  process.exit(4);
}

// USDC is the native gas token on Arc, so the buyer needs no other asset.
const balanceHex = await rpc("eth_getBalance", [account.address, "latest"]);
const balance = BigInt(balanceHex ?? "0x0");

console.log(`buyer native USDC balance: ${balance} wei\n`);

if (balance === 0n) {
  console.error(`Buyer has no ${NET.label} USDC. ${NET.fundHint}.`);
  process.exit(3);
}

if (!existsSync(".next/BUILD_ID")) {
  await new Promise((resolve, reject) => {
    const b = spawn(process.execPath, ["node_modules/next/dist/bin/next", "build"], {
      stdio: "ignore",
    });
    b.on("exit", (c) => (c === 0 ? resolve() : reject(new Error(`build failed ${c}`))));
  });
}

const app = spawn(
  process.execPath,
  ["node_modules/next/dist/bin/next", "start", "-p", String(PORT)],
  {
    env: {
      ...process.env,
      FIDEX_SECRET: process.env.FIDEX_SECRET ?? process.env.ARCGRADE_SECRET ?? "live-settlement-test-secret",
      FIDEX_X402_MODE: "gateway",
      // Passed through rather than forced to testnet. Circle runs a separate
      // Gateway host per network and each serves only its own chains, so this
      // is what selects gateway-api.circle.com vs gateway-api-testnet.circle.com.
      FIDEX_NETWORK: NETWORK,
      FIDEX_PUBLIC_URL: URL,
      ARCGRADE_SECRET: process.env.FIDEX_SECRET ?? process.env.ARCGRADE_SECRET ?? "live-settlement-test-secret",
      ARCGRADE_X402_MODE: "gateway",
      ARCGRADE_NETWORK: NETWORK,
      ARCGRADE_PUBLIC_URL: URL,
      NODE_ENV: "production",
    },
    stdio: "ignore",
  },
);

for (let i = 0; i < 90; i++) {
  try {
    await fetch(`${URL}/api/v1/grade/${SLUG}/summary`);
    break;
  } catch {
    await new Promise((r) => setTimeout(r, 1000));
  }
}

try {
  // 1. Unauthenticated request must return 402 with a Gateway challenge.
  const unpaid = await fetch(`${URL}/api/v1/grade/${SLUG}`);
  const unpaidBody = await unpaid.json();
  console.log(`1. unpaid grade            -> ${unpaid.status}`);
  if (unpaid.status !== 402) throw new Error(`expected 402, got ${unpaid.status}`);

  const accept = unpaidBody.accepts?.[0];
  console.log(`   network                 ${accept?.network}`);
  console.log(`   amount                  ${accept?.amount}`);
  console.log(`   network                 ${accept?.network}`);

  // Assert the challenge advertises the chain we asked for, and that the
  // verifyingContract matches the Gateway wallet for THAT network. The wallets
  // differ per chain, so a challenge that kept the testnet wallet while
  // advertising mainnet would verify as a signature no facilitator accepts.
  if (accept?.network !== NET.caip) {
    throw new Error(`expected ${NET.label} (${NET.caip}), got ${accept?.network}`);
  }
  console.log(`   network                 ${NET.caip} as expected`);
  console.log(`   payTo                   ${accept?.payTo}`);
  console.log(`   extra.name              ${accept?.extra?.name}`);

  if (accept?.extra?.name !== "GatewayWalletBatched") {
    throw new Error("challenge is not advertising GatewayWalletBatched");
  }
  // 0x7777... is the mainnet Gateway wallet; 0x0077... the testnet one.
  const expectedWallet = NETWORK === "mainnet"
    ? "0x77777777Dcc4d5A8B6E418Fd04D8997ef11000eE"
    : "0x0077777d7EBA4688BDeF3E311b846F25870A19B9";
  const gotWallet = accept?.extra?.verifyingContract;
  if (typeof gotWallet === "string" && gotWallet.toLowerCase() !== expectedWallet.toLowerCase()) {
    throw new Error(
      `challenge advertises the ${NETWORK === "mainnet" ? "testnet" : "mainnet"} Gateway wallet ` +
        `${gotWallet}, expected ${expectedWallet} for ${NET.label}`,
    );
  }

  const prHeader = unpaid.headers.get("payment-required");
  console.log(`   PAYMENT-REQUIRED header ${prHeader ? "present" : "MISSING"}`);
  if (!prHeader) throw new Error("PAYMENT-REQUIRED header missing");

  // 2. Pay it. BatchEvmScheme signs a real EIP-3009 authorisation with the
  //    buyer's key against the Gateway settlement wallet, which is exactly
  //    what a buyer wallet would send.
  const { BatchEvmScheme } = await import("@circle-fin/x402-batching/client");

  // `account` was derived at startup from the decrypted keystore key.
  //
  // BatchEvmScheme takes a BatchEvmSigner: a flat object with `address` and
  // `signTypedData({domain, types, primaryType, message})`. A viem
  // WalletClient does NOT satisfy that shape -- it has no top-level
  // `address` (it lives at `.account.address`) and its signTypedData takes
  // different arguments -- so passing one throws
  // `InvalidAddressError: Address "undefined" is invalid`.
  //
  // viem's LocalAccount is exactly the right shape, so use it directly.
  const batch = new BatchEvmScheme(account);

  // createPaymentPayload returns { x402Version, payload: { authorization, signature } }.
  // Spread the WHOLE result. Destructuring `payload` and then spreading it
  // hoists authorization/signature to the top level, and the server then
  // reports `missing_payment_payload` because it looks for payload.payload.
  const signed = await batch.createPaymentPayload(2, accept);
  // Circle's facilitator requires paymentPayload.resource AND
  // paymentPayload.accepted. The SDK's createPaymentPayload returns neither,
  // so echo the challenge's own resource plus the requirements we signed
  // against, otherwise the facilitator 400s with "Required".
  const header = Buffer.from(
    JSON.stringify({
      ...signed,
      resource: unpaidBody.resource,
      accepted: accept,
    }),
  ).toString("base64");

  // Cheap guard: catch a shape regression here rather than as a server 402.
  const roundTrip = JSON.parse(Buffer.from(header, "base64").toString("utf8"));
  if (!roundTrip?.payload?.authorization || !roundTrip?.payload?.signature) {
    throw new Error(
      `Payment header has the wrong shape. Top-level keys: ${Object.keys(roundTrip).join(", ")}. ` +
        `Expected x402Version, payload.authorization, payload.signature.`,
    );
  }
  console.log(`   header shape OK (x402Version, payload.authorization, payload.signature)`);

  console.log(`   buyer signed authorisation (${header.length} b64 chars)`);

  /**
   * Balances BEFORE the unlock, so the payment can be proven rather than assumed.
   *
   * A 200 proves the server issued a receipt. It does not prove USDC moved, and
   * in the batched Gateway scheme the seller is credited inside the Gateway
   * contract's internal ledger, so no ERC-20 Transfer is emitted to the seller
   * at all. Reading only on-chain transfers therefore shows the buyer paying the
   * Gateway escrow wallet and the seller apparently receiving nothing -- which
   * reads as a failure when it is the expected shape.
   *
   * availableBalance(asset, account) lives on the Gateway wallet proxy, so both
   * arguments are required; passing one is an encode error, not a zero.
   */
  const GATEWAY_WALLET = NETWORK === "mainnet"
    ? "0x77777777Dcc4d5A8B6E418Fd04D8997ef11000eE"
    : "0x0077777d7EBA4688BDeF3E311b846F25870A19B9";
  const ARC_USDC = "0x3600000000000000000000000000000000000000";

  const gatewayBalance = async (account) => {
    // availableBalance(address asset, address account) -- asset first. Encoding
    // these the other way round returns a valid-looking call that reads the
    // wrong slot, so the order is verified against `cast calldata` rather than
    // trusted.
    const res = await rpc("eth_call", [{
      to: GATEWAY_WALLET,
      data: "0x3ccb64ae" + ARC_USDC.slice(2).padStart(64, "0") + account.slice(2).padStart(64, "0"),
    }, "latest"]);
    return res && res !== "0x" ? BigInt(res) : 0n;
  };

  const sellerBefore = await gatewayBalance(PAY_TO);
  const buyerBefore = await gatewayBalance(account.address);

  // 3. Redeem it.
  const paid = await fetch(`${URL}/api/v1/unlock`, {
    method: "POST",
    headers: { "content-type": "application/json", "payment-signature": header },
    body: JSON.stringify({ slug: SLUG }),
  });
  const paidBody = await paid.json();
  console.log(`\n3. unlock with payment   -> ${paid.status}`);
  console.log(`   mode                  ${paidBody.mode}`);
  console.log(`   paid (atomic USDC)    ${paidBody.paid}`);
  console.log(`   settleTx              ${paidBody.settleTx || "(batched: settles later)"}`);
  console.log(`   payer                 ${paidBody.payer}`);

  const settleHeader = paid.headers.get("payment-response");
  if (settleHeader) {
    console.log(
      `   PAYMENT-RESPONSE      ${Buffer.from(settleHeader, "base64").toString("utf8").slice(0, 100)}`,
    );
  }

  if (paid.status !== 200) {
    throw new Error(`settlement failed: ${JSON.stringify(paidBody)}`);
  }

  // 4. The unlocked resource must now be readable.
  const cookie = (paid.headers.get("set-cookie") ?? "").split(";")[0];
  const unlocked = await fetch(`${URL}/api/v1/grade/${SLUG}`, {
    headers: { cookie },
  });
  const unlockedBody = await unlocked.json();
  console.log(`\n4. grade with receipt    -> ${unlocked.status}`);
  console.log(`   axes returned         ${unlockedBody.axes?.length ?? 0}`);

  if (unlocked.status !== 200) {
    throw new Error("receipt did not unlock the resource");
  }

  /**
   * 5. Prove the money moved.
   *
   * Everything above is the server's own word for it. This reads the Gateway
   * ledger, which is the only place a batched settlement is visible: the
   * facilitator pulls from the buyer into the Gateway wallet and credits the
   * seller internally, so an ERC-20 Transfer to the seller never happens and
   * the buyer may deposit more than one payment's worth.
   */
  const sellerAfter = await gatewayBalance(PAY_TO);
  const buyerAfter = await gatewayBalance(account.address);
  const expected = BigInt(paidBody.paid ?? "0");

  console.log(`\n5. Gateway ledger       ${GATEWAY_WALLET}`);
  console.log(`   seller  ${PAY_TO}`);
  console.log(`     before              ${sellerBefore}`);
  console.log(`     after               ${sellerAfter}`);
  console.log(`   buyer   ${account.address}`);
  console.log(`     before              ${buyerBefore}`);
  console.log(`     after               ${buyerAfter}`);

  const credited = sellerAfter - sellerBefore;
  const debited = buyerBefore - buyerAfter;

  if (credited < expected) {
    throw new Error(
      `seller was credited ${credited}, expected at least ${expected}. ` +
        `A 200 was returned but the Gateway ledger shows no matching credit, ` +
        `so the receipt would not survive a real withdrawal.`,
    );
  }
  if (buyerBefore > 0n && debited !== credited) {
    console.log(
      `   note: buyer debited ${debited} but seller was credited ${credited} -- ` +
        `a deposit larger than the purchase, which is expected when the buyer ` +
        `pre-funds its Gateway balance.`,
    );
  }
  console.log(`\n   seller credited ${credited} atomic USDC (expected >= ${expected})`);

  console.log("\nLIVE SETTLEMENT OK");
} finally {
  app.kill();
}
