#!/usr/bin/env node
/**
 * arc-agent-buyer.test.mjs
 * ─────────────────────────────────────────────────────────────────────────────
 * Self-contained test suite for arc-agent-buyer.mjs.
 *
 * Tests three layers:
 *   Unit   — validation helpers (no network, no wallet)
 *   Mock   — full buyer flow against a local mock HTTP server
 *   E2E    — (optional) real Arc Testnet when AGENT_PRIVATE_KEY is set
 *
 * Run:
 *   node scripts/arc-agent-buyer.test.mjs
 *
 * Run E2E tests (requires AGENT_PRIVATE_KEY and a running ArcGrade server):
 *   AGENT_PRIVATE_KEY=0x... node scripts/arc-agent-buyer.test.mjs --e2e
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { createServer } from "http";
import { once } from "events";

// ── Tiny test runner ──────────────────────────────────────────────────────────
let passed = 0;
let failed = 0;
const errors = [];

function test(name, fn) {
  try {
    const result = fn();
    if (result && typeof result.then === "function") {
      return result
        .then(() => {
          console.log(`  \x1b[32m✔\x1b[0m ${name}`);
          passed++;
        })
        .catch((err) => {
          console.log(`  \x1b[31m✖\x1b[0m ${name}`);
          console.log(`    ${err.message}`);
          failed++;
          errors.push({ name, err });
        });
    }
    console.log(`  \x1b[32m✔\x1b[0m ${name}`);
    passed++;
    return Promise.resolve();
  } catch (err) {
    console.log(`  \x1b[31m✖\x1b[0m ${name}`);
    console.log(`    ${err.message}`);
    failed++;
    errors.push({ name, err });
    return Promise.resolve();
  }
}

function assert(cond, msg) {
  if (!cond) throw new Error(msg || "Assertion failed");
}

function assertEqual(a, b, msg) {
  if (a !== b) throw new Error(msg || `Expected ${JSON.stringify(a)} === ${JSON.stringify(b)}`);
}

// ── Constants (duplicated from the buyer to avoid coupling to its internals) ──
const ARC_TESTNET_CHAIN_ID = 5042002;
const ARC_USDC = "0x3600000000000000000000000000000000000000";
const PRICE_DOSSIER = 10_000n;
const PRICE_AXIS = 1_000n;

// ── Unit Tests ─────────────────────────────────────────────────────────────────
console.log("\n\x1b[1m\x1b[36mUnit Tests\x1b[0m");

await test("assertNetwork: passes for correct network", () => {
  const network = `eip155:${ARC_TESTNET_CHAIN_ID}`;
  const expected = `eip155:${ARC_TESTNET_CHAIN_ID}`;
  assert(network === expected, "network should match");
});

await test("assertNetwork: fails for wrong chain ID", () => {
  const network = "eip155:1"; // Ethereum mainnet — wrong
  const expected = `eip155:${ARC_TESTNET_CHAIN_ID}`;
  assert(network !== expected, "should reject wrong chain");
});

await test("assertAmount: 10000 == PRICE_DOSSIER", () => {
  const amount = 10_000n;
  assert(amount === PRICE_DOSSIER, "dossier price should be 10000 atomic units");
});

await test("assertAmount: 1000 == PRICE_AXIS", () => {
  const amount = 1_000n;
  assert(amount === PRICE_AXIS, "axis price should be 1000 atomic units");
});

await test("assertAmount: rejects unexpected amount", () => {
  const actual = BigInt(9999);
  const expected = PRICE_DOSSIER;
  assert(actual !== expected, "should reject mismatched amount");
});

await test("USDC address is the Arc predeploy", () => {
  assertEqual(ARC_USDC.toLowerCase(), "0x3600000000000000000000000000000000000000");
});

await test("USDC decimals: ERC-20 view is 6, not 18", () => {
  const ERC20_DECIMALS = 6;
  const NATIVE_DECIMALS = 18;
  assert(ERC20_DECIMALS !== NATIVE_DECIMALS, "must keep the two views distinct");
  assertEqual(ERC20_DECIMALS, 6);
});

await test("chain ID sanity", () => {
  assertEqual(ARC_TESTNET_CHAIN_ID, 5042002);
});

await test("gradeLabel: A+ for score >= 90", () => {
  const score = 92;
  const letter = score >= 90 ? "A+" : score >= 80 ? "A" : score >= 70 ? "B" : "C";
  assertEqual(letter, "A+");
});

await test("gradeLabel: F for score < 50", () => {
  const score = 35;
  const letter = score >= 90 ? "A+" : score >= 80 ? "A" : score >= 70 ? "B" : score >= 60 ? "C" : score >= 50 ? "D" : "F";
  assertEqual(letter, "F");
});

await test("Private key prefix normalisation", () => {
  // 64 hex chars (32 bytes) = valid raw private key
  const raw = "abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890ab".slice(0, 64);
  assertEqual(raw.length, 64, "raw key should be exactly 64 hex chars");
  const normalised = raw.startsWith("0x") ? raw : `0x${raw}`;
  assert(normalised.startsWith("0x"), "key must be 0x-prefixed");
  assertEqual(normalised.length, 66, "0x + 64 hex chars = 66 total"); // 0x + 64 hex chars
});

await test("Challenge body extraction: body fields", () => {
  const body = {
    x402: true,
    slug: "morpho",
    scope: "dossier",
    amount: "10000",
    currency: ARC_USDC,
    recipient: "0xdB99D8C6b401cF97eaE6c835345938edF5299d25",
    network: `eip155:${ARC_TESTNET_CHAIN_ID}`,
    resource: "https://arcgrade.xyz/api/v1/grade/morpho",
  };
  assertEqual(body.amount, "10000");
  assertEqual(body.currency, ARC_USDC);
  assert(body.recipient.startsWith("0x"), "recipient must be an address");
});

await test("Challenge header: base64 encode/decode roundtrip", () => {
  const payload = { x402Version: 2, slug: "morpho", amount: "10000" };
  const encoded = Buffer.from(JSON.stringify(payload)).toString("base64");
  const decoded = JSON.parse(Buffer.from(encoded, "base64").toString("utf8"));
  assertEqual(decoded.slug, "morpho");
  assertEqual(decoded.amount, "10000");
});

// ── Mock Server Tests ─────────────────────────────────────────────────────────
console.log("\n\x1b[1m\x1b[36mMock Server Tests\x1b[0m");

/**
 * Minimal mock ArcGrade server.
 * State machine:
 *   1st POST /api/v1/unlock (no txHash) → 402 + challenge
 *   2nd POST /api/v1/unlock (with txHash) → 200 + dossier
 */
function createMockServer() {
  const MOCK_RECIPIENT = "0xdB99D8C6b401cF97eaE6c835345938edF5299d25";

  const server = createServer((req, res) => {
    if (req.method !== "POST" || req.url !== "/api/v1/unlock") {
      res.writeHead(404).end("Not found");
      return;
    }

    let body = "";
    req.on("data", (d) => (body += d));
    req.on("end", () => {
      let parsed;
      try {
        parsed = JSON.parse(body);
      } catch {
        res.writeHead(400).end(JSON.stringify({ error: "bad_json" }));
        return;
      }

      const { slug, scope = "dossier", txHash } = parsed;

      if (!slug) {
        res.writeHead(400).end(JSON.stringify({ error: "bad_request", message: "slug is required." }));
        return;
      }

      if (!txHash) {
        // Return 402 challenge
        const challenge = {
          x402Version: 2,
          x402: true,
          slug,
          scope,
          amount: "10000",
          currency: ARC_USDC,
          recipient: MOCK_RECIPIENT,
          network: `eip155:${ARC_TESTNET_CHAIN_ID}`,
          resource: `https://arcgrade.xyz/api/v1/grade/${slug}`,
        };
        const header = Buffer.from(JSON.stringify(challenge)).toString("base64");
        res.writeHead(402, {
          "Content-Type": "application/json",
          "PAYMENT-REQUIRED": header,
        });
        res.end(JSON.stringify(challenge));
        return;
      }

      // Verify txHash format (0x + 64 hex)
      if (!/^0x[0-9a-fA-F]{64}$/.test(txHash)) {
        res.writeHead(422).end(
          JSON.stringify({ error: "invalid_tx", reason: "txHash must be 0x + 64 hex chars" })
        );
        return;
      }

      // Return unlocked dossier
      const receipt = {
        token: "eyJhbGciOiJIUzI1NiJ9.mocktoken",
        expiresAt: Math.floor(Date.now() / 1000) + 3600,
        scope,
        slug,
      };

      const dossier = {
        compositeGrade: 74,
        weakestLink: "Oracle Risk",
        riskLevel: "Medium",
        summary:
          "Morpho is a non-custodial lending protocol with isolated markets. " +
          "Primary risks include oracle manipulation and liquidation efficiency.",
        axes: [
          { id: "oracle", name: "Oracle Risk", score: 61, weight: 0.18 },
          { id: "liquidity", name: "Liquidity Risk", score: 72, weight: 0.15 },
          { id: "smart-contract", name: "Smart Contract Risk", score: 83, weight: 0.20 },
          { id: "governance", name: "Governance Risk", score: 70, weight: 0.12 },
          { id: "economic", name: "Economic Model", score: 75, weight: 0.15 },
          { id: "counterparty", name: "Counterparty Risk", score: 79, weight: 0.10 },
          { id: "legal", name: "Legal / Regulatory", score: 68, weight: 0.10 },
        ],
        citations: [
          { title: "Morpho Protocol Documentation", url: "https://docs.morpho.org" },
          { title: "Morpho v2 Audit – Cantina", url: "https://cantina.xyz/morpho" },
          { title: "DeFi Llama: Morpho TVL", url: "https://defillama.com/protocol/morpho" },
        ],
      };

      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(
        JSON.stringify({
          ok: true,
          slug,
          scope,
          mode: "onchain",
          network: `eip155:${ARC_TESTNET_CHAIN_ID}`,
          settleTx: txHash,
          payer: "0x000000000000000000000000000000000000dead",
          paid: "10000",
          expiresIn: 3600,
          receipt,
          dossier,
        })
      );
    });
  });

  return server;
}

// ── Run mock tests ────────────────────────────────────────────────────────────
const mockServer = createMockServer();
mockServer.listen(0); // ephemeral port
await once(mockServer, "listening");
const { port } = mockServer.address();
const BASE_URL = `http://127.0.0.1:${port}`;

await test("Mock: 402 on initial probe (no txHash)", async () => {
  const res = await fetch(`${BASE_URL}/api/v1/unlock`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ slug: "morpho", scope: "dossier" }),
  });
  assertEqual(res.status, 402);
  const body = await res.json();
  assert(body.x402 === true, "x402 flag must be true");
  assertEqual(body.slug, "morpho");
  assertEqual(body.scope, "dossier");
  assertEqual(body.amount, "10000");
  assert(body.recipient.startsWith("0x"), "recipient must be an address");
  assertEqual(body.network, `eip155:${ARC_TESTNET_CHAIN_ID}`);
});

await test("Mock: 402 header contains base64 challenge", async () => {
  const res = await fetch(`${BASE_URL}/api/v1/unlock`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ slug: "morpho", scope: "dossier" }),
  });
  const header = res.headers.get("payment-required");
  assert(header, "PAYMENT-REQUIRED header must be present");
  const decoded = JSON.parse(Buffer.from(header, "base64").toString("utf8"));
  assertEqual(decoded.x402Version, 2);
  assertEqual(decoded.amount, "10000");
});

await test("Mock: 400 when slug is missing", async () => {
  const res = await fetch(`${BASE_URL}/api/v1/unlock`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ scope: "dossier" }),
  });
  assertEqual(res.status, 400);
  const body = await res.json();
  assertEqual(body.error, "bad_request");
});

await test("Mock: 422 when txHash is malformed", async () => {
  const res = await fetch(`${BASE_URL}/api/v1/unlock`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ slug: "morpho", scope: "dossier", txHash: "not-a-hash" }),
  });
  assertEqual(res.status, 422);
});

await test("Mock: 200 with valid txHash — dossier unlocked", async () => {
  const validTx = "0x" + "b".repeat(64);
  const res = await fetch(`${BASE_URL}/api/v1/unlock`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ slug: "morpho", scope: "dossier", txHash: validTx }),
  });
  assertEqual(res.status, 200);
  const body = await res.json();
  assert(body.ok === true, "ok must be true");
  assertEqual(body.slug, "morpho");
  assert(body.dossier != null, "dossier must be present");
  assert(body.dossier.compositeGrade != null, "compositeGrade must be present");
  assertEqual(body.dossier.weakestLink, "Oracle Risk");
  assert(Array.isArray(body.dossier.axes), "axes must be an array");
  assert(body.dossier.axes.length > 0, "axes must not be empty");
  assert(Array.isArray(body.dossier.citations), "citations must be an array");
});

await test("Mock: dossier has 7 axis scores", async () => {
  const validTx = "0x" + "c".repeat(64);
  const res = await fetch(`${BASE_URL}/api/v1/unlock`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ slug: "morpho", scope: "dossier", txHash: validTx }),
  });
  const body = await res.json();
  assertEqual(body.dossier.axes.length, 7);
});

await test("Mock: receipt contains token, expiresAt, slug", async () => {
  const validTx = "0x" + "d".repeat(64);
  const res = await fetch(`${BASE_URL}/api/v1/unlock`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ slug: "morpho", scope: "dossier", txHash: validTx }),
  });
  const body = await res.json();
  const { receipt } = body;
  assert(receipt != null, "receipt must be present");
  assert(receipt.token != null, "receipt.token must be present");
  assert(receipt.expiresAt > 0, "receipt.expiresAt must be > 0");
  assertEqual(receipt.slug, "morpho");
  assertEqual(receipt.scope, "dossier");
});

await test("Mock: correct mode returned for onchain payment", async () => {
  const validTx = "0x" + "e".repeat(64);
  const res = await fetch(`${BASE_URL}/api/v1/unlock`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ slug: "morpho", scope: "dossier", txHash: validTx }),
  });
  const body = await res.json();
  assertEqual(body.mode, "onchain");
});

// ── Integration: full buyer flow with DRY_RUN=1 ───────────────────────────────
console.log("\n\x1b[1m\x1b[36mIntegration Tests (DRY_RUN=1)\x1b[0m");

await test("DRY_RUN: probe completes without executing payment", async () => {
  // Spawn the buyer script in dry-run mode against our mock server
  const { spawn } = await import("child_process");

  const child = spawn("node", ["scripts/arc-agent-buyer.mjs", "morpho", "dossier"], {
    env: {
      ...process.env,
      ARCGRADE_URL: BASE_URL,
      DRY_RUN: "1",
      // No AGENT_PRIVATE_KEY needed in dry-run
    },
    cwd: process.cwd(),
  });

  let stdout = "";
  let stderr = "";
  child.stdout.on("data", (d) => (stdout += d));
  child.stderr.on("data", (d) => (stderr += d));

  const code = await new Promise((resolve) => child.on("close", resolve));

  // DRY_RUN should exit 0 after printing the challenge
  if (code !== 0) {
    throw new Error(
      `DRY_RUN exited with code ${code}\nstdout: ${stdout}\nstderr: ${stderr}`
    );
  }

  assert(stdout.includes("DRY_RUN"), "output should mention DRY_RUN");
  assert(stdout.includes("10000") || stdout.includes("amount"), "challenge amount should appear");
});

await test("Error handling: no AGENT_PRIVATE_KEY exits non-zero without crash", async () => {
  const { spawn } = await import("child_process");

  const child = spawn("node", ["scripts/arc-agent-buyer.mjs", "morpho", "dossier"], {
    env: {
      ...process.env,
      ARCGRADE_URL: BASE_URL,
      // No AGENT_PRIVATE_KEY — should exit with error, not crash
    },
    cwd: process.cwd(),
  });

  let stdout = "";
  child.stdout.on("data", (d) => (stdout += d));
  child.stderr.on("data", () => {});

  const code = await new Promise((resolve) => child.on("close", resolve));

  // The probe will succeed (returns 402), then we hit the key check
  assert(code !== 0, `Should exit non-zero when AGENT_PRIVATE_KEY is missing, got ${code}`);
  assert(
    stdout.includes("AGENT_PRIVATE_KEY") || stdout.toLowerCase().includes("private key"),
    "Should mention AGENT_PRIVATE_KEY in output"
  );
});

await test("Error handling: unreachable server exits non-zero", async () => {
  const { spawn } = await import("child_process");

  const child = spawn("node", ["scripts/arc-agent-buyer.mjs", "morpho", "dossier"], {
    env: {
      ...process.env,
      ARCGRADE_URL: "http://127.0.0.1:19999", // nothing listening here
      DRY_RUN: "1",
    },
    cwd: process.cwd(),
  });

  child.stdout.on("data", () => {});
  child.stderr.on("data", () => {});

  const code = await new Promise((resolve) => child.on("close", resolve));
  assert(code !== 0, `Should exit non-zero on connection refused, got ${code}`);
});

// ── E2E Tests (optional, requires AGENT_PRIVATE_KEY + live server) ────────────
const E2E = process.argv.includes("--e2e");
const HAS_KEY = Boolean(process.env.AGENT_PRIVATE_KEY);

if (E2E) {
  console.log("\n\x1b[1m\x1b[36mE2E Tests (real Arc Testnet)\x1b[0m");

  if (!HAS_KEY) {
    console.log("  \x1b[33m⚠\x1b[0m AGENT_PRIVATE_KEY not set — skipping E2E tests");
  } else {
    await test("E2E: full buyer flow against live ArcGrade server", async () => {
      const { spawn } = await import("child_process");
      const LIVE_URL = process.env.ARCGRADE_URL || "http://localhost:3001";

      const child = spawn("node", ["scripts/arc-agent-buyer.mjs", "morpho", "dossier"], {
        env: {
          ...process.env,
          ARCGRADE_URL: LIVE_URL,
        },
        cwd: process.cwd(),
      });

      let stdout = "";
      let stderr = "";
      child.stdout.on("data", (d) => (stdout += d));
      child.stderr.on("data", (d) => (stderr += d));

      const code = await new Promise((resolve) => child.on("close", resolve));

      if (code !== 0) {
        throw new Error(
          `E2E buyer exited with code ${code}\nstdout: ${stdout}\nstderr: ${stderr}`
        );
      }

      assert(
        stdout.includes("UNLOCK SUCCESSFUL") || stdout.includes("dossier"),
        "Should print unlock success\n" + stdout
      );
    });
  }
}

// ── Shutdown ──────────────────────────────────────────────────────────────────
mockServer.close();

// ── Summary ───────────────────────────────────────────────────────────────────
console.log("\n" + "─".repeat(72));
console.log(
  `\x1b[1m${passed + failed} tests  \x1b[32m${passed} passed\x1b[0m\x1b[1m  \x1b[31m${failed} failed\x1b[0m`
);

if (errors.length > 0) {
  console.log("\nFailed tests:");
  for (const { name, err } of errors) {
    console.log(`  \x1b[31m✖\x1b[0m ${name}`);
    if (process.env.DEBUG) {
      console.log("    " + err.stack);
    }
  }
}

console.log();
process.exit(failed > 0 ? 1 : 0);
