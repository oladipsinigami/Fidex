#!/usr/bin/env node
/**
 * Deploy FidexRegistry to Circle Arc.
 *
 * The registry holds no funds -- it is a record log -- and is not upgradeable,
 * so a bad deployment is not a loss: deploy a corrected contract at a new
 * address and point NEXT_PUBLIC_FIDEX_REGISTRY_ADDRESS at it. That is why this
 * script defaults to a DRY RUN and requires an explicit flag to broadcast.
 *
 *   node scripts/deploy-registry.mjs testnet --broadcast
 *   node scripts/deploy-registry.mjs mainnet --broadcast
 *
 * Credentials come from .env.deploy.local, which is gitignored. The keystore
 * password is read from there and passed through the environment, never as a
 * command-line argument, so it does not appear in process listings.
 */
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const SECRETS = path.join(ROOT, ".env.deploy.local");

if (!existsSync(SECRETS)) {
  console.error("\nNo .env.deploy.local. Run: cp .env.deploy.example .env.deploy.local\n");
  process.exit(1);
}

const S = {};
for (const line of readFileSync(SECRETS, "utf8").split(/\r?\n/)) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
  if (m && !m[1].startsWith("#")) S[m[1]] = m[2].replace(/^["']|["']$/g, "");
}

const net = (process.argv[2] || "testnet").toLowerCase();
const broadcast = process.argv.includes("--broadcast");
const NETWORKS = {
  testnet: { rpc: "https://rpc.testnet.arc.io", chainId: 5042002 },
  mainnet: { rpc: "https://rpc.mainnet.arc.io", chainId: 5042 },
};
if (!NETWORKS[net]) {
  console.error(`Unknown network "${net}". Use testnet or mainnet.`);
  process.exit(1);
}
const { rpc, chainId } = NETWORKS[net];

const KEYSTORE = S.FOUNDRY_KEYSTORE || "defaultkey";
const PASSWORD = S.FOUNDRY_PASSWORD || "";
const PRIVATE_KEY = S.DEPLOYER_PRIVATE_KEY || "";

console.log(`\n=== Deploying FidexRegistry to Arc ${net} (chain ${chainId}) ===\n`);
console.log(`  mode       : ${broadcast ? "BROADCAST -- this is irreversible" : "DRY RUN (simulation only)"}`);
console.log(`  signer     : ${PRIVATE_KEY ? "DEPLOYER_PRIVATE_KEY env var" : `keystore "${KEYSTORE}"`}`);
console.log(`  password   : ${PASSWORD ? "present (" + PASSWORD.length + " chars)" : PASSWORD === "" ? "NOT SET" : "set"}`);
console.log(`  rpc        : ${rpc}`);

if (broadcast) {
  if (!PASSWORD && !PRIVATE_KEY) {
    console.error(
      "\n  Refusing to broadcast with no credentials.\n" +
        "  Set FOUNDRY_PASSWORD in .env.deploy.local (for the keystore) or\n" +
        "  DEPLOYER_PRIVATE_KEY. Do not paste either into a terminal or chat.\n",
    );
    process.exit(1);
  }
  console.log(
    "\n  NOTE: the registry is non-upgradeable but fundless, so a bad deployment is\n" +
      "  recoverable by deploying again at a new address. It is still worth getting\n" +
      "  right the first time.",
  );
}

const args = [
  "script",
  "contracts/script/DeployFidex.s.sol:DeployFidex",
  "--rpc-url", rpc,
  "--broadcast",
];

if (PRIVATE_KEY) {
  process.env.DEPLOYER_PRIVATE_KEY = PRIVATE_KEY;
} else {
  args.push("--account", KEYSTORE);
}
if (PASSWORD) process.env.FOUNDRY_PASSWORD = PASSWORD;

if (!broadcast) {
  // forge script simulates unless --broadcast; drop it for a dry run.
  const i = args.indexOf("--broadcast");
  if (i >= 0) args.splice(i, 1);
  console.log("");
} else {
  console.log("");
}

const r = spawnSync("forge", args, {
  cwd: ROOT,
  env: { ...process.env },
  encoding: "utf8",
  shell: process.platform === "win32",
});
const out = (r.stdout || "") + (r.stderr || "");

console.log(out.slice(-4000));

if (r.status !== 0) {
  console.error(`\n  forge exited ${r.status}\n`);
  process.exit(1);
}

const addr = (out.match(/FidexRegistry deployed at:\s*(0x[0-9a-fA-F]{40})/) || [])[1];
if (addr) {
  console.log(`\n  address : ${addr}`);
  if (broadcast) {
    const next = `\nNEXT_PUBLIC_FIDEX_REGISTRY_ADDRESS=${addr}\nNEXT_PUBLIC_FIDEX_NETWORK=${net}\n`;
    const cur = readFileSync(SECRETS, "utf8");
    const updated = cur
      .replace(/^NEXT_PUBLIC_FIDEX_REGISTRY_ADDRESS=.*$/m, "")
      .replace(/^NEXT_PUBLIC_FIDEX_NETWORK=.*$/m, "");
    writeFileSync(SECRETS, updated.trimEnd() + "\n" + next);
    console.log(`  written to .env.deploy.local as NEXT_PUBLIC_FIDEX_REGISTRY_ADDRESS`);
    console.log(`\n  Next: npm run deploy   (pushes it to Vercel)`);
  }
} else if (broadcast) {
  console.log("\n  Could not parse the deployed address from forge output -- check above.");
  console.log("  Set NEXT_PUBLIC_FIDEX_REGISTRY_ADDRESS manually before deploying the app.");
}
console.log("");
