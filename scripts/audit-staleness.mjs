/**
 * Staleness audit against the real running app.
 *
 * Starts a production server and reads the `X-ArcGrade-Stale` header the
 * summary endpoint actually emits, so this reports shipped behaviour rather
 * than what a re-implementation of isStale() would compute.
 *
 *   npm run build && node scripts/audit-staleness.mjs
 */
import { spawn } from "node:child_process";

const PORT = 4595;
const BASE = `http://127.0.0.1:${PORT}`;
const SLUGS = [
  "aave-v4-arc", "morpho-arc", "uniswap-arc", "circle-usdc", "circle-gateway",
  "eurc-arc", "usyc", "blackrock-buidl", "cirbtc", "emberyield-farm",
  "arctide-dex", "tolly", "synthra-v3", "weth-arc", "aerodrome-slipstream",
  "edgex-bridge", "argus-world", "tolly-token", "tide-token",
];

const app = spawn(
  process.execPath,
  ["node_modules/next/dist/bin/next", "start", "-p", String(PORT)],
  {
    env: {
      ...process.env,
      ARCGRADE_SECRET: "staleness-audit",
      ARCGRADE_PUBLIC_URL: BASE,
      ARCGRADE_NETWORK: "testnet",
    },
    stdio: ["ignore", "ignore", "inherit"],
  },
);

let up = false;
for (let i = 0; i < 90; i++) {
  if (app.exitCode !== null) break;
  try {
    await fetch(`${BASE}/api/v1/grade/aave-v4-arc/summary`);
    up = true;
    break;
  } catch {
    await new Promise((r) => setTimeout(r, 1000));
  }
}
if (!up) {
  console.error("server never became ready (run `npm run build` first)");
  app.kill();
  process.exit(1);
}

const DAY = 86_400_000;
const now = Date.now();
const out = [];

for (const slug of SLUGS) {
  const res = await fetch(`${BASE}/api/v1/grade/${slug}/summary`);
  if (res.status !== 200) {
    out.push({ slug, missing: true, status: res.status });
    continue;
  }
  const body = await res.json();
  const age = (now - new Date(body.updatedAt).getTime()) / DAY;
  out.push({
    slug,
    letter: body.letter,
    score: body.score,
    updatedAt: body.updatedAt,
    age,
    headerStale: res.headers.get("x-fidex-stale") ?? res.headers.get("x-arcgrade-stale"),
  });
}

console.log(`\n=== What the API actually reports @ ${new Date(now).toISOString()} ===\n`);
console.log("slug".padEnd(22), "L", "score".padEnd(6), "age".padEnd(9), "X-ArcGrade-Stale".padEnd(19), "updatedAt");
console.log("-".repeat(105));
for (const r of out) {
  if (r.missing) {
    console.log(r.slug.padEnd(22), `HTTP ${r.status}`);
    continue;
  }
  console.log(
    r.slug.padEnd(22),
    r.letter.padEnd(2),
    String(r.score).padEnd(6),
    `${r.age.toFixed(2)}d`.padEnd(9),
    String(r.headerStale).padEnd(19),
    r.updatedAt,
  );
}

const stale = out.filter((r) => !r.missing && r.headerStale === "true");
const fresh = out.filter((r) => !r.missing && r.headerStale === "false");
// A self-stamping record reports age ~0 no matter how old the analysis is.
const selfStamped = fresh.filter((r) => r.age < 0.01);
const expiringSoon = fresh.filter((r) => r.age > 5);

console.log("\n--- findings ---");
console.log(`flagged stale        : ${stale.length} -> ${stale.map((r) => r.slug).join(", ") || "none"}`);
console.log(`reporting age 0.00d   : ${selfStamped.length} -> ${selfStamped.map((r) => r.slug).join(", ") || "none"}`);
console.log(`cross the 7d line <48h: ${expiringSoon.map((r) => `${r.slug} (${r.age.toFixed(1)}d)`).join(", ") || "none"}`);

app.kill();
process.exit(0);
