import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";

// Determine forge binary
let forgeCmd = "forge";
const winForge = join(homedir(), ".foundry", "bin", "forge.exe");
const nixForge = join(homedir(), ".foundry", "bin", "forge");

if (process.platform === "win32" && existsSync(winForge)) {
  forgeCmd = winForge;
} else if (existsSync(nixForge)) {
  forgeCmd = nixForge;
}

const args = ["test", "--root", "contracts", ...process.argv.slice(2)];

const child = spawn(forgeCmd, args, {
  stdio: "inherit",
  shell: false,
});

child.on("exit", (code) => {
  process.exit(code ?? 0);
});
