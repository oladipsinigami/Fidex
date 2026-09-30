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
    if (process.stdin.isTTY) {
      console.log("\n  No FOUNDRY_PASSWORD set -- forge will prompt you for it.");
    } else {
      console.error(
        "\n  Refusing to broadcast with no credentials and no terminal to prompt on.\n" +
          "  Run this from an interactive terminal so forge can ask for the keystore\n" +
          "  password, or set FOUNDRY_PASSWORD in .env.deploy.local.\n" +
          "  Do not paste the password into a terminal command or a chat.\n",
      );
      process.exit(1);
    }
  }
  console.log(
    "\n  NOTE: the registry is non-upgradeable but fundless, so a bad deployment is\n" +
      "  recoverable by deploying again at a new address. It is still worth getting\n" +
      "  right the first time.",
  );
}

const env = { ...process.env };
let owner = process.env.REGISTRY_OWNER || S.REGISTRY_OWNER || "";

if (!owner && PRIVATE_KEY) {
  // Derive from the key we are about to broadcast with.
  const { privateKeyToAccount } = await import("viem/accounts");
  owner = privateKeyToAccount(
    PRIVATE_KEY.startsWith("0x") ? PRIVATE_KEY : `0x${PRIVATE_KEY}`,
  ).address;
}

/**
 * Note: a V3 Foundry keystore holds only {crypto, id, version} -- there is no
 * `address` field to read, so the signer cannot be derived from the file
 * without decrypting it. REGISTRY_OWNER is a public address, not a secret, so
 * it belongs in .env.deploy.local.
 */
if (!owner) {
  console.error(
    "\n  REGISTRY_OWNER is required.\n" +
      "  Add it to .env.deploy.local -- it is a public address, not a password:\n" +
      "    REGISTRY_OWNER=0x...\n" +
      "  The registry is non-upgradeable, so deploying one nobody can approve\n" +
      "  analysts on would need a fresh deploy.\n",
  );
  process.exit(1);
}

env.REGISTRY_OWNER = owner;
if (S.INITIAL_ANALYSTS) env.INITIAL_ANALYSTS = S.INITIAL_ANALYSTS;

console.log(`  owner      : ${owner}`);

const args = [
  "script",
  // Relative to contracts/, because foundry.toml (and therefore the remappings
  // that resolve @openzeppelin and forge-std) lives there. Running forge from
  // the repo root finds no foundry.toml, so every import fails to resolve.
  "script/DeployFidex.s.sol:DeployFidex",
  "--rpc-url", rpc,
];

if (!broadcast) {
  /**
   * Dry run: no signer at all.
   *
   * Passing `--account` makes forge prompt for the keystore password even when
   * it is only simulating, so a dry run would need the password to tell you
   * nothing you cannot learn without it. Simulation uses a default sender, and
   * the resulting address is *not* the address a broadcast would produce -- it
   * depends on the real signer and its nonce. Only read the address as
   * meaningful when the log says BROADCAST.
   */
  console.log("\n  (no signer: simulation uses a default sender, so the address below is not real)");
} else {
  args.push("--broadcast");
  if (PRIVATE_KEY) {
    env.DEPLOYER_PRIVATE_KEY = PRIVATE_KEY;
  } else {
    args.push("--account", KEYSTORE);
  }
}
if (PASSWORD) env.FOUNDRY_PASSWORD = PASSWORD;

const r = spawnSync("forge", args, {
  cwd: path.join(ROOT, "contracts"),
  env,
  encoding: "utf8",
  shell: process.platform === "win32",
  // stdin inherited so forge can prompt for the keystore password; stdout and
  // stderr piped so the deployed address can be parsed out. Piping all three
  // would leave forge unable to prompt and hang instead of failing.
  stdio: ["inherit", "pipe", "pipe"],
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
