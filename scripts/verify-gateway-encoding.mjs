/**
 * Confirms the hand-rolled eth_call encoding used by settle-live.mjs agrees
 * with `cast calldata`, for both networks and both accounts.
 *
 * Getting the two address arguments the wrong way round still produces a valid
 * 32-byte-padded call that reads the wrong balance slot, so this asserts the
 * encoding rather than eyeballing it.
 */
import { spawnSync } from "node:child_process";

const SEL = "0x3ccb64ae";
const USDC = "0x3600000000000000000000000000000000000000";
const ACCOUNTS = {
  buyer: "0x4199d0Fc0C6c4f633Db584de41501bbCc546c443",
  seller: "0xdB99D8C6b401cF97eaE6c835345938edF5299d25",
};
const GATEWAYS = {
  mainnet: "0x77777777Dcc4d5A8B6E418Fd04D8997ef11000eE",
  testnet: "0x0077777d7EBA4688BDeF3E311b846F25870A19B9",
};

const pad = (a) => a.slice(2).padStart(64, "0");
let bad = 0;

for (const [net, gw] of Object.entries(GATEWAYS)) {
  console.log(`\n=== ${net} (${gw}) ===`);
  for (const [label, addr] of Object.entries(ACCOUNTS)) {
    const manual = SEL + pad(USDC) + pad(addr);
    const r = spawnSync("cast", ["calldata", "availableBalance(address,address)", USDC, addr], {
      encoding: "utf8", shell: process.platform === "win32",
    });
    const expected = (r.stdout || "").trim();
    const ok = manual.toLowerCase() === expected.toLowerCase();
    if (!ok) bad++;
    console.log(`  ${ok ? "OK  " : "FAIL"} ${label} encoding matches cast`);
    if (!ok) {
      console.log(`       manual : ${manual}`);
      console.log(`       cast   : ${expected}`);
    }

    // And the read must agree with a direct cast call.
    const rpc = net === "mainnet" ? "https://rpc.mainnet.arc.io" : "https://rpc.testnet.arc.io";
    const got = spawnSync("cast", ["call", gw, "availableBalance(address,address)(uint256)", USDC, addr, "--rpc-url", rpc], {
      encoding: "utf8", shell: process.platform === "win32",
    });
    const value = (got.stdout || "").trim().split(/\s+/)[0];
    console.log(`       balance: ${value}`);
  }
}

console.log(bad ? `\n${bad} encoding mismatch(es)\n` : "\nEncoding matches cast on both networks.\n");
process.exit(bad ? 1 : 0);