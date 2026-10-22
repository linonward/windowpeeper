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
