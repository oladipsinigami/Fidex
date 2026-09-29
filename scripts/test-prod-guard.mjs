/**
 * The production guards must fail at RUNTIME, never at BUILD.
 *
 * `next build` sets NODE_ENV=production. Any "required in production" guard
 * that throws at module load therefore fires while Next collects page data,
 * which breaks the build itself rather than catching a bad deployment. That is
 * not hypothetical: it broke CI and would have broken the Vercel build, because
 * runtime env vars are not necessarily present in the build environment.
 *
 * So this asserts both halves of the contract:
 *   A. `next build` succeeds with no secret and no public URL.
 *   B. `next start` with no secret and no public URL refuses requests loudly.
 *   C. `next start` correctly configured serves the 402 paywall.
 */
import { spawn, spawnSync } from "node:child_process";
import { rmSync } from "node:fs";

const PORT = Number(process.env.PORT ?? 4583);
const BASE = `http://127.0.0.1:${PORT}`;

const SECRET_KEYS = [
  "FIDEX_SECRET", "ARCGRADE_SECRET",
  "FIDEX_PUBLIC_URL", "ARCGRADE_PUBLIC_URL",
  "NEXT_PUBLIC_FIDEX_URL", "NEXT_PUBLIC_ARCGRADE_URL",
  "VERCEL_PROJECT_PRODUCTION_URL", "VERCEL_URL",
];

const cleanEnv = (extra = {}) => {
  const e = { ...process.env, ...extra };
  for (const k of SECRET_KEYS) if (!(k in extra)) delete e[k];
  return e;
};

let failed = 0;
const check = (name, pass, detail = "") => {
  if (!pass) failed++;
  console.log(`${pass ? "PASS" : "FAIL"}  ${name}${detail ? " :: " + detail : ""}`);
};

console.log("\n=== Production guard: build vs runtime ===\n");

// --- A. the build must not require runtime configuration --------------------
rmSync(".next", { recursive: true, force: true });
const build = spawnSync(process.execPath, ["node_modules/next/dist/bin/next", "build"], {
  env: cleanEnv(),
  encoding: "utf8",
  shell: false,
});
const out = `${build.stdout ?? ""}${build.stderr ?? ""}`;
check(
  "next build succeeds with no secret and no public URL",
  build.status === 0,
  build.status === 0 ? "" : (out.match(/\[Fidex FATAL\][^\n]*/) || ["build failed"])[0].slice(0, 90),
);

// --- B and C. runtime behaviour ---------------------------------------------
async function probe(extra) {
  const app = spawn(process.execPath, ["node_modules/next/dist/bin/next", "start", "-p", String(PORT)], {
    env: cleanEnv(extra),
    stdio: ["ignore", "ignore", "pipe"],
  });
  let stderr = "";
  app.stderr.on("data", (d) => (stderr += d));
  let up = false;
  for (let i = 0; i < 60; i++) {
    if (app.exitCode !== null) break;
    try {
      await fetch(`${BASE}/api/v1/grade/cirbtc/summary`);
      up = true;
      break;
    } catch {
      await new Promise((r) => setTimeout(r, 500));
    }
  }
  let status = 0;
  if (up) status = (await fetch(`${BASE}/api/v1/grade/cirbtc`)).status;
  app.kill();
  await new Promise((r) => setTimeout(r, 700));
  return { up, status, stderr };
}

const none = await probe({});
check(
  "misconfigured production refuses the paid request with a clear cause",
  !none.up || none.status >= 500,
  `status=${none.status}`,
);
check(
  "the refusal names FIDEX_PUBLIC_URL",
  /FIDEX_PUBLIC_URL/.test(none.stderr),
  (none.stderr.match(/\[Fidex FATAL\][^\n]*/) || ["no FATAL line captured"])[0].slice(0, 80),
);

const urlOnly = await probe({ FIDEX_PUBLIC_URL: BASE });
check(
  "a missing receipt secret is still fatal at runtime",
  !urlOnly.up || urlOnly.status >= 500,
  `status=${urlOnly.status}`,
);

const good = await probe({ FIDEX_SECRET: "prod-guard-probe", FIDEX_PUBLIC_URL: BASE });
check(
  "correctly configured production serves the 402 paywall",
  good.status === 402,
  `status=${good.status}`,
);

console.log(`\n${failed === 0 ? "PASS" : "FAIL"}: ${4 - failed}/4 checks`);
process.exitCode = failed ? 1 : 0;
