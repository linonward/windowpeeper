import { expect, test } from "@playwright/test";
import { POSTHOG_HOST } from "../playwright.config";
import { getSession, signIn, uniqueEmail } from "./support/auth";
import { firstTouchOf } from "./support/db";

test("links landing visits across reload and magic-link sign-in", async ({ page }) => {
  const events: { event: string; distinct_id: string; properties: Record<string, unknown> }[] = [];
  const host = POSTHOG_HOST;
  await page.route(`${host}/i/v0/e/`, async (route) => {
    events.push(JSON.parse(route.request().postData()!));
    await route.fulfill({ status: 200, body: "{}", headers: { "access-control-allow-origin": "*" } });
  });
  await page.goto("/en");
  await expect.poll(() => events.length).toBe(1);
  const anonymous = events[0].distinct_id;
  await page.reload();
  await expect.poll(() => events.length).toBe(2);
  expect(events[1].distinct_id).toBe(anonymous);
  await signIn(page);
  const session = await getSession(page);
  await expect.poll(() => events.some((event) => event.event === "$identify")).toBe(true);
  expect(events.find((event) => event.event === "$identify")).toMatchObject({
    distinct_id: `windowpeeper:${session.user.id}`, properties: { $anon_distinct_id: anonymous },
  });
  await expect.poll(() => events.some((event) => event.event === "$pageview"
    && event.distinct_id === `windowpeeper:${session.user.id}`)).toBe(true);
});

test("records the first touch on landing and stores it on the account at signup", async ({ page, context }) => {
  const events: { event: string; properties: Record<string, unknown> }[] = [];
  await page.route(`${POSTHOG_HOST}/i/v0/e/`, async (route) => {
    events.push(JSON.parse(route.request().postData()!));
    await route.fulfill({ status: 200, body: "{}", headers: { "access-control-allow-origin": "*" } });
  });
  await page.goto("/en/pricing?utm_source=e2e-source&utm_medium=social&utm_campaign=launch&email=a%40b.c");

  await expect.poll(async () => (await context.cookies()).find((cookie) => cookie.name === "rs_ft")).toBeTruthy();
  const cookie = (await context.cookies()).find((each) => each.name === "rs_ft")!;
  expect(cookie.sameSite).toBe("Lax");
  expect(cookie.value.length).toBeLessThanOrEqual(1024);
  const touch = JSON.parse(decodeURIComponent(cookie.value));
  expect(touch).toMatchObject({
    utm_source: "e2e-source", utm_medium: "social", utm_campaign: "launch", landing_path: "/en/pricing",
  });
  expect(cookie.value).not.toContain("a%2540b.c");
  await expect.poll(() => events.find((event) => event.event === "$pageview")?.properties.$set_once).toMatchObject({
    $initial_utm_source: "e2e-source", $initial_referrer: "$direct", $initial_pathname: "/en/pricing",
  });

  // A later visit with other tags changes nothing.
  await page.goto("/en?utm_source=other");
  const email = uniqueEmail();
  await signIn(page, email);

  expect(await firstTouchOf(email)).toMatchObject({
    first_referrer: null,
    first_utm_source: "e2e-source",
    first_utm_medium: "social",
    first_utm_campaign: "launch",
    first_landing_path: "/en/pricing",
    first_seen_at: expect.any(Date),
  });
});
