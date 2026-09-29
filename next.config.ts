import type { NextConfig } from "next";
import path from "node:path";

const nextConfig: NextConfig = {
  /**
   * Pin the Turbopack root to this project.
   *
   * Without it Next.js walks up looking for a workspace root and can adopt a
   * `package-lock.json` that belongs to an unrelated parent directory, which
   * it then ignores while warning on every build. Pinning the root keeps the
   * build hermetic and the lockfile authoritative.
   */
  turbopack: {
    root: path.resolve(process.cwd()),
  },
  serverExternalPackages: ["@libsql/client"],
};

export default nextConfig;
