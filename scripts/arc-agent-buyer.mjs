#!/usr/bin/env node
/**
 * arc-agent-buyer.mjs
 * ─────────────────────────────────────────────────────────────────────────────
 * Autonomous agent buyer for ArcGrade x402 nanopayment paywall.
 *
 * Purchases an ArcGrade risk dossier on Circle Arc Testnet (eip155:5042002):
 *
 *   1. POST /api/v1/unlock  →  HTTP 402 (x402 challenge)
 *   2. Execute on-chain USDC ERC-20 transfer  →  txHash
 *   3. POST /api/v1/unlock { txHash }  →  HTTP 200 (unlocked dossier)
 *   4. Print a clean ASCII terminal summary
 *
 * Usage:
 *   node scripts/arc-agent-buyer.mjs [slug] [scope]
 *
 *   Defaults: slug=morpho  scope=dossier
 *
 * Required env vars:
 *   AGENT_PRIVATE_KEY   — 0x-prefixed private key for the Arc Testnet wallet
 *
 * Optional env vars:
 *   ARCGRADE_URL        — base URL of ArcGrade backend  (default http://localhost:3001)
 *   ARCGRADE_SLUG       — protocol slug override        (default from argv[2])
 *   ARCGRADE_SCOPE      — "dossier" | "axis"            (default dossier)
 *   ARCGRADE_AXIS_ID    — required if scope=axis
 *   DRY_RUN             — set to "1" to skip payment and print challenge only
 *
 * Security: private key is read from env only, never from argv or hardcoded.
 * ─────────────────────────────────────────────────────────────────────────────
 */

// ── Note: viem is imported dynamically inside executePayment() to keep this
//   file side-effect-free and compatible with both `node` and `bun`.

// ─────────────────────────────────────────────────────────────────────────────
// ARC TESTNET — facts sourced from Arc Studio's onchain registry
// ─────────────────────────────────────────────────────────────────────────────
const ARC_TESTNET = {
  chainId: 5042002,
  name: "Arc Testnet",
  rpcUrl: "https://rpc.testnet.arc.io",
  explorerBase: "https://explorer.testnet.arc.io",
  // USDC is a native predeploy — same address on every Arc network.
  // ERC-20 view: 6 decimals. Native view: 18 decimals (same pool, two faces).
  usdc: {
    address: "0x3600000000000000000000000000000000000000",
    decimals: 6,
    symbol: "USDC",
  },
};



// ─────────────────────────────────────────────────────────────────────────────
// Colour helpers (ANSI, degrades gracefully when NO_COLOR is set)
// ─────────────────────────────────────────────────────────────────────────────
const NO_COLOR = Boolean(process.env.NO_COLOR);
const c = {
  reset: NO_COLOR ? "" : "\x1b[0m",
  bold: NO_COLOR ? "" : "\x1b[1m",
  dim: NO_COLOR ? "" : "\x1b[2m",
  green: NO_COLOR ? "" : "\x1b[32m",
  yellow: NO_COLOR ? "" : "\x1b[33m",
  cyan: NO_COLOR ? "" : "\x1b[36m",
  red: NO_COLOR ? "" : "\x1b[31m",
  magenta: NO_COLOR ? "" : "\x1b[35m",
  blue: NO_COLOR ? "" : "\x1b[34m",
};

function log(symbol, color, ...msg) {
  console.log(`${color}${c.bold}${symbol}${c.reset}`, ...msg);
}
const ok = (...m) => log("✔", c.green, ...m);
const info = (...m) => log("→", c.cyan, ...m);
const warn = (...m) => log("⚠", c.yellow, ...m);
const fail = (...m) => log("✖", c.red, ...m);
const step = (n, t, ...m) =>
  console.log(`\n${c.bold}${c.blue}[${n}]${c.reset} ${c.bold}${t}${c.reset}`, ...m);

// ─────────────────────────────────────────────────────────────────────────────
// Utility: pad/truncate a string to a fixed width
// ─────────────────────────────────────────────────────────────────────────────
function col(str, width) {
  const s = String(str ?? "");
  return s.length >= width ? s.slice(0, width) : s + " ".repeat(width - s.length);
}

// ─────────────────────────────────────────────────────────────────────────────
// Utility: map numeric grade to letter + colour
// ─────────────────────────────────────────────────────────────────────────────
function gradeLabel(score) {
  if (score == null) return { letter: "N/A", color: c.dim };
  const n = Number(score);
  if (n >= 90) return { letter: "A+", color: c.green };
  if (n >= 80) return { letter: "A ", color: c.green };
  if (n >= 70) return { letter: "B ", color: c.cyan };
  if (n >= 60) return { letter: "C ", color: c.yellow };
  if (n >= 50) return { letter: "D ", color: c.magenta };
  return { letter: "F ", color: c.red };
}

// ─────────────────────────────────────────────────────────────────────────────
// Validation helpers
// ─────────────────────────────────────────────────────────────────────────────
function assertNetwork(network) {
  const expected = `eip155:${ARC_TESTNET.chainId}`;
  if (network !== expected) {
    throw new Error(
      `Network mismatch: expected ${expected}, server wants ${network}. ` +
        "This agent only pays on Arc Testnet for safety."
    );
  }
}

function assertAmount(amount, expected) {
  const actual = BigInt(amount);
  const exp = BigInt(expected);
  if (actual !== exp) {
    throw new Error(
      `Amount mismatch: expected ${exp} atomic units, server wants ${actual}. ` +
        "Refusing to pay an unexpected amount."
    );
  }
}

function assertRecipient(currency, recipient, expected) {
  if (recipient.toLowerCase() !== expected.toLowerCase()) {
    throw new Error(
      `Recipient mismatch: expected ${expected}, server sent ${recipient}. ` +
        "Refusing to pay an unexpected address."
    );
  }
  // currency must be USDC on Arc Testnet
  if (currency.toLowerCase() !== ARC_TESTNET.usdc.address.toLowerCase()) {
    throw new Error(
      `Currency mismatch: expected USDC at ${ARC_TESTNET.usdc.address}, ` +
        `server wants ${currency}.`
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Phase 1 — Probe the paywall (unauthenticated POST)
// ─────────────────────────────────────────────────────────────────────────────
async function probePaywall(baseUrl, slug, scope, axisId) {
  const body = { slug, scope, ...(axisId ? { axisId } : {}) };
  info("Probing paywall →", `POST ${baseUrl}/api/v1/unlock`);
  info("Payload:", JSON.stringify(body));

  const res = await fetch(`${baseUrl}/api/v1/unlock`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  const json = await res.json().catch(() => ({}));

  if (res.status !== 402) {
    // Already unlocked (200) or a real error
    if (res.status === 200 && json.unlocked) {
      warn("Server returned 200 without payment — possible dev mode or already-valid receipt.");
      return { alreadyUnlocked: true, data: json };
    }
    throw new Error(
      `Expected HTTP 402, got ${res.status}. Body: ${JSON.stringify(json)}`
    );
  }

  // Parse the base64 challenge from the PAYMENT-REQUIRED header
  const headerB64 = res.headers.get("payment-required") || res.headers.get("PAYMENT-REQUIRED");
  let challenge = null;
  if (headerB64) {
    try {
      challenge = JSON.parse(Buffer.from(headerB64, "base64").toString("utf8"));
    } catch {
      warn("Could not parse PAYMENT-REQUIRED header as base64 JSON, falling back to body");
    }
  }

  return { status: res.status, body: json, challenge, headers: Object.fromEntries(res.headers) };
}

// ─────────────────────────────────────────────────────────────────────────────
// Phase 2 — Execute on-chain USDC transfer on Arc Testnet
// ─────────────────────────────────────────────────────────────────────────────
async function executePayment(privateKey, recipient, amountAtomicUnits) {
  // Late-import viem so this file has zero top-level side-effects
  const {
    createWalletClient,
    createPublicClient,
    http,
    parseAbi,
    formatUnits,
    defineChain,
  } = await import("viem");
  const { privateKeyToAccount } = await import("viem/accounts");

  // Arc Testnet chain definition (viem ships `arcTestnet` in newer versions;
  // we define inline to avoid a version-dependent import path).
  const arcTestnet = defineChain({
    id: ARC_TESTNET.chainId,
    name: ARC_TESTNET.name,
    nativeCurrency: {
      // On Arc, the native gas token IS USDC — 18 decimals in native view.
      name: "USD Coin",
      symbol: "USDC",
      decimals: 18,
    },
    rpcUrls: {
      default: { http: [ARC_TESTNET.rpcUrl] },
    },
    blockExplorers: {
      default: { name: "Arc Explorer", url: ARC_TESTNET.explorerBase },
    },
  });

  const account = privateKeyToAccount(privateKey);
  info("Agent wallet:", account.address);

  const publicClient = createPublicClient({ chain: arcTestnet, transport: http() });
  const walletClient = createWalletClient({ account, chain: arcTestnet, transport: http() });

  // Verify we're on the right chain
  const chainId = await publicClient.getChainId();
  if (chainId !== ARC_TESTNET.chainId) {
    throw new Error(
      `RPC returned chain ID ${chainId}, expected ${ARC_TESTNET.chainId} (Arc Testnet)`
    );
  }

  // Check USDC balance (6-decimal ERC-20 view — never the 18-decimal native view)
  const usdcAbi = parseAbi([
    "function balanceOf(address) view returns (uint256)",
    "function transfer(address,uint256) returns (bool)",
  ]);

  const balance = await publicClient.readContract({
    address: ARC_TESTNET.usdc.address,
    abi: usdcAbi,
    functionName: "balanceOf",
    args: [account.address],
  });

  const amount = BigInt(amountAtomicUnits);
  const balanceFmt = formatUnits(balance, ARC_TESTNET.usdc.decimals);
  const amountFmt = formatUnits(amount, ARC_TESTNET.usdc.decimals);

  info("USDC balance (ERC-20, 6-decimal view):", `${balanceFmt} USDC`);
  info("Transfer amount:", `${amountFmt} USDC  (${amount} atomic units)`);

  if (balance < amount) {
    throw new Error(
      `Insufficient USDC: wallet has ${balanceFmt} USDC, need ${amountFmt} USDC.\n` +
        `Fund this address on Arc Testnet: https://faucet.circle.com\n` +
        `Wallet: ${account.address}`
    );
  }

  // Execute the ERC-20 transfer
  info("Submitting USDC transfer …");
  const hash = await walletClient.writeContract({
    address: ARC_TESTNET.usdc.address,
    abi: usdcAbi,
    functionName: "transfer",
    args: [recipient, amount],
  });

  info("Transaction submitted:", hash);
  info("Waiting for receipt …");

  // Wait for 1 confirmation
  const receipt = await publicClient.waitForTransactionReceipt({ hash, confirmations: 1 });

  if (receipt.status !== "success") {
    throw new Error(`Transaction reverted: ${hash}`);
  }

  ok("Transaction confirmed in block", receipt.blockNumber.toString());
  ok("Explorer:", `${ARC_TESTNET.explorerBase}/tx/${hash}`);

  return { txHash: hash, receipt };
}

// ─────────────────────────────────────────────────────────────────────────────
// Phase 3 — Submit txHash to unlock the dossier
// ─────────────────────────────────────────────────────────────────────────────
async function submitPayment(baseUrl, slug, scope, axisId, txHash) {
  const body = {
    slug,
    scope,
    txHash,
    ...(axisId ? { axisId } : {}),
  };
  info("Submitting payment →", `POST ${baseUrl}/api/v1/unlock`);
  info("Payload:", JSON.stringify(body));

  const res = await fetch(`${baseUrl}/api/v1/unlock`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  const json = await res.json().catch(() => ({}));

  if (res.status !== 200) {
    const reason = json.reason || json.error || JSON.stringify(json);
    throw new Error(`Unlock failed (HTTP ${res.status}): ${reason}`);
  }

  return json;
}

// ─────────────────────────────────────────────────────────────────────────────
// Phase 4 — Print the dossier summary
// ─────────────────────────────────────────────────────────────────────────────
function printDossierSummary(slug, scope, unlockData) {
  const SEP = "─".repeat(72);
  const DBLSEP = "═".repeat(72);

  console.log(`\n${c.bold}${c.cyan}${DBLSEP}${c.reset}`);
  console.log(
    `${c.bold}${c.cyan}  ARCGRADE DOSSIER UNLOCK — ${slug.toUpperCase()} / ${scope.toUpperCase()}${c.reset}`
  );
  console.log(`${c.bold}${c.cyan}${DBLSEP}${c.reset}\n`);

  // Receipt metadata
  const receipt = unlockData.receipt || {};
  const expiresAt =
    receipt.expiresAt || unlockData.expiresIn
      ? new Date(
          receipt.expiresAt
            ? receipt.expiresAt * 1000
            : Date.now() + (unlockData.expiresIn || 3600) * 1000
        ).toISOString()
      : "unknown";

  console.log(`${c.bold}Receipt${c.reset}`);
  console.log(`  Token     : ${c.dim}${receipt.token ? receipt.token.slice(0, 40) + "…" : "(server-set cookie)"}${c.reset}`);
  console.log(`  Scope     : ${receipt.scope || scope}`);
  console.log(`  Protocol  : ${receipt.slug || slug}`);
  console.log(`  Expires   : ${expiresAt}`);
  console.log(`  Network   : ${unlockData.network || `eip155:${ARC_TESTNET.chainId}`}`);
  console.log(`  Settle TX : ${c.cyan}${unlockData.settleTx || unlockData.txHash || ""}${c.reset}`);
  console.log(`  Mode      : ${unlockData.mode || "onchain"}`);
  console.log(`  Paid      : ${unlockData.paid || ""} atomic units USDC`);

  // Dossier content
  const dossier = unlockData.dossier || {};

  if (!dossier || Object.keys(dossier).length === 0) {
    console.log(`\n${c.dim}(No dossier content in response — server may be in dev mode)${c.reset}`);
    printRawUnlock(unlockData);
    return;
  }

  // ── Composite grade ──────────────────────────────────────────────────────
  console.log(`\n${SEP}`);
  console.log(`${c.bold}Risk Assessment${c.reset}`);
  console.log(SEP);

  const composite = dossier.compositeGrade ?? dossier.composite_grade ?? dossier.grade;
  if (composite != null) {
    const { letter, color } = gradeLabel(composite);
    console.log(
      `  Composite Grade : ${color}${c.bold}${letter}${c.reset}  (${composite}/100)`
    );
  }

  const weakestLink = dossier.weakestLink ?? dossier.weakest_link ?? dossier.weakest;
  if (weakestLink) {
    console.log(`  Weakest Link    : ${c.red}${c.bold}${weakestLink}${c.reset}`);
  }

  const riskLevel = dossier.riskLevel ?? dossier.risk_level ?? dossier.risk;
  if (riskLevel) {
    const riskColor =
      String(riskLevel).toLowerCase().includes("low")
        ? c.green
        : String(riskLevel).toLowerCase().includes("med")
        ? c.yellow
        : c.red;
    console.log(`  Risk Level      : ${riskColor}${c.bold}${riskLevel}${c.reset}`);
  }

  const summary = dossier.summary ?? dossier.description ?? dossier.overview;
  if (summary) {
    const lines = String(summary).match(/.{1,66}/g) || [String(summary)];
    console.log(`\n  Summary:`);
    lines.forEach((ln) => console.log(`    ${c.dim}${ln}${c.reset}`));
  }

  // ── Axis scores ──────────────────────────────────────────────────────────
  const axes =
    dossier.axes ??
    dossier.axisScores ??
    dossier.axis_scores ??
    dossier.dimensions ??
    [];

  if (Array.isArray(axes) && axes.length > 0) {
    console.log(`\n${SEP}`);
    console.log(`${c.bold}Axis Scores${c.reset}`);
    console.log(SEP);
    console.log(
      `  ${c.dim}${col("Axis", 28)} ${col("Score", 8)} ${col("Grade", 6)} ${col("Weight", 8)}${c.reset}`
    );
    console.log(`  ${c.dim}${"─".repeat(56)}${c.reset}`);

    for (const axis of axes) {
      const name = axis.name ?? axis.id ?? axis.axis ?? "Unknown";
      const score = axis.score ?? axis.value ?? null;
      const weight = axis.weight != null ? `${(axis.weight * 100).toFixed(0)}%` : "";
      const { letter, color } = gradeLabel(score);
      const scoreStr = score != null ? String(score) : "N/A";
      console.log(
        `  ${col(name, 28)} ${col(scoreStr, 8)} ${color}${col(letter, 6)}${c.reset} ${col(weight, 8)}`
      );
    }
  }

  // ── Citations ────────────────────────────────────────────────────────────
  const citations =
    dossier.citations ??
    dossier.primaryCitations ??
    dossier.primary_citations ??
    dossier.references ??
    [];

  if (Array.isArray(citations) && citations.length > 0) {
    console.log(`\n${SEP}`);
    console.log(`${c.bold}Primary Citations${c.reset}`);
    console.log(SEP);
    const shown = citations.slice(0, 10);
    shown.forEach((cite, i) => {
      const title = cite.title ?? cite.name ?? cite.url ?? String(cite);
      const url = cite.url ?? cite.href ?? "";
      console.log(`  ${c.dim}[${i + 1}]${c.reset} ${title}`);
      if (url && url !== title) {
        console.log(`      ${c.dim}${url}${c.reset}`);
      }
    });
    if (citations.length > 10) {
      console.log(`  ${c.dim}…and ${citations.length - 10} more citations${c.reset}`);
    }
  }

  // ── Additional top-level fields ──────────────────────────────────────────
  const knownKeys = new Set([
    "compositeGrade", "composite_grade", "grade",
    "weakestLink", "weakest_link", "weakest",
    "riskLevel", "risk_level", "risk",
    "axes", "axisScores", "axis_scores", "dimensions",
    "citations", "primaryCitations", "primary_citations", "references",
    "summary", "description", "overview",
  ]);
  const extra = Object.entries(dossier).filter(([k]) => !knownKeys.has(k));
  if (extra.length > 0) {
    console.log(`\n${SEP}`);
    console.log(`${c.bold}Additional Data${c.reset}`);
    console.log(SEP);
    for (const [k, v] of extra) {
      const val =
        typeof v === "object" ? JSON.stringify(v, null, 2).split("\n").join("\n    ") : String(v);
      console.log(`  ${c.dim}${k}:${c.reset} ${val}`);
    }
  }

  console.log(`\n${c.bold}${c.green}${DBLSEP}${c.reset}`);
  console.log(`${c.bold}${c.green}  UNLOCK SUCCESSFUL — dossier delivered${c.reset}`);
  console.log(`${c.bold}${c.green}${DBLSEP}${c.reset}\n`);
}

// Fallback: dump the raw unlock response when dossier is absent
function printRawUnlock(data) {
  console.log(`\n${c.dim}Raw unlock response:${c.reset}`);
  console.log(JSON.stringify(data, null, 2));
}

// ─────────────────────────────────────────────────────────────────────────────
// Main entry point
// ─────────────────────────────────────────────────────────────────────────────
async function main() {
  console.log(`\n${c.bold}${c.cyan}Fidex Agent Buyer${c.reset}  ${c.dim}(Arc Testnet · eip155:${ARC_TESTNET.chainId})${c.reset}`);
  console.log(c.dim + "─".repeat(72) + c.reset);

  // ── Config ─────────────────────────────────────────────────────────────
  const slug = process.env.FIDEX_SLUG || process.env.ARCGRADE_SLUG || process.argv[2] || "morpho";
  const scope = /** @type {"dossier"|"axis"} */ (
    process.env.FIDEX_SCOPE || process.env.ARCGRADE_SCOPE || process.argv[3] || "dossier"
  );
  const axisId = process.env.FIDEX_AXIS_ID || process.env.ARCGRADE_AXIS_ID || undefined;
  const baseUrl = (process.env.FIDEX_URL || process.env.ARCGRADE_URL || "http://localhost:3000").replace(/\/$/, "");
  const dryRun = process.env.DRY_RUN === "1";

  if (scope !== "dossier" && scope !== "axis") {
    fail('scope must be "dossier" or "axis"');
    process.exit(1);
  }
  if (scope === "axis" && !axisId) {
    fail("scope=axis requires FIDEX_AXIS_ID (or ARCGRADE_AXIS_ID) env var");
    process.exit(1);
  }

  info("Config:");
  info("  slug     :", slug);
  info("  scope    :", scope);
  info("  axisId   :", axisId || "(none)");
  info("  endpoint :", baseUrl);
  info("  dryRun   :", String(dryRun));

  // ── Step 1: Probe the paywall ────────────────────────────────────────────
  step(1, "Probe paywall");

  let probeResult;
  try {
    probeResult = await probePaywall(baseUrl, slug, scope, axisId);
  } catch (err) {
    fail("Paywall probe failed:", err.message);
    process.exit(1);
  }

  if (probeResult.alreadyUnlocked) {
    ok("Already unlocked — printing dossier");
    printDossierSummary(slug, scope, probeResult.data);
    return;
  }

  const { body: challengeBody, challenge } = probeResult;

  // Merge the parsed header challenge with the body
  const payment = {
    ...challengeBody,
    ...(challenge || {}),
  };
  const primaryAccept = (payment.accepts && payment.accepts[0]) || (challengeBody.accepts && challengeBody.accepts[0]) || {};

  const network = payment.network ?? primaryAccept.network ?? challengeBody.network ?? `eip155:${ARC_TESTNET.chainId}`;
  const amount = payment.amount ?? primaryAccept.amount ?? challengeBody.amount;
  const currency = payment.currency ?? primaryAccept.asset ?? challengeBody.currency ?? ARC_TESTNET.usdc.address;
  const recipient = payment.recipient ?? primaryAccept.payTo ?? challengeBody.recipient;
  const resourceUrl = typeof payment.resource === "object" ? payment.resource?.url : (payment.resource ?? challengeBody.resource);

  console.log(`\n${c.bold}x402 Payment Challenge:${c.reset}`);
  console.log(`  x402 version : ${payment.x402Version ?? 2}`);
  console.log(`  network      : ${network}`);
  console.log(`  amount       : ${amount} atomic units`);
  console.log(`  currency     : ${currency}`);
  console.log(`  recipient    : ${recipient}`);
  console.log(`  resource     : ${resourceUrl}`);

  if (dryRun) {
    warn("DRY_RUN=1 — skipping payment execution. Exiting.");
    return;
  }

  // ── Validate challenge fields ────────────────────────────────────────────
  step(2, "Validate challenge");

  if (!recipient) {
    fail("No recipient address in challenge — cannot pay. Check that FIDEX_PAY_TO is set server-side.");
    process.exit(1);
  }
  if (!amount) {
    fail("No amount in challenge.");
    process.exit(1);
  }

  try {
    assertNetwork(network);
    // Expected: 10000 for dossier ($0.01), 1000 for axis ($0.001)
    const expectedAtomicUnits = scope === "dossier" ? 10_000n : 1_000n;
    assertAmount(amount, expectedAtomicUnits);
    assertRecipient(currency, recipient, recipient); // presence check; currency validated below
    if (currency.toLowerCase() !== ARC_TESTNET.usdc.address.toLowerCase()) {
      throw new Error(
        `Currency ${currency} is not Arc Testnet USDC (${ARC_TESTNET.usdc.address})`
      );
    }
  } catch (err) {
    fail("Challenge validation failed:", err.message);
    process.exit(1);
  }

  ok("Challenge validated — network, amount, and currency all match");
  ok(`  Paying ${amount} atomic USDC = $${(Number(amount) / 1e6).toFixed(4)} to ${recipient}`);

  // ── Wallet key ───────────────────────────────────────────────────────────
  const rawKey = process.env.AGENT_PRIVATE_KEY;
  if (!rawKey) {
    fail("AGENT_PRIVATE_KEY env var is required.");
    fail(
      "Set it to a 0x-prefixed private key for an Arc Testnet wallet funded with USDC."
    );
    fail("Get testnet USDC from https://faucet.circle.com");
    process.exit(1);
  }
  const privateKey = /** @type {`0x${string}`} */ (
    rawKey.startsWith("0x") ? rawKey : `0x${rawKey}`
  );

  // ── Step 3: Execute payment ───────────────────────────────────────────────
  step(3, "Execute USDC transfer on Arc Testnet");

  let txHash;
  try {
    const result = await executePayment(privateKey, recipient, amount);
    txHash = result.txHash;
  } catch (err) {
    fail("Payment failed:", err.message);
    process.exit(1);
  }

  ok("txHash:", txHash);

  // ── Step 4: Submit txHash to unlock ──────────────────────────────────────
  step(4, "Submit txHash → unlock dossier");

  let unlockData;
  try {
    unlockData = await submitPayment(baseUrl, slug, scope, axisId, txHash);
  } catch (err) {
    fail("Unlock submission failed:", err.message);
    console.log(
      `\n${c.yellow}The on-chain payment WAS submitted. txHash: ${txHash}${c.reset}`
    );
    console.log(
      `${c.yellow}You may retry the unlock manually with this txHash.${c.reset}`
    );
    process.exit(1);
  }

  if (!unlockData.ok && !unlockData.unlocked) {
    fail("Server returned non-ok:", JSON.stringify(unlockData));
    process.exit(1);
  }

  // ── Step 5: Print dossier summary ────────────────────────────────────────
  step(5, "Dossier Summary");
  printDossierSummary(slug, scope, { ...unlockData, txHash });
}

// ── Run ───────────────────────────────────────────────────────────────────────
main().catch((err) => {
  console.error(`\n${c.red}${c.bold}Fatal error:${c.reset}`, err.message);
  if (process.env.DEBUG) {
    console.error(err.stack);
  }
  process.exit(1);
});
