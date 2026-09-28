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

const ATTESTATION_DOMAIN = {
  name: "ArcGrade Studio",
  version: "1",
  chainId: 5042002,
  verifyingContract: "0x3600000000000000000000000000000000000000",
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
        ARCGRADE_SECRET: process.env.ARCGRADE_SECRET ?? "attestation-test-only-not-a-real-key",
        ARCGRADE_PUBLIC_URL: BASE_URL,
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

try {
  console.log("=== Running ArcGrade EIP-712 Cryptographic Attestation Tests ===\n");

  // Ephemeral test analyst account
  const privateKey = "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80";
  const analyst = privateKeyToAccount(privateKey);
  console.log(`Test Analyst Address: ${analyst.address}`);

  const timestamp = Date.now();
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

  console.log(`Generated EIP-712 Signature: ${signature.slice(0, 20)}...`);

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
  console.log("Response:", json);

  assert.strictEqual(res.status, 200, `Expected 200, got ${res.status}`);
  assert.strictEqual(json.ok, true);
  assert(json.attestationId.startsWith("attest_"));
  assert.strictEqual(json.analyst, analyst.address);

  // Verify query endpoint
  const queryRes = await fetch(`${BASE_URL}/api/v1/attest?slug=aave-v4-arc`);
  const queryJson = await queryRes.json();
  assert(queryJson.attestations.length > 0);
  assert.strictEqual(queryJson.attestations[0].analystAddress, analyst.address.toLowerCase());

  console.log("\nPASS: EIP-712 Analyst Cryptographic Attestation successfully signed, verified, and persisted to SQLite!");
} finally {
  if (appProcess) {
    appProcess.kill();
  }
}
