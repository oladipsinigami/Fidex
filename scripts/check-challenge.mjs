/**
 * Asserts the Gateway nanopayment challenge is spec-correct on Arc testnet.
 *
 * Does not need funds: it only checks the 402 a buyer receives before paying.
 * Run:  node scripts/check-challenge.mjs
 */
import { spawn } from "node:child_process";
import { existsSync } from "node:fs";

const PORT = 4596;
const URL = `http://127.0.0.1:${PORT}`;
const SELLER = "0x2222222222222222222222222222222222222222";

// Which payment mode are we validating? The challenge must advertise the
// metadata for THAT mode: Gateway batching in gateway mode, plain USDC in http
// mode. Mixing them produces a payment the buyer cannot complete.
const MODE = process.env.ARCGRADE_X402_MODE ?? "gateway";
const IS_TESTNET = (process.env.ARCGRADE_NETWORK ?? "testnet") === "testnet";
const EXPECTED_NETWORK = IS_TESTNET ? "eip155:5042002" : "eip155:5042";
const EXPECTED_GW = "0x0077777d7EBA4688BDeF3E311b846F25870A19B9";

if (!existsSync(".next/BUILD_ID")) {
  console.log("No production build found; running `next build` first (this takes a moment)...\n");
  const code = await new Promise((res, rej) => {
    // Inherit stdio so a build failure is actually visible. Swallowing it used
    // to surface as a mysterious "Internal Server Error" from `next start`
    // several steps later, long after the real cause.
    const b = spawn(process.execPath, ["node_modules/next/dist/bin/next", "build"], {
      stdio: "inherit",
    });
    b.on("exit", (c) => (c === 0 ? res(0) : rej(new Error(`next build exited ${c}`))));
  });
  if (code !== 0) process.exit(1);
}

const app = spawn(
  process.execPath,
  ["node_modules/next/dist/bin/next", "start", "-p", String(PORT)],
  {
    env: {
      ...process.env,
      ARCGRADE_SECRET: "challenge-shape-test",
      ARCGRADE_PAY_TO: SELLER,
      ARCGRADE_X402_MODE: MODE,
      ARCGRADE_NETWORK: IS_TESTNET ? "testnet" : "mainnet",
      // Advertised as the x402 `resource`. Must be set because `next start`
      // runs with NODE_ENV=production, where it is required.
      ARCGRADE_PUBLIC_URL: URL,
    },
    stdio: ["ignore", "ignore", "inherit"],
  },
);

let ready = false;
for (let i = 0; i < 90; i++) {
  if (app.exitCode !== null) {
    console.error(
      `\n[FAIL] \`next start\` exited with code ${app.exitCode} before becoming ready. ` +
        `The error above is the cause.`,
    );
    process.exit(1);
  }
  try {
    const res = await fetch(`${URL}/api/v1/grade/aave-v4-arc/summary`);
    // Any HTTP answer means the server is listening. 500 is a server-side bug
    // worth reporting separately; a connection error means it is not up yet.
    if (res.status > 0) {
      ready = true;
      break;
    }
  } catch {
    await new Promise((r) => setTimeout(r, 1000));
  }
}

if (!ready) {
  console.error(
    `\n[FAIL] Server never became ready on ${URL} after 90s. ` +
      `Is something already bound to port ${PORT}?`,
  );
  app.kill();
  process.exit(1);
}

let failed = 0;
const check = (name, pass, detail = "") => {
  if (!pass) failed++;
  console.log(`${pass ? "PASS" : "FAIL"}  ${name}${detail ? " :: " + detail : ""}`);
};

try {
  const res = await fetch(`${URL}/api/v1/grade/aave-v4-arc`);
  const body = await res.json();
  const a = body.accepts?.[0] ?? {};

  console.log(JSON.stringify(body, null, 2).slice(0, 900));
  console.log("");

  check("status is 402", res.status === 402, `status=${res.status}`);
  check("x402Version is 2", body.x402Version === 2, `v=${body.x402Version}`);
  check("scheme is exact", a.scheme === "exact", a.scheme);
  check("network matches ARCGRADE_NETWORK", a.network === EXPECTED_NETWORK, a.network);
  check("asset is Arc USDC", a.asset === "0x3600000000000000000000000000000000000000", a.asset);
  check("amount is 10000 atomic ($0.01)", a.amount === "10000", a.amount);
  check("payTo is the configured seller", a.payTo === SELLER, a.payTo);
  check("resource block present", Boolean(body.resource?.url), body.resource?.url);

  if (MODE === "gateway") {
    check("extra.name is GatewayWalletBatched", a.extra?.name === "GatewayWalletBatched", a.extra?.name);
    check(
      "extra.verifyingContract matches the Gateway wallet for this network",
      a.extra?.verifyingContract === EXPECTED_GW,
      a.extra?.verifyingContract,
    );
    check("batched settlement window (345600)", a.maxTimeoutSeconds === 345600, a.maxTimeoutSeconds);
  } else {
    check("extra.name is USDC (not Gateway)", a.extra?.name === "USDC", a.extra?.name);
    check("no Gateway verifyingContract leaked", a.extra?.verifyingContract === undefined, a.extra?.verifyingContract);
    check("short validity window (300)", a.maxTimeoutSeconds === 300, a.maxTimeoutSeconds);
  }

  // Our routing metadata must survive alongside the payment metadata.
  check("challenge carries the slug", a.extra?.slug === "aave-v4-arc", a.extra?.slug);
  check("challenge carries the scope", a.extra?.scope === "dossier", a.extra?.scope);

  const pr = res.headers.get("payment-required");
  check("PAYMENT-REQUIRED header present", Boolean(pr));
  if (pr) {
    const decoded = JSON.parse(Buffer.from(pr, "base64").toString("utf8"));
    check("PAYMENT-REQUIRED matches the body challenge", JSON.stringify(decoded) === JSON.stringify(body.accepts ? { x402Version: body.x402Version, resource: body.resource, accepts: body.accepts } : body));
  }

  // The axis tier must price differently.
  const axis = await fetch(`${URL}/api/v1/grade/aave-v4-arc?axis=security`);
  const axisBody = await axis.json();
  check(
    "axis tier prices at 1000 atomic ($0.001)",
    axisBody.accepts?.[0]?.amount === "1000",
    axisBody.accepts?.[0]?.amount,
  );

  console.log(`\n${failed === 0 ? "challenge is spec-correct" : `${failed} check(s) failed`}`);
  process.exitCode = failed ? 1 : 0;
} finally {
  app.kill();
}