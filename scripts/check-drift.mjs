/**
 * Material-change detector: live TVL drift and deployed-bytecode drift.
 *
 * Both are REVIEW TRIGGERS. Neither advances a rating's freshness, because
 * neither is an analyst re-review. A protocol whose TVL tripled still has
 * whatever custody risk it had yesterday until a human looks again.
 *
 *   npm run verify:drift
 */
import { observeRegisteredContracts, reportCoverage, flaggedForReview, REGISTERED_CONTRACTS } from "../lib/bytecode.ts";
import { fetchLiveTvl, tvlDriftPct, DRIFT_ALERT_PCT } from "../lib/telemetry.ts";

const SLUGS = [
  "aave-v4-arc", "aerodrome-slipstream", "arctide-dex", "argus-world", "blackrock-buidl",
  "cirbtc", "edgex-bridge", "emberyield-farm", "eurc-arc", "circle-gateway", "morpho-arc",
  "synthra-v3", "tide-token", "tolly", "tolly-token", "uniswap-arc", "circle-usdc", "usyc", "weth-arc",
];
const STATIC_TVL = {
  "aave-v4-arc": 412_000_000, "aerodrome-slipstream": 3_081_635, "arctide-dex": 123_150,
  "argus-world": 1_868_758, "blackrock-buidl": 38_000_000, "cirbtc": 22_000_000,
  "edgex-bridge": 2_496_034, "emberyield-farm": 6_100_000, "eurc-arc": 14_800_000,
  "circle-gateway": 252_700_000, "morpho-arc": 186_000_000, "synthra-v3": 97_010,
  "tide-token": 1_280_000, tolly: 321_080, "tolly-token": 3_450_000, "uniswap-arc": 94_000_000,
  "circle-usdc": 1_840_000_000, usyc: 71_000_000, "weth-arc": 42_500_000,
};

const fmt = (n) => (n == null ? "      -" : n >= 1e6 ? `$${(n / 1e6).toFixed(1)}M` : `$${(n / 1e3).toFixed(0)}K`);

console.log("\n=== Live TVL vs stored snapshot ===\n");
const live = await fetchLiveTvl();
const drift = [];
console.log("slug                 stored        live          drift     status");
console.log("-".repeat(76));
for (const slug of SLUGS) {
  const t = live.get(slug);
  if (!t) {
    console.log(slug.padEnd(21) + fmt(STATIC_TVL[slug]).padEnd(14) + "     -          n/a     not tracked");
    continue;
  }
  const d = tvlDriftPct(STATIC_TVL[slug], t.tvlUsd);
  const alert = Math.abs(d) >= DRIFT_ALERT_PCT;
  if (alert) drift.push({ slug, d });
  console.log(
    slug.padEnd(21) + fmt(STATIC_TVL[slug]).padEnd(14) + fmt(t.tvlUsd).padEnd(14) +
    `${d >= 0 ? "+" : ""}${d.toFixed(0)}%`.padEnd(10) + (alert ? "DRIFT >25%" : "ok"),
  );
}

console.log("\n=== Deployed bytecode ===\n");
const cov = reportCoverage(SLUGS, REGISTERED_CONTRACTS);
console.log(`Coverage: ${cov.monitored}/${cov.total} protocols monitored`);
if (cov.unmonitored.length) {
  console.log(`Not monitored (no verified address registered): ${cov.unmonitored.join(", ")}`);
}
console.log("");

const obs = await observeRegisteredContracts();
for (const o of obs) {
  const state = o.noCode ? "NO CODE (wrong chain or destroyed)"
    : o.changedSinceBaseline === null ? "baseline recorded"
    : o.changedSinceBaseline ? "CHANGED - re-review required"
    : "unchanged";
  console.log(
    `${o.slug.padEnd(16)} ${o.address}  ${String(o.codeSize).padStart(6)} bytes  ${o.codeHash.slice(0, 18)}…  ${state}`,
  );
}
if (!obs.length) console.log("No registered contract addresses. Add verified addresses in lib/bytecode.ts.");

const flags = flaggedForReview();
console.log(`\n${drift.length} TVL drift(s) over ${DRIFT_ALERT_PCT}%, ${flags.length} bytecode change(s).`);
console.log("These are review triggers. They do not change any rating's freshness,");
console.log("because a market-data move or an unchanged contract is not a re-review.");
if (drift.length) console.log(`\nDrift: ${drift.map((d) => `${d.slug} ${d.d >= 0 ? "+" : ""}${d.d.toFixed(0)}%`).join(", ")}`);
console.log("");
