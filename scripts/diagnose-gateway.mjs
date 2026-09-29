/**
 * Isolates the Gateway settlement path from wallet/funding concerns.
 *
 * Uses a throwaway key with no funds. It will not succeed in paying, but it
 * proves the whole chain is wired correctly: challenge -> sign with the real
 * SDK -> server validates -> facilitator is reached and returns a real answer.
 * Anything after that is about the account, not the code.
 *
 *   node scripts/diagnose-gateway.mjs
 */
import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { privateKeyToAccount } from "viem/accounts";
import { BatchEvmScheme } from "@circle-fin/x402-batching/client";
import { BatchFacilitatorClient } from "@circle-fin/x402-batching/server";

const PORT = 4595;
const URL = `http://127.0.0.1:${PORT}`;
const SLUG = "aave-v4-arc";
// Throwaway key, deliberately unfunded. Generates a real signature.
const THROWAWAY = "0x" + "3c".repeat(32);
const SELLER = "0x3333333333333333333333333333333333333333";

const account = privateKeyToAccount(THROWAWAY);
console.log(`throwaway buyer ${account.address} (unfunded, on purpose)`);
console.log(`seller           ${SELLER}\n`);

if (!existsSync(".next/BUILD_ID")) {
  await new Promise((res, rej) => {
    const b = spawn(process.execPath, ["node_modules/next/dist/bin/next", "build"], {
      stdio: "ignore",
    });
    b.on("exit", (c) => (c === 0 ? res() : rej(new Error(`build failed ${c}`))));
  });
}

const app = spawn(
  process.execPath,
  ["node_modules/next/dist/bin/next", "start", "-p", String(PORT)],
  {
    env: {
      ...process.env,
      FIDEX_SECRET: "diagnose-only",
      FIDEX_PAY_TO: SELLER,
      FIDEX_X402_MODE: "gateway",
      FIDEX_NETWORK: "testnet",
      FIDEX_PUBLIC_URL: URL,
      ARCGRADE_SECRET: "diagnose-only",
      ARCGRADE_PAY_TO: SELLER,
      ARCGRADE_X402_MODE: "gateway",
      ARCGRADE_NETWORK: "testnet",
      ARCGRADE_PUBLIC_URL: URL,
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
  // 1. Challenge
  const unpaid = await fetch(`${URL}/api/v1/grade/${SLUG}`);
  const body = await unpaid.json();
  const accept = body.accepts?.[0];
  console.log(`1. challenge: ${unpaid.status} ${accept?.network} amount=${accept?.amount}`);
  console.log(`   payTo   ${accept?.payTo}  ${accept?.payTo === SELLER ? "(ours)" : "(MISMATCH!)"}`);

  // 2. Sign exactly the way a real buyer does.
  const signed = await new BatchEvmScheme(account).createPaymentPayload(2, accept);
  const header = Buffer.from(
    JSON.stringify({ ...signed, resource: body.resource, accepted: accept }),
  ).toString("base64");
  const rt = JSON.parse(Buffer.from(header, "base64").toString("utf8"));
  console.log(`2. signed. top-level keys: ${Object.keys(rt).join(", ")}`);
  console.log(`   auth.to    ${rt.payload.authorization.to}`);
  console.log(`   auth.value ${rt.payload.authorization.value}`);
  console.log(`   signature  ${rt.payload.signature.length} chars`);

  // 3. Ask Circle's TESTNET gateway directly. The server points at the same
  //    host (see GATEWAY_URL in lib/x402.ts). A valid signature here proves
  //    the whole plumbing works and only a funded buyer remains.
  const GATEWAY = "https://gateway-api-testnet.circle.com";
  const f = new BatchFacilitatorClient({ url: GATEWAY });
  const result = await f.verify({ ...signed, resource: body.resource, accepted: accept }, accept);

  console.log(`\n3. Circle testnet Gateway (${GATEWAY.replace("https://", "")})`);
  console.log(`   isValid: ${result.isValid}`);
  if (result.invalidReason) console.log(`   reason:  ${result.invalidReason}`);

  console.log("");
  if (result.isValid === true) {
    console.log("VERDICT: Circle ACCEPTED the signature on Arc testnet.");
    console.log("         Full plumbing works. Only a FUNDED buyer is needed to settle,");
    console.log("         because this throwaway key holds no testnet USDC.");
  } else {
    console.log(`VERDICT: Circle rejected it (${result.invalidReason}).`);
    process.exitCode = 1;
  }
} finally {
  app.kill();
}
