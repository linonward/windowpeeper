// @vitest-environment node
import { readFileSync } from "node:fs";
import { expect, test } from "vitest";

// CI runs E2E in the Playwright image, which has the browsers and their
// system packages; installing them with apt took up to 9 minutes. The
// image's browsers fit only the same Playwright version.
const root = new URL("../../", import.meta.url);
const read = (path: string) => readFileSync(new URL(path, root), "utf8");

test("CI's E2E image matches the installed Playwright version", () => {
  const { version } = JSON.parse(read("node_modules/@playwright/test/package.json")) as { version: string };
  const image = read(".github/workflows/ci.yml").match(/mcr\.microsoft\.com\/playwright:v([\d.]+)-/)?.[1];

  expect(image).toBe(version);
});

test("CI doesn't install browsers with apt", () => {
  expect(read(".github/workflows/ci.yml")).not.toContain("playwright install");
});

// Workers Builds deploys the `production` branch (docs/runbook.md), which
// CI moves to a `main` commit only after every other job passed.
test("CI promotes main to production only after every check passes", () => {
  const ci = read(".github/workflows/ci.yml");
  const jobs = [...ci.split(/^jobs:$/m)[1].matchAll(/^  ([a-z0-9-]+):$/gm)].map(([, name]) => name).filter((name) => name !== "promote");
  const promote = ci.split(/^  promote:$/m)[1] ?? "";

  expect(promote.match(/needs: \[(.*)\]/)?.[1].split(", ").sort()).toEqual(jobs.sort());
  expect(promote).toContain('git push origin "$GITHUB_SHA:refs/heads/production"');
  expect(promote).toContain("github.ref == 'refs/heads/main'");
});
