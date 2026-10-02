import assert from "node:assert";
import { existsSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";

const tmp = path.join(os.tmpdir(), `fidex-watchdog-${Date.now()}`);
const dbPath = path.join(tmp, "nested", "fidex.db");

try {
  rmSync(tmp, { recursive: true, force: true });
} catch {}

const run = spawnSync("node", ["scripts/refresh-telemetry.mjs"], {
  cwd: process.cwd(),
  encoding: "utf8",
  env: {
    ...process.env,
    FIDEX_DB_PATH: dbPath,
    FIDEX_NETWORK: "mainnet",
    FIDEX_RPC: "http://127.0.0.1:1",
  },
});

assert.notStrictEqual(run.status, 0, "watchdog should fail closed when RPC is unreachable");
assert.strictEqual(
  run.stderr.includes("unable to open database file"),
  false,
  "watchdog should create the parent DB directory before opening SQLite",
);
assert.strictEqual(existsSync(dbPath), true, "watchdog should create/open the configured DB path");

try {
  rmSync(tmp, { recursive: true, force: true });
} catch {}

console.log("PASS: watchdog creates DB directory before SQLite open");
