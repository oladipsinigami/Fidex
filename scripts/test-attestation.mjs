/**
 * End-to-end test for EIP-712 Analyst Cryptographic Attestation API.
 *
 * Simulates a certified Web3 risk researcher signing an evaluation with their private key,
 * submitting to POST /api/v1/attest, and verifying that the server cryptographically
 * verifies the signature and writes an immutable record to SQLite.
 *
 * Can run against an existing dev/prod server or will automatically spawn a temporary server.
 *
 * Run with: node scripts/test-attestation.mjs
 */

import assert from "node:assert";
import { spawn } from "node:child_process";
import { privateKeyToAccount } from "viem/accounts";

/**
 * Must match the value injected into the spawned server below, or the signature
 * is built for one verifyingContract and checked against another. A well-known
 * burn address keeps the verification path under test without pretending to be
 * a real registry deployment.
 */
const REGISTRY_ADDRESS =
  process.env.NEXT_PUBLIC_FIDEX_REGISTRY_ADDRESS ?? "0x000000000000000000000000000000000000dEaD";

const ATTESTATION_DOMAIN = {
  name: "Fidex Studio",
  version: "1",
  chainId: 5042002,
  verifyingContract: REGISTRY_ADDRESS,
};

const ATTESTATION_TYPES = {
  RatingAttestation: [
    { name: "slug", type: "string" },
    { name: "letter", type: "string" },
    { name: "score", type: "uint256" },
    { name: "analyst", type: "address" },
    { name: "timestamp", type: "uint256" },
  ],
};

const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3001;
const BASE_URL = `http://127.0.0.1:${PORT}`;

let appProcess = null;

// Check if server is running; if not, spin up production next server
let isRunning = false;
try {
  const check = await fetch(`${BASE_URL}/api/v1/grade/aave-v4-arc`);
  if (check.ok || check.status === 402) {
    isRunning = true;
  }
} catch {
  isRunning = false;
}

if (!isRunning) {
  appProcess = spawn(
    process.execPath,
    ["node_modules/next/dist/bin/next", "start", "-p", String(PORT)],
    {
      env: {
        ...process.env,
        // A throwaway key scoped to this test run. This used to fall back to a
        // hardcoded 32-byte value that had also been pasted into the README,
        // i.e. the real receipt-signing key. Never hardcode a secret here: a
        // missing secret must fall through to .env.local or fail loudly.
        FIDEX_SECRET: process.env.FIDEX_SECRET ?? process.env.ARCGRADE_SECRET ?? "attestation-test-only-not-a-real-key",
        ARCGRADE_SECRET: process.env.ARCGRADE_SECRET ?? "attestation-test-only-not-a-real-key",
        FIDEX_PUBLIC_URL: BASE_URL,
        ARCGRADE_PUBLIC_URL: BASE_URL,
        // The attestation domain needs a real verifyingContract. It previously
        // fell back to the zero address, which meant the suite signed AND
        // verified against 0x000...0 and passed without checking any deployed
        // contract. A well-known burn address keeps the signature verification
        // path under test without pretending to be a real registry.
        NEXT_PUBLIC_FIDEX_REGISTRY_ADDRESS: REGISTRY_ADDRESS,
        NEXT_PUBLIC_FIDEX_NETWORK: "testnet",
      },
      stdio: ["ignore", "ignore", "inherit"],
    }
  );

  // Wait for readiness
  let ready = false;
  for (let i = 0; i < 60; i++) {
    if (appProcess.exitCode !== null) {
      console.error(
        `\n[FAIL] \`next start\` exited with code ${appProcess.exitCode} before becoming ready. ` +
          `The error above is the cause.`,
      );
      process.exit(1);
    }
    try {
      await fetch(`${BASE_URL}/api/v1/grade/aave-v4-arc`);
      ready = true;
      break;
    } catch {
      await new Promise((r) => setTimeout(r, 500));
    }
  }
  if (!ready) {
    console.error(
      `\n[FAIL] Server never became ready on ${BASE_URL}. ` +
        `If you have not built yet, run \`npm run build\` first, and check that ` +
        `port ${PORT} is free.`,
    );
    appProcess.kill();
    process.exit(1);
  }
}

let failures = 0;
const check = (name, fn) => {
  try {
    fn();
    console.log(`  PASS  ${name}`);
  } catch (e) {
    failures++;
    console.error(`  FAIL  ${name}\n        ${e.message}`);
  }
};

/**
 * Is the configured registry a real deployed contract?
 *
 * The API now reads `isApprovedAnalyst` on-chain, because a valid signature
 * alone does not make an analyst certified -- the registry decides that. That
 * check needs real bytecode at the configured address. Until FidexRegistry is
 * actually deployed there is nothing to attest against, so the honest
 * expectation is a refusal rather than a 200.
 */
async function registryHasCode(address) {
  try {
    const res = await fetch("https://rpc.testnet.arc.io", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "eth_getCode",
        params: [address, "latest"],
      }),
    });
    const json = await res.json();
    return typeof json?.result === "string" && json.result !== "0x";
  } catch {
    return false;
  }
}

const deployed = await registryHasCode(REGISTRY_ADDRESS);

try {
  console.log("=== Running Fidex EIP-712 Cryptographic Attestation Tests ===\n");
  console.log(`Registry address: ${REGISTRY_ADDRESS}`);
  console.log(`Deployed contract: ${deployed ? "yes" : "NO (no bytecode at that address)"}\n`);

  // Ephemeral test analyst account
  const privateKey = "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80";
  const analyst = privateKeyToAccount(privateKey);
  console.log(`Test Analyst Address: ${analyst.address}`);

  const timestamp = Math.floor(Date.now() / 1000);
  const message = {
    slug: "aave-v4-arc",
    letter: "A",
    score: 85n,
    analyst: analyst.address,
    timestamp: BigInt(timestamp),
  };

  const signature = await analyst.signTypedData({
    domain: ATTESTATION_DOMAIN,
    types: ATTESTATION_TYPES,
    primaryType: "RatingAttestation",
    message,
  });

  console.log(`Generated EIP-712 Signature: ${signature.slice(0, 20)}...\n`);

  const res = await fetch(`${BASE_URL}/api/v1/attest`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      slug: "aave-v4-arc",
      letter: "A",
      score: 85,
      analystAddress: analyst.address,
      signature,
      timestamp,
    }),
  });

  const json = await res.json();
  console.log("Response:", json, "\n");

  if (deployed) {
    check("rejects an analyst who is not on the allowlist", () => {
      // This ephemeral key is definitely not allowlisted, so the only correct
      // outcome is a refusal. A 200 here would mean the API recorded an
      // attestation the registry would refuse.
      assert.strictEqual(
        res.status,
        403,
        `expected 403 analyst_not_approved, got ${res.status}: ${JSON.stringify(json)}`,
      );
      assert.strictEqual(json.error, "analyst_not_approved");
      assert(!json.attestationId, "no attestation may be recorded for an unlisted analyst");
    });

    console.log(
      `\nNOTE: ${analyst.address} is not allowlisted. To exercise the 200 path,\n` +
        `  allowlist it from the owner wallet:\n` +
        `    cast send ${REGISTRY_ADDRESS} "setAnalystApproval(address,bool)" ${analyst.address} true --rpc-url https://rpc.testnet.arc.io --account defaultkey`,
    );
  } else {
    check("refuses when there is no contract to read the allowlist from", () => {
      assert.strictEqual(
        res.status,
        503,
        `expected 503 allowlist_unavailable, got ${res.status}: ${JSON.stringify(json)}`,
      );
      assert.strictEqual(json.error, "allowlist_unavailable");
      assert(!json.attestationId, "no attestation may be recorded without a registry contract");
    });

    console.log(
      "\nNOTE: FidexRegistry is not deployed, so the allowlist cannot be read.\n" +
        "  Deploy it, then re-run:\n" +
        "    node scripts/deploy-registry.mjs testnet --broadcast",
    );
  }

  /**
   * Fail-closed guard: the signing domain must never be allowed to verify
   * against the zero address.
   *
   * With NEXT_PUBLIC_FIDEX_REGISTRY_ADDRESS unset, lib/attestation.ts falls back
   * to 0x000...0. The server used to verify against that same constant, so the
   * endpoint reported a cryptographically verified attestation while having
   * checked no contract at all. It now returns 503 instead.
   *
   * Exercised through a fresh process because the domain is resolved at module
   * load, and NEXT_PUBLIC_* values are inlined at build time.
   */
  console.log("\n--- fail-closed when no registry is configured ---");
  const UNCONFIGURED_PORT = PORT + 1;
  const unconfigured = spawn(
    process.execPath,
    ["node_modules/next/dist/bin/next", "start", "-p", String(UNCONFIGURED_PORT)],
    {
      env: {
        ...process.env,
        FIDEX_SECRET: "attestation-test-only-not-a-real-key",
        ARCGRADE_SECRET: "attestation-test-only-not-a-real-key",
        FIDEX_PUBLIC_URL: `http://127.0.0.1:${UNCONFIGURED_PORT}`,
        ARCGRADE_PUBLIC_URL: `http://127.0.0.1:${UNCONFIGURED_PORT}`,
        // Explicitly the zero address: this is the configuration under test.
        NEXT_PUBLIC_FIDEX_REGISTRY_ADDRESS: "0x0000000000000000000000000000000000000000",
        NEXT_PUBLIC_FIDEX_NETWORK: "testnet",
      },
      stdio: ["ignore", "ignore", "inherit"],
    },
  );

  try {
    let up2 = false;
    for (let i = 0; i < 60; i++) {
      if (unconfigured.exitCode !== null) break;
      try {
        await fetch(`http://127.0.0.1:${UNCONFIGURED_PORT}/api/v1/grade/aave-v4-arc/summary`);
        up2 = true;
        break;
      } catch {
        await new Promise((r) => setTimeout(r, 500));
      }
    }
    assert(up2, "unconfigured server never became ready");

    const res2 = await fetch(`http://127.0.0.1:${UNCONFIGURED_PORT}/api/v1/attest`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        slug: "aave-v4-arc",
        letter: "A",
        score: 85,
        analystAddress: analyst.address,
        signature,
        timestamp,
      }),
    });
    const json2 = await res2.json().catch(() => ({}));
    check("refuses with 503 when the registry address is the zero address", () => {
      assert.strictEqual(
        res2.status,
        503,
        `expected 503 registry_not_configured, got ${res2.status}: ${JSON.stringify(json2)}`,
      );
      assert.strictEqual(json2.error, "registry_not_configured");
      assert(!json2.attestationId, "no attestation may be recorded without a registry");
    });
  } finally {
    unconfigured.kill();
  }
} finally {
  if (appProcess) {
    appProcess.kill();
  }
}

if (failures > 0) {
  console.error(`\n${failures} check(s) failed\n`);
  process.exit(1);
}

console.log("\nAll attestation checks passed.\n");
// next start children keep libuv handles alive on Windows and trip an
// assertion at teardown, so exit explicitly rather than waiting on the loop.
process.exit(0);
