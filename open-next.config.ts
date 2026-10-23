import { defineCloudflareConfig } from "@opennextjs/cloudflare";
import staticAssetsIncrementalCache from "@opennextjs/cloudflare/overrides/incremental-cache/static-assets-incremental-cache";

// Next.js runs in a Worker (wrangler.jsonc). Prerendered pages are read
// from the Worker's static assets: `pnpm cf:build` copies them there
// (populateCache), as Workers Builds deploys with `wrangler deploy`. The
// cache is read-only, so pages never revalidate; a deploy updates them.
const cloudflare = defineCloudflareConfig({ incrementalCache: staticAssetsIncrementalCache });

// `pnpm build` stays `next build`, which CI and E2E use; Workers Builds
// runs `pnpm cf:build`, and OpenNext calls `pnpm build` from it.
const config = { ...cloudflare, buildCommand: "pnpm build" };

export default config;
