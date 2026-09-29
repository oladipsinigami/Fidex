/**
 * The single source of truth for Fidex's public origin.
 *
 * This exists because the origin was previously hardcoded to
 * `https://arcgrade.xyz` in at least seven places, including the x402
 * challenge. That host does not resolve, so every 402 advertised an unpayable
 * resource and the agent-facing docs pointed buyers at a dead endpoint.
 *
 * It lives in its own module rather than in `lib/x402.ts` because that file
 * imports a server-only facilitator client; importing it into a client
 * component would pull the facilitator into the browser bundle.
 *
 * Client components can only read `NEXT_PUBLIC_*`, so the public-prefixed name
 * takes precedence there. The server sees both.
 */
const vercelHost =
  process.env.NEXT_PUBLIC_VERCEL_PROJECT_PRODUCTION_URL ??
  process.env.VERCEL_PROJECT_PRODUCTION_URL ??
  process.env.NEXT_PUBLIC_VERCEL_URL ??
  process.env.VERCEL_URL;

const vercelOrigin = vercelHost
  ? vercelHost.startsWith("http")
    ? vercelHost
    : `https://${vercelHost}`
  : undefined;

const RAW =
  process.env.NEXT_PUBLIC_FIDEX_URL ??
  process.env.FIDEX_PUBLIC_URL ??
  process.env.NEXT_PUBLIC_ARCGRADE_URL ??
  process.env.ARCGRADE_PUBLIC_URL ??
  vercelOrigin ??
  "http://localhost:3000";

/** Public origin, never with a trailing slash. */
export const SITE_URL = RAW.replace(/\/+$/, "");

/** Join a path onto the public origin. */
export function siteUrl(path: string): string {
  return `${SITE_URL}${path.startsWith("/") ? path : `/${path}`}`;
}

/**
 * True while `next build` is running.
 *
 * `next build` sets NODE_ENV=production, so any "required in production"
 * guard that throws at module load also fires during page-data collection --
 * which breaks the build itself, on CI and on Vercel, where the runtime
 * variables are not necessarily present in the build environment.
 *
 * These guards exist to catch a misconfigured *deployment* at boot. A build is
 * not a deployment, so the guards stand down here and still fail hard on the
 * first real request.
 */
export const IS_BUILD_PHASE = process.env.NEXT_PHASE === "phase-production-build";
