import { defineCloudflareConfig } from "@opennextjs/cloudflare";

// Next.js runs in a Cloudflare Worker (wrangler.jsonc). No incremental
// cache: the pages read the session and the database on each request.
const cloudflare = defineCloudflareConfig();

// `pnpm build` stays `next build`, which CI and E2E use; Workers Builds
// runs `pnpm cf:build`, and OpenNext calls `pnpm build` from it.
export default { ...cloudflare, buildCommand: "pnpm build" };
