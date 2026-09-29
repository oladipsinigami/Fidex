/**
 * Fails-closed test for the live x402 path.
 *
 * Boots a fake facilitator plus a Next server with real ARCGRADE_* env vars
 * and asserts that no forged or unpaid request can mint a receipt.
 *
 *   node scripts/verify-payment.mjs
 */
import { spawn } from "node:child_process";
import { createServer } from "node:http";
import { existsSync, readFileSync, writeFileSync, rmSync, mkdirSync } from "node:fs";
import path from "node:path";

const PORT_FAC = 4599;
const PORT_APP = 4598;
const MODE_FILE = ".facilitator-mode";

/** The app runs in a fixed mode, so the fake facilitator reads its behaviour
 *  from a file that the test flips between cases. */
const facilitator = createServer((req, res) => {
  let body = "";
  req.on("data", (d) => (body += d));
  req.on("end", () => {
    const mode = existsSync(MODE_FILE) ? readFileSync(MODE_FILE, "utf8").trim() : "reject";
    const isSettle = (req.url ?? "").endsWith("/settle");
    res.setHeader("content-type", "application/json");

    if (mode === "http500") {
      res.statusCode = 503;
      res.end("{}");
      return;
    }
    if (mode === "reject") {
      res.end(JSON.stringify({ isValid: false, invalidReason: "signature_invalid" }));
      return;
    }
    if (isSettle) {
      // Settle must report success explicitly; /verify does not carry it.
      if (mode === "settle-fail") {
        res.end(JSON.stringify({ success: false, errorReason: "batch_submission_failed" }));
      } else {
        res.end(
          JSON.stringify({ success: true, transaction: "0xfake_" + Date.now() + "_" + Math.random().toString(36).slice(2, 7), payer: "0xbuyer", network: NET }),
        );
      }
      return;
    }
    if (mode === "underpaid") {
      res.end(JSON.stringify({ isValid: true, amount: "1000", payer: "0xbuyer" }));
      return;
    }
    res.end(JSON.stringify({ isValid: true, amount: "10000", payer: "0xbuyer" }));
  });
});

const setMode = (m) => writeFileSync(MODE_FILE, m);

const NET =
  (process.env.FIDEX_NETWORK ?? process.env.ARCGRADE_NETWORK) === "testnet"
    ? "eip155:5042002"
    : "eip155:5042";
const SELLER = "0x1111111111111111111111111111111111111111";

const results = [];
const check = (name, pass, detail = "") => {
  results.push({ name, pass, detail });
  console.log(`${pass ? "PASS" : "FAIL"}  ${name}${detail ? " :: " + detail : ""}`);
};

async function postUnlock(headers, body = { slug: "aave-v4-arc" }) {
  const res = await fetch(`http://127.0.0.1:${PORT_APP}/api/v1/unlock`, {
    method: "POST",
    headers: { "content-type": "application/json", ...headers },
    body: JSON.stringify(body),
    redirect: "manual",
  });
  let json = null;
  try {
    json = await res.json();
  } catch {}
  return {
    status: res.status,
    json,
    cookie: res.headers.get("set-cookie"),
    paymentResponse: res.headers.get("payment-response"),
    paymentRequired: res.headers.get("payment-required"),
  };
}

const b64 = (o) => Buffer.from(JSON.stringify(o)).toString("base64");

/**
 * The real buyer shape. BatchEvmScheme.createPaymentPayload returns ONLY
 * { x402Version, payload: { authorization, signature } } -- it does not echo
 * scheme or network. The server must therefore validate the signed
 * authorisation, not wrapper fields.
 */
const auth = (over = {}) => ({
  from: "0x1111111111111111111111111111111111111111",
  to: SELLER,
  value: "10000",
  validAfter: String(Math.floor(Date.now() / 1000) - 60),
  validBefore: String(Math.floor(Date.now() / 1000) + 3600),
  nonce: "0x" + "ab".repeat(32),
  ...over,
});

const goodHeader = b64({
  x402Version: 2,
  payload: { authorization: auth(), signature: "0x" + "11".repeat(65) },
});

await new Promise((r) => facilitator.listen(PORT_FAC, r));

// Build once, then run the production server. A second `next dev` on a
// different port contends for the .next lock with the dev server already
// running, so the compiled output is the reliable thing to test against.
if (!existsSync(".next/BUILD_ID")) {
  await new Promise((resolve, reject) => {
    const b = spawn(process.execPath, ["node_modules/next/dist/bin/next", "build"], {
      stdio: "ignore",
    });
    b.on("exit", (code) => (code === 0 ? resolve() : reject(new Error(`build failed ${code}`))));
  });
}

const app = spawn(
  process.execPath,
  ["node_modules/next/dist/bin/next", "start", "-p", String(PORT_APP)],
  {
    env: {
      ...process.env,
      FIDEX_SECRET: "test-secret-for-fail-closed-suite",
      FIDEX_FACILITATOR_URL: `http://127.0.0.1:${PORT_FAC}`,
      FIDEX_PAY_TO: "0x1111111111111111111111111111111111111111",
      FIDEX_X402_MODE: "http",
      FIDEX_NETWORK: process.env.FIDEX_NETWORK ?? process.env.ARCGRADE_NETWORK ?? "mainnet",
      FIDEX_PUBLIC_URL: `http://127.0.0.1:${PORT_APP}`,
      ARCGRADE_SECRET: "test-secret-for-fail-closed-suite",
      ARCGRADE_FACILITATOR_URL: `http://127.0.0.1:${PORT_FAC}`,
      ARCGRADE_PAY_TO: "0x1111111111111111111111111111111111111111",
      ARCGRADE_X402_MODE: "http",
      ARCGRADE_NETWORK: process.env.ARCGRADE_NETWORK ?? "mainnet",
      ARCGRADE_PUBLIC_URL: `http://127.0.0.1:${PORT_APP}`,
    },
    stdio: "ignore",
  },
);

// Wait for readiness.
for (let i = 0; i < 90; i++) {
  try {
    await fetch(`http://127.0.0.1:${PORT_APP}/api/v1/grade/aave-v4-arc`);
    break;
  } catch {
    await new Promise((r) => setTimeout(r, 1000));
  }
}

try {
  setMode("reject");
  let r = await postUnlock({ "payment-signature": goodHeader });
  check("facilitator rejection yields 402", r.status === 402, `status=${r.status}`);

  r = await postUnlock({ "payment-signature": b64({ x402Version: 1, scheme: "exact", network: NET, payload: { authorization: auth() } }) });
  check("wrong x402 version yields 402", r.status === 402, `status=${r.status}`);

  r = await postUnlock({ "payment-signature": b64({ x402Version: 2, scheme: "exact", network: "eip155:1", payload: { authorization: auth() } }) });
  check("declared wrong network yields 402", r.status === 402, `status=${r.status}`);

  r = await postUnlock({ "payment-signature": b64({ x402Version: 2, payload: {} }) });
  check("missing authorization yields 402", r.status === 402, `reason=${r.json?.reason}`);

  r = await postUnlock({ "payment-signature": b64({ x402Version: 2, payload: { authorization: auth({ to: "0xdeadbeef00000000000000000000000000000000" }), signature: "0x" } }) });
  check("authorization paying the wrong address yields 402", r.status === 402, `reason=${r.json?.reason}`);

  r = await postUnlock({ "payment-signature": b64({ x402Version: 2, payload: { authorization: auth({ value: "1" }), signature: "0x" } }) });
  check("underpaid authorization refused (402)", r.status === 402, `reason=${r.json?.reason}`);

  r = await postUnlock({ "payment-signature": b64({ x402Version: 2, payload: { authorization: auth({ validBefore: String(Math.floor(Date.now() / 1000) - 100) }), signature: "0x" } }) });
  check("expired authorization refused (402)", r.status === 402, `reason=${r.json?.reason}`);

  r = await postUnlock({ "payment-signature": b64({ x402Version: 2 }) });
  check("missing payload yields 402", r.status === 402, `status=${r.status}`);

  r = await postUnlock({ "payment-signature": "!!!not-base64!!!" });
  check("malformed header yields 402", r.status === 402, `status=${r.status}`);

  r = await postUnlock({});
  check("missing payment header yields 402", r.status === 402, `status=${r.status}`);

  r = await postUnlock({}, { slug: "aave-v4-arc", ref: "0xforged" });
  check("forged ref field is ignored, still 402", r.status === 402, `status=${r.status}`);

  r = await postUnlock({}, { slug: "aave-v4-arc", payer: "0x1234567890123456789012345678901234567890" });
  check("fake bypass { payer: '0x...' } without payment is refused (402)", r.status === 402, `status=${r.status}`);

  r = await postUnlock({}, { slug: "aave-v4-arc", txHash: "0x0000000000000000000000000000000000000000000000000000000000000000" });
  check("unconfirmed on-chain txHash is refused (402)", r.status === 402, `status=${r.status}`);

  r = await postUnlock({ "payment-signature": b64({ x402Version: 2, scheme: "exact", network: NET, payload: { authorization: { value: "1" } } }) });
  check("underpaid authorisation refused before facilitator (402)", r.status === 402, `status=${r.status}`);

  setMode("http500");
  r = await postUnlock({ "payment-signature": goodHeader });
  check("facilitator outage fails closed (402)", r.status === 402, `status=${r.status}`);

  setMode("underpaid");
  r = await postUnlock({ "payment-signature": goodHeader });
  check("facilitator reports underpayment, refused (402)", r.status === 402, `status=${r.status}`);

  setMode("settle-fail");
  r = await postUnlock({ "payment-signature": goodHeader });
  check("settle success:false refused (402)", r.status === 402, `status=${r.status}`);

  // The one case that must SUCCEED, proving the suite can tell real from fake.
  setMode("ok");
  r = await postUnlock({ "payment-signature": goodHeader });
  check("valid settled payment mints a receipt (200)", r.status === 200, `status=${r.status}`);
  check("receipt cookie issued", Boolean(r.cookie && (r.cookie.includes("fidex_unlock") || r.cookie.includes("arcgrade_unlock"))));
  check(
    "PAYMENT-RESPONSE settlement header present",
    Boolean(r.paymentResponse),
    r.paymentResponse ? Buffer.from(r.paymentResponse, "base64").toString("utf8").slice(0, 80) : "missing",
  );
  check("body reports gateway/http mode", Boolean(r.json?.mode), `mode=${r.json?.mode}`);

  // Regression: the buyer must nest the authorisation under `payload`.
  // A flattened header ({x402Version, authorization, signature}) was once
  // sent by scripts/settle-live.mjs and the server reported
  // `missing_payment_payload` instead of a usable diagnosis.
  const flattened = b64({
    x402Version: 2,
    authorization: auth(),
    signature: "0x" + "11".repeat(65),
  });
  r = await postUnlock({ "payment-signature": flattened });
  check(
    "flattened (unnested) authorisation is rejected with a clear reason",
    r.status === 402 && r.json?.reason === "missing_payment_payload",
    `status=${r.status} reason=${r.json?.reason}`,
  );

  /**
   * Regression: the receipt store must fail CLOSED.
   *
   * `lib/db.ts` used to catch any open failure and silently fall back to an
   * in-memory SQLite. On an ephemeral or read-only filesystem -- the normal
   * case on serverless -- that fallback fires, and the UNIQUE(tx_hash)
   * constraint that blocks replay dies with the process. A replayed payment
   * would then be accepted and mint a second free receipt.
   *
   * This boots a second server whose ARCGRADE_DB_PATH cannot be opened and
   * asserts a *genuinely valid, fully settled* payment still yields no receipt.
   */
  const BLOCKED_PORT = 4597;
  // A path that is a DIRECTORY, not a file. Its parent exists and is writable,
  // so directory creation succeeds, but opening it as a SQLite database fails
  // (SQLITE_CANTOPEN). That exercises the database-open failure specifically,
  // which is the branch that used to silently fall back to :memory:.
  const blockedDbPath = path.join(process.cwd(), "data", "blocked-store");
  mkdirSync(blockedDbPath, { recursive: true });
  const badApp = spawn(
    process.execPath,
    ["node_modules/next/dist/bin/next", "start", "-p", String(BLOCKED_PORT)],
    {
      env: {
        ...process.env,
        FIDEX_SECRET: "test-secret-for-fail-closed-suite",
        FIDEX_FACILITATOR_URL: `http://127.0.0.1:${PORT_FAC}`,
        FIDEX_PAY_TO: "0x1111111111111111111111111111111111111111",
        FIDEX_X402_MODE: "http",
        FIDEX_NETWORK: process.env.FIDEX_NETWORK ?? process.env.ARCGRADE_NETWORK ?? "mainnet",
        FIDEX_PUBLIC_URL: `http://127.0.0.1:${BLOCKED_PORT}`,
        FIDEX_DB_PATH: blockedDbPath,
        ARCGRADE_SECRET: "test-secret-for-fail-closed-suite",
        ARCGRADE_FACILITATOR_URL: `http://127.0.0.1:${PORT_FAC}`,
        ARCGRADE_PAY_TO: "0x1111111111111111111111111111111111111111",
        ARCGRADE_X402_MODE: "http",
        ARCGRADE_NETWORK: process.env.ARCGRADE_NETWORK ?? "mainnet",
        ARCGRADE_PUBLIC_URL: `http://127.0.0.1:${BLOCKED_PORT}`,
        ARCGRADE_DB_PATH: blockedDbPath,
      },
      stdio: "ignore",
    },
  );

  try {
    let up = false;
    for (let i = 0; i < 90; i++) {
      if (badApp.exitCode !== null) break;
      try {
        await fetch(`http://127.0.0.1:${BLOCKED_PORT}/api/v1/grade/aave-v4-arc/summary`);
        up = true;
        break;
      } catch {
        await new Promise((r) => setTimeout(r, 1000));
      }
    }
    if (!up) {
      check("unwritable receipt store still boots (setup)", false, "server never became ready");
    } else {
      setMode("ok");
      const res2 = await fetch(`http://127.0.0.1:${BLOCKED_PORT}/api/v1/unlock`, {
        method: "POST",
        headers: { "content-type": "application/json", "payment-signature": goodHeader },
        body: JSON.stringify({ slug: "aave-v4-arc" }),
        redirect: "manual",
      });
      check(
        "unwritable receipt store refuses a valid payment (no free unlock)",
        res2.status === 402,
        `status=${res2.status}`,
      );
      check(
        "no unlock cookie is issued when the store is unavailable",
        !(res2.headers.get("set-cookie") ?? "").includes("fidex_unlock") &&
        !(res2.headers.get("set-cookie") ?? "").includes("arcgrade_unlock"),
      );
    }
  } finally {
    badApp.kill();
    try { rmSync(blockedDbPath, { recursive: true, force: true }); } catch {}
  }

  const failed = results.filter((x) => !x.pass).length;
  console.log(`\n${results.length - failed}/${results.length} passed`);
  process.exitCode = failed ? 1 : 0;
} finally {
  app.kill();
  facilitator.close();
  try { rmSync(MODE_FILE, { force: true }); } catch {}
}
