/**
 * The single source of truth for ArcGrade's public origin.
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
const RAW =
  process.env.NEXT_PUBLIC_ARCGRADE_URL ?? process.env.ARCGRADE_PUBLIC_URL ?? "http://localhost:3000";

/** Public origin, never with a trailing slash. */
export const SITE_URL = RAW.replace(/\/+$/, "");

/** Join a path onto the public origin. */
export function siteUrl(path: string): string {
  return `${SITE_URL}${path.startsWith("/") ? path : `/${path}`}`;
}
