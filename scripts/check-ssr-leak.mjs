/**
 * Paid-content leak probe.
 *
 * Fetches every public route with NO unlock cookie and searches the raw HTML
 * for paid-only prose taken from the data files (axis evidence, dossierVerdict,
 * kill-shot titles).
 *
 * This is the regression guard for the SSR leak: props passed to a "use client"
 * component are serialised in full into the RSC flight payload regardless of
 * which fields the component reads, so a visually-correct paywall can still
 * ship the entire dossier in the HTML.
 *
 *   npm run build && node scripts/check-ssr-leak.mjs
 */
import { readFileSync } from "node:fs";
import { spawn } from "node:child_process";
import { createHmac } from "node:crypto";

const PORT = 4590;
const BASE = `http://127.0.0.1:${PORT}`;

const SLUG_BY_FILE = {
  aave: "aave-v4-arc", aerodrome: "aerodrome-slipstream", arctide: "arctide-dex",
  argus: "argus-world", buidl: "blackrock-buidl", cirbtc: "cirbtc", edgex: "edgex-bridge",
  ember: "emberyield-farm", eurc: "eurc-arc", gateway: "circle-gateway", morpho: "morpho-arc",
  synthra: "synthra-v3", tideToken: "tide-token", tolly: "tolly", tollyToken: "tolly-token",
  uniswap: "uniswap-arc", usdc: "circle-usdc", usyc: "usyc", weth: "weth-arc",
};

/** The free one-liner is public by design; exclude it from the paid set. */
function paidStrings(file) {
  const src = readFileSync(`data/${file}.ts`, "utf8");
  const free = (src.match(/(?<![a-zA-Z])verdict:\s*"([^"]{40,})"/) || [])[1];
  const all = [...src.matchAll(/"([A-Z][^"]{110,})"/g)].map((m) => m[1]);
  return {
    dossier: (src.match(/dossierVerdict:\s*"([^"]{40,})"/) || [])[1],
    killShots: [...src.matchAll(/title:\s*"([^"]{25,})"/g)].map((m) => m[1]),
    // The bare `verdict` is deliberately public; drop it from the paid probe.
    prose: all.filter((s) => !free || s.slice(0, 60) !== free.slice(0, 60)),
  };
}

const app = spawn(
  process.execPath,
  ["node_modules/next/dist/bin/next", "start", "-p", String(PORT)],
  {
    env: {
      ...process.env,
      FIDEX_SECRET: "ssr-leak-probe",
      ARCGRADE_SECRET: "ssr-leak-probe",
      FIDEX_PUBLIC_URL: BASE,
      ARCGRADE_PUBLIC_URL: BASE,
    },
    stdio: ["ignore", "ignore", "inherit"],
  },
);

let up = false;
for (let i = 0; i < 90; i++) {
  if (app.exitCode !== null) break;
  try {
    await fetch(`${BASE}/api/v1/grade/cirbtc/summary`);
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

const corpus = Object.keys(SLUG_BY_FILE).map((f) => ({ file: f, ...paidStrings(f) }));

const routes = ["/", "/markets", "/studio", "/arc", "/methodology", "/guide", ...Object.values(SLUG_BY_FILE).map((s) => `/p/${s}`)];

console.log(`\n=== Paid-content leak probe (no unlock cookie) ===\n`);
console.log("route".padEnd(26) + "dossierVerdict  axisProse  killShots");
console.log("-".repeat(66));

let breaches = 0;
for (const route of routes) {
  const html = await (await fetch(BASE + route)).text();
  let d = 0, p = 0, k = 0;
  for (const c of corpus) {
    if (c.dossier && html.includes(c.dossier.slice(0, 80))) d++;
    p += c.prose.filter((s) => html.includes(s.slice(0, 80))).length;
    k += c.killShots.filter((s) => html.includes(s.slice(0, 40))).length;
  }
  const leaked = d + p + k;
  if (leaked) breaches++;
  console.log(
    route.padEnd(26) +
      String(`${d}/${corpus.length}`).padEnd(16) +
      `${p}/${corpus.reduce((s, c) => s + c.prose.length, 0)}`.padEnd(12) +
      `${k}/${corpus.reduce((s, c) => s + c.killShots.length, 0)}` +
      (leaked ? "   <-- LEAK" : ""),
  );
}

console.log(
  breaches === 0
    ? `\nPASS: no paid dossier content in any unauthenticated response (${routes.length} routes).`
    : `\nFAIL: ${breaches}/${routes.length} routes leak paid content.`,
);

/**
 * Two-sided guard. Closing the leak must not mean closing delivery: a buyer who
 * has paid must still receive the dossier in the rendered HTML, or the paywall
 * is just a wall.
 */
const SECRET = "ssr-leak-probe";
const SLUG = "cirbtc";
const c = corpus.find((x) => x.file === "cirbtc");

const receipt = (() => {
  const payload = Buffer.from(
    JSON.stringify({ slug: SLUG, scope: "dossier", exp: Date.now() + 3_600_000, ref: "probe" }),
  ).toString("base64url");
  const sig = createHmac("sha256", SECRET).update(payload).digest("base64url");
  return `${payload}.${sig}`;
})();

const paidHtml = await (
  await fetch(`${BASE}/p/${SLUG}`, {
    headers: { cookie: `fidex_unlock=${receipt}; arcgrade_unlock=${receipt}` },
  })
).text();

const hasDossier = c.dossier ? paidHtml.includes(c.dossier.slice(0, 80)) : false;
const proseHits = c.prose.filter((s) => paidHtml.includes(s.slice(0, 80))).length;
const killHits = c.killShots.filter((s) => paidHtml.includes(s.slice(0, 40))).length;

console.log(`\n=== Paid delivery still works? (/p/${SLUG} with a valid receipt) ===`);
console.log(`  dossierVerdict : ${hasDossier ? "delivered" : "MISSING"}`);
console.log(`  axis prose     : ${proseHits}/${c.prose.length}`);
console.log(`  kill shots     : ${killHits}/${c.killShots.length}`);

const delivers = hasDossier && proseHits > 0;
console.log(
  delivers
    ? `  PASS: paying still delivers the dossier.`
    : `  FAIL: the paywall is now a wall, not a gate.`,
);

app.kill();
process.exit(breaches || !delivers ? 1 : 0);
