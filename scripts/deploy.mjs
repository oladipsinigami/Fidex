#!/usr/bin/env node
/**
 * One-command deployment to Vercel + Turso.
 *
 *   node scripts/deploy.mjs doctor     # check config, print only PRESENT/MISSING
 *   node scripts/deploy.mjs all        # create db, migrate, env, deploy, smoke test
 *   node scripts/deploy.mjs turso      # create the Turso database only
 *   node scripts/deploy.mjs migrate    # apply the schema to Turso
 *   node scripts/deploy.mjs env        # push env vars to Vercel
 *   node scripts/deploy.mjs deploy     # production deploy
 *   node scripts/deploy.mjs smoke      # verify the deployed paywall
 *
 * Secrets come from .env.deploy.local, which is gitignored. This script never
 * prints a secret value -- only whether one is present, and its length. The
 * only place a value is ever written out is into the local .env.deploy.local
 * when `turso` creates a new database URL.
 */
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const SECRETS = path.join(ROOT, ".env.deploy.local");

// ---------------------------------------------------------------- secrets

function loadSecrets() {
  if (!existsSync(SECRETS)) return {};
  const out = {};
  for (const line of readFileSync(SECRETS, "utf8").split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (!m) continue;
    if (m[1].startsWith("#")) continue;
    out[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
  return out;
}

const S = loadSecrets();
const set = (k, v) => { S[k] = v; };
const has = (k) => Boolean(S[k] && S[k].length);

/** Deliberately reveals nothing about the value. */
const mask = (k) => (has(k) ? `present (${S[k].length} chars)` : "MISSING");

function saveSecrets() {
  const body = Object.entries(S)
    .map(([k, v]) => `${k}=${v}`)
    .join("\n");
  writeFileSync(SECRETS, `# Written by scripts/deploy.mjs. Gitignored. Do not commit.\n${body}\n`);
}

if (!existsSync(SECRETS) && process.argv[2] !== "doctor") {
  console.error(`\nNo ${path.basename(SECRETS)} found.\n`);
  console.error("  cp .env.deploy.example .env.deploy.local\n");
  console.error("Then fill in VERCEL_TOKEN, TURSO_AUTH_TOKEN, FIDEX_PAY_TO and FIDEX_SECRET.\n");
  process.exit(1);
}

// ---------------------------------------------------------------- helpers

const run = (cmd, args, opts = {}) => {
  const r = spawnSync(cmd, args, {
    cwd: ROOT,
    encoding: "utf8",
    env: { ...process.env, ...envForChild() },
    ...opts,
  });
  if (r.status !== 0 && !opts.allowFail) {
    console.error((r.stdout || "") + (r.stderr || ""));
    throw new Error(`${cmd} ${args[0]} exited ${r.status}`);
  }
  return r;
};

function envForChild() {
  const e = {};
  if (has("VERCEL_TOKEN")) e.VERCEL_TOKEN = S.VERCEL_TOKEN;
  if (has("TURSO_AUTH_TOKEN")) e.TURSO_AUTH_TOKEN = S.TURSO_AUTH_TOKEN;
  return e;
}

const projectName = () => S.VERCEL_PROJECT_NAME || "fidex";

/** After the first deploy the x402 resource must match the real host. */
function productionDomain() {
  if (has("VERCEL_PRODUCTION_DOMAIN")) return S.VERCEL_PRODUCTION_DOMAIN;
  if (projectName()) return `https://${projectName()}.vercel.app`;
  return null;
}

// ---------------------------------------------------------------- steps

function doctor() {
  console.log("\n=== deploy doctor ===\n");
  const required = ["VERCEL_TOKEN", "TURSO_AUTH_TOKEN", "FIDEX_PAY_TO", "FIDEX_SECRET"];
  const optional = ["TURSO_DATABASE_URL", "VERCEL_PRODUCTION_DOMAIN", "VERCEL_PROJECT_NAME"];
  let bad = 0;
  for (const k of required) {
    const ok = has(k);
    if (!ok) bad++;
    console.log(`  ${ok ? "OK     " : "MISSING"}  ${k.padEnd(24)} ${mask(k)}`);
  }
  for (const k of optional) {
    console.log(`  ${has(k) ? "OK     " : "absent"}  ${k.padEnd(24)} ${mask(k)}`);
  }
  console.log(`\n  network: ${S.FIDEX_NETWORK || "(unset -> mainnet)"}`);
  console.log(`  mode   : ${S.FIDEX_X402_MODE || "(unset -> gateway)"}`);

  if (has("FIDEX_PAY_TO") && /^0x0+$/i.test(S.FIDEX_PAY_TO)) {
    console.error("\n  WARNING: FIDEX_PAY_TO looks like the zero address.");
  }
  if (has("FIDEX_NETWORK") && S.FIDEX_NETWORK === "mainnet" && !productionDomain()) {
    console.error("  WARNING: mainnet with no known public URL. FIDEX_PUBLIC_URL is required");
    console.error("           in production and becomes the x402 resource buyers echo back.");
  }
  console.log(bad ? `\n  ${bad} required value(s) missing.\n` : "\n  Ready.\n");
  return bad;
}

function createTurso() {
  if (has("TURSO_DATABASE_URL")) {
    console.log("  TURSO_DATABASE_URL already set, skipping create.");
    return;
  }
  console.log("  creating Turso database via npx turso...");
  const r = run("npx", ["--yes", "turso", "db", "create", "fidex", "--group", S.TURSO_GROUP || "default"], {
    allowFail: true,
  });
  const url = ((r.stdout || "") + (r.stderr || "")).match(/libsql:\/\/[^\s"']+/);
  if (!url) throw new Error("could not parse a libsql:// URL from `turso db create` output");
  set("TURSO_DATABASE_URL", url[0]);
  saveSecrets();
  console.log(`  created. URL written to ${path.basename(SECRETS)} (not printed).`);
}

async function migrate() {
  if (!has("TURSO_DATABASE_URL")) throw new Error("TURSO_DATABASE_URL is not set");
  const { createClient } = await import("@libsql/client");
  const client = createClient({ url: S.TURSO_DATABASE_URL, authToken: S.TURSO_AUTH_TOKEN });
  const mod = await import("../lib/db.ts");
  const applied = await mod.migrate(client);
  const res = await client.execute("SELECT MAX(version) AS v FROM schema_version");
  console.log(`  schema ${applied ? "applied" : "already current"} (version ${res.rows[0].v}).`);

  // Prove the constraint that replay protection depends on actually exists.
  const idx = await client.execute(
    "SELECT name FROM sqlite_master WHERE type='index' AND tbl_name='receipts'",
  );
  const names = idx.rows.map((r) => r.name);
  console.log(`  receipts indexes: ${names.join(", ")}`);
  if (!names.includes("idx_receipts_tx")) {
    throw new Error("idx_receipts_tx is missing -- replay protection would not hold");
  }
  client.close();
}

function pushEnv() {
  const domain = productionDomain();
  const pairs = [
    ["TURSO_DATABASE_URL", S.TURSO_DATABASE_URL],
    ["TURSO_AUTH_TOKEN", S.TURSO_AUTH_TOKEN],
    ["FIDEX_PAY_TO", S.FIDEX_PAY_TO],
    ["FIDEX_SECRET", S.FIDEX_SECRET],
    ["FIDEX_NETWORK", S.FIDEX_NETWORK || "mainnet"],
    ["FIDEX_X402_MODE", S.FIDEX_X402_MODE || "gateway"],
  ];
  if (domain) {
    pairs.push(["FIDEX_PUBLIC_URL", domain]);
    // Legacy name still read as a fallback by lib/site.ts and lib/x402.ts.
    pairs.push(["ARCGRADE_PUBLIC_URL", domain]);
  }
  const missing = pairs.filter(([, v]) => !v);
  if (missing.length) throw new Error(`refusing to deploy with empty: ${missing.map(([k]) => k).join(", ")}`);

  console.log(`  pushing ${pairs.length} env vars to Vercel (production)...`);
  for (const [k, v] of pairs) {
    run("npx", ["--yes", "vercel", "env", "add", "production", k, v], { stdio: "ignore" });
    console.log(`    ${k}`);
  }
}

function deploy() {
  console.log("  deploying to production...");
  run("npx", ["--yes", "vercel", "deploy", "--prod", "--yes"], { stdio: "inherit" });
  console.log("  deployed.");
}

async function smoke() {
  const base = productionDomain();
  if (!base) throw new Error("no production URL to test");
  console.log(`  testing ${base} ...`);

  const sum = await fetch(`${base}/api/v1/grade/cirbtc/summary`);
  if (!sum.ok) throw new Error(`summary returned ${sum.status}`);
  const body = await sum.json();
  const stale = sum.headers.get("x-fidex-stale") ?? sum.headers.get("x-arcgrade-stale");
  console.log(`  summary: ${body.slug} ${body.letter}/${body.score}  X-Stale=${stale}`);

  const paid = await fetch(`${base}/api/v1/grade/cirbtc`);
  if (paid.status !== 402) throw new Error(`paid endpoint returned ${paid.status}, expected 402`);
  const challenge = await paid.json();
  const accept = challenge.accepts?.[0] ?? {};
  console.log(`  paywall: 402 ok`);
  console.log(`  resource: ${challenge.resource?.url}`);
  console.log(`  network : ${accept.network}`);
  console.log(`  asset   : ${accept.asset}`);
  console.log(`  payTo   : ${accept.payTo}`);
  console.log(`  amount  : ${accept.amount}`);
  console.log(`  extra   : ${accept.extra?.name}`);

  const problems = [];
  if (challenge.resource?.url !== `${base}/api/v1/grade/cirbtc`) {
    problems.push("resource does not match the deployed host -- buyers would pay for an unreachable URL");
  }
  if (accept.extra?.name !== "GatewayWalletBatched") problems.push("Gateway metadata missing");
  if (String(accept.network) !== "eip155:5042") problems.push(`network is ${accept.network}, expected eip155:5042`);

  console.log(problems.length ? `\n  PROBLEMS:\n    ${problems.join("\n    ")}\n` : "\n  Paywall looks correct.\n");
  return problems.length;
}

// ---------------------------------------------------------------- main

const cmd = process.argv[2] || "all";
console.log("");

try {
  switch (cmd) {
    case "doctor":
      process.exitCode = doctor() ? 1 : 0;
      break;
    case "turso":
      createTurso();
      break;
    case "migrate":
      await migrate();
      break;
    case "env":
      pushEnv();
      break;
    case "deploy":
      deploy();
      break;
    case "smoke":
      process.exitCode = (await smoke()) ? 1 : 0;
      break;
    case "all": {
      if (doctor()) {
        console.error("Fix the missing values above, then re-run.\n");
        process.exit(1);
      }
      createTurso();
      await migrate();
      pushEnv();
      deploy();
      const problems = await smoke();
      console.log("  Next: run `npm run settle:live` with a MAINNET buyer key to prove real settlement.\n");
      process.exitCode = problems ? 1 : 0;
      break;
    }
    default:
      console.error(`Unknown command "${cmd}". Try: doctor | turso | migrate | env | deploy | smoke | all\n`);
      process.exit(1);
  }
} catch (err) {
  console.error(`\n  FAILED: ${err.message}\n`);
  process.exit(1);
}
