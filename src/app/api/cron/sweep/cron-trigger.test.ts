// @vitest-environment node
import { existsSync, readFileSync } from "node:fs";
import { expect, test } from "vitest";
import { sweepRequest } from "@/server/cron/scheduled";

// wrangler.jsonc schedules the sweep on Cloudflare Workers. Keep it as often
// as docs/runbook.md says, and pointed at a route that exists.
const root = new URL("../../../../../", import.meta.url);
const wrangler = readFileSync(new URL("wrangler.jsonc", root), "utf8");

test("the Cron Trigger calls the sweep route every 10 minutes", () => {
  expect(wrangler).toMatch(/"triggers":\s*\{\s*"crons":\s*\["\*\/10 \* \* \* \*"\]\s*\}/);
  const { pathname } = new URL(sweepRequest({ BETTER_AUTH_URL: "https://example.test", CRON_SECRET: "s".repeat(32) })!.url);
  expect(existsSync(new URL(`src/app${pathname}/route.ts`, root))).toBe(true);
});
