/**
 * End-to-end test of the on-chain settlement path (Path 2) in
 * POST /api/v1/unlock, against a mock Arc RPC.
 *
 * Why this exists: `verify:payments` never reaches the ERC-20 branch of
 * lib/onchainVerify.ts. Its only on-chain test posts an all-zero hash, which
 * fails the format/receipt check first. So the calldata offsets in that
 * function have no coverage at all, and the native-transfer branch has none
 * either.
 *
 * Serves well-formed transactions through a mock RPC and asserts the server
 * accepts a legitimate payment and rejects the wrong ones.
 */
import { spawn } from "node:child_process";
import { createServer } from "node:http";
import path from "node:path";
import os from "node:os";
import { rmSync } from "node:fs";

const PAY_TO = "0x1111111111111111111111111111111111111111";
const FROM = "0x2222222222222222222222222222222222222222";
const USDC = "0x3600000000000000000000000000000000000000";
// Unique per run: the receipt store rejects a hash it has already seen, so
// fixed hashes would fail on the second invocation.
const RUN = Date.now().toString(16).padStart(16, "0");
const hx = (tag) => "0x" + (RUN + tag.repeat(64)).slice(0, 64);
const TX = hx("a");

const pad = (a) => a.toLowerCase().replace(/^0x/, "").padStart(64, "0");
/** 32-byte ABI word, no 0x prefix (used inside calldata). */
const word = (n) => BigInt(n).toString(16).padStart(64, "0");
/** Real JSON-RPC returns 0x-prefixed quantities. */
const qty = (n) => "0x" + BigInt(n).toString(16);

/** transfer(address,uint256) -> 0x | selector | recipient(64) | amount(64) */
const erc20Transfer = (to, amount) => "0xa9059cbb" + pad(to) + word(amount);

let nextTx = null;
let nextReceipt = { status: "0x1" };

const rpc = createServer((req, res) => {
  let body = "";
  req.on("data", (d) => (body += d));
  req.on("end", () => {
    const { method } = JSON.parse(body);
    res.setHeader("content-type", "application/json");
    if (method === "eth_getTransactionReceipt") {
      res.end(JSON.stringify({ result: nextReceipt }));
    } else {
      res.end(JSON.stringify({ result: nextTx }));
    }
  });
});
const RPC_PORT = 4593;
await new Promise((r) => rpc.listen(RPC_PORT, "127.0.0.1", r));

const APP_PORT = 4592;
const BASE = `http://127.0.0.1:${APP_PORT}`;

const app = spawn(
  process.execPath,
  ["node_modules/next/dist/bin/next", "start", "-p", String(APP_PORT)],
  {
    env: {
      ...process.env,
      FIDEX_SECRET: "erc20-parse-test",
      FIDEX_PAY_TO: PAY_TO,
      FIDEX_PUBLIC_URL: BASE,
      FIDEX_NETWORK: "testnet",
      FIDEX_TESTNET_RPC: `http://127.0.0.1:${RPC_PORT}`,
      FIDEX_DB_PATH: path.join(os.tmpdir(), `fidex-onchain-test-${RUN}.db`),
      FIDEX_X402_MODE: "gateway",
      ARCGRADE_SECRET: "erc20-parse-test",
      ARCGRADE_PAY_TO: PAY_TO,
      ARCGRADE_PUBLIC_URL: BASE,
      ARCGRADE_NETWORK: "testnet",
      ARCGRADE_TESTNET_RPC: `http://127.0.0.1:${RPC_PORT}`,
      ARCGRADE_DB_PATH: path.join(os.tmpdir(), `arcgrade-onchain-test-${RUN}.db`),
      ARCGRADE_X402_MODE: "gateway",
    },
    stdio: ["ignore", "ignore", "inherit"],
  },
);

let up = false;
for (let i = 0; i < 90; i++) {
  if (app.exitCode !== null) break;
  try {
    await fetch(`${BASE}/api/v1/grade/aave-v4-arc/summary`);
    up = true;
    break;
  } catch {
    await new Promise((r) => setTimeout(r, 1000));
  }
}
if (!up) {
  console.error("server never became ready (run `npm run build` first)");
  app.kill();
  rpc.close();
  process.exit(1);
}

let failed = 0;
const check = (name, pass, detail = "") => {
  if (!pass) failed++;
  console.log(`${pass ? "PASS" : "FAIL"}  ${name}${detail ? " :: " + detail : ""}`);
};

async function unlock(body) {
  const res = await fetch(`${BASE}/api/v1/unlock`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
    redirect: "manual",
  });
  let json = null;
  try {
    json = await res.json();
  } catch {}
  return { status: res.status, json, cookie: res.headers.get("set-cookie") };
}

// --- 1. Legitimate ERC-20 transfer of exactly $0.01 -----------------------
nextReceipt = { status: "0x1" };
nextTx = { from: FROM, to: USDC, input: erc20Transfer(PAY_TO, 10_000n), value: "0x0" };
let r = await unlock({ slug: "aave-v4-arc", txHash: TX });
check(
  "legitimate ERC-20 transfer ($0.01) is accepted",
  r.status === 200,
  `status=${r.status} reason=${r.json?.reason}`,
);

// --- 2. ERC-20 transfer to a DIFFERENT address (must be refused) ---------
// Uses a distinct hash so the first receipt's replay guard does not mask it.
const TX2 = hx("b");
nextTx = { from: FROM, to: USDC, input: erc20Transfer("0x" + "9".repeat(40), 10_000n), value: "0x0" };
r = await unlock({ slug: "aave-v4-arc", txHash: TX2 });
check(
  "ERC-20 transfer to a different address is refused",
  r.status === 402,
  `status=${r.status} reason=${r.json?.reason}`,
);

// --- 3. ERC-20 transfer UNDER the price (must be refused) -----------------
const TX3 = hx("c");
nextTx = { from: FROM, to: USDC, input: erc20Transfer(PAY_TO, 9_999n), value: "0x0" };
r = await unlock({ slug: "aave-v4-arc", txHash: TX3 });
check(
  "underpaid ERC-20 transfer is refused",
  r.status === 402,
  `status=${r.status} reason=${r.json?.reason}`,
);

// --- 4. Legitimate NATIVE USDC transfer of $0.01 (18 decimals) ----------
const TX4 = hx("d");
nextTx = { from: FROM, to: PAY_TO, input: "0x", value: qty(10_000_000_000_000_000n) };
r = await unlock({ slug: "aave-v4-arc", txHash: TX4 });
check(
  "legitimate native USDC transfer (1e16 wei) is accepted",
  r.status === 200,
  `status=${r.status} reason=${r.json?.reason}`,
);

// --- 5. Replay of an already-used hash (must be refused) -----------------
r = await unlock({ slug: "aave-v4-arc", txHash: TX });
check(
  "replaying a spent tx hash is refused",
  r.status === 402,
  `status=${r.status} reason=${r.json?.reason}`,
);

console.log(`\n${5 - failed}/5 passed`);
app.kill();
rpc.close();
for (const suffix of ["", "-wal", "-shm"]) {
  try {
    rmSync(path.join(os.tmpdir(), `arcgrade-onchain-test-${RUN}.db${suffix}`), { force: true });
  } catch {}
}
process.exitCode = failed ? 1 : 0;
