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

try {
  console.log("=== Running Fidex EIP-712 Cryptographic Attestation Tests ===\n");

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
    assert.strictEqual(
      res2.status,
      503,
      `expected 503 registry_not_configured, got ${res2.status}`,
    );
    assert.strictEqual(json2.error, "registry_not_configured");
    assert(!json2.attestationId, "no attestation may be recorded without a registry");
    console.log(`PASS: refused with 503 registry_not_configured (status=${res2.status})`);
  } finally {
    unconfigured.kill();
  }
} finally {
  if (appProcess) {
    appProcess.kill();
  }
}
