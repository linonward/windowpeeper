import { expect, it } from "vitest";
import { FIRST_TOUCH_COOKIE, initialProperties, readFirstTouch } from "./first-touch";

const now = new Date("2026-10-17T12:00:00Z");
const cookie = (value: unknown, name = FIRST_TOUCH_COOKIE) =>
  `theme=dark; ${name}=${encodeURIComponent(JSON.stringify(value))}; other=1`;
const visit = {
  referrer: "www.google.com/",
  utm_source: "tiktok",
  utm_medium: "social",
  utm_campaign: "launch",
  utm_term: "window peeper",
  utm_content: "clip-1",
  landing_path: "/en/how-to-make-window-peeper-video",
  locale: "en-US",
  seen_at: "2026-10-01T08:00:00.000Z",
};

it("reads the first-touch cookie into user columns", () => {
  expect(readFirstTouch(cookie(visit), now)).toEqual({
    firstReferrer: "www.google.com/",
    firstUtmSource: "tiktok",
    firstUtmMedium: "social",
    firstUtmCampaign: "launch",
    firstUtmTerm: "window peeper",
    firstUtmContent: "clip-1",
    firstLandingPath: "/en/how-to-make-window-peeper-video",
    firstLocale: "en-US",
    firstSeenAt: new Date("2026-10-01T08:00:00.000Z"),
  });
});

it("returns null without the cookie, or when it isn't JSON", () => {
  expect(readFirstTouch(null, now)).toBeNull();
  expect(readFirstTouch("theme=dark", now)).toBeNull();
  expect(readFirstTouch(`${FIRST_TOUCH_COOKIE}=%7Bnot-json`, now)).toBeNull();
  expect(readFirstTouch(cookie(["a"]), now)).toBeNull();
  expect(readFirstTouch(cookie({}), now)).toBeNull();
});

it("sanitizes what the browser sent", () => {
  const read = readFirstTouch(
    cookie({
      referrer: "evil.example/path?email=a@b.c#x",
      utm_source: `  ${"s".repeat(300)}\u0000 `,
      utm_medium: 42,
      landing_path: "https://elsewhere.example/",
      locale: "en-US<script>",
      seen_at: "2030-01-01T00:00:00Z",
    }),
    now,
  );
  expect(read).toMatchObject({
    firstReferrer: "evil.example/path",
    firstUtmMedium: null,
    firstLandingPath: null,
    firstLocale: null,
    // A time in the future is the browser's clock, not a visit.
    firstSeenAt: null,
  });
  expect(read?.firstUtmSource).toBe("s".repeat(100));
});

it("drops a referrer whose host isn't a host name", () => {
  expect(readFirstTouch(cookie({ ...visit, referrer: "javascript:alert(1)//" }), now)?.firstReferrer).toBeNull();
});

it("maps first touch to PostHog's initial person properties", () => {
  const touch = readFirstTouch(cookie(visit), now)!;
  expect(initialProperties(touch)).toEqual({
    $initial_referrer: "www.google.com/",
    $initial_referring_domain: "www.google.com",
    $initial_utm_source: "tiktok",
    $initial_utm_medium: "social",
    $initial_utm_campaign: "launch",
    $initial_utm_term: "window peeper",
    $initial_utm_content: "clip-1",
    $initial_pathname: "/en/how-to-make-window-peeper-video",
    initial_locale: "en-US",
    initial_seen_at: "2026-10-01T08:00:00.000Z",
  });
  const direct = readFirstTouch(cookie({ landing_path: "/en", seen_at: visit.seen_at }), now)!;
  expect(initialProperties(direct)).toEqual({
    $initial_referrer: "$direct",
    $initial_referring_domain: "$direct",
    $initial_pathname: "/en",
    initial_seen_at: "2026-10-01T08:00:00.000Z",
  });
});

it("sets no initial properties for a user without a first touch", () => {
  expect(initialProperties(null)).toBeUndefined();
  expect(
    initialProperties({
      firstReferrer: null, firstUtmSource: null, firstUtmMedium: null, firstUtmCampaign: null, firstUtmTerm: null,
      firstUtmContent: null, firstLandingPath: null, firstLocale: null, firstSeenAt: null,
    }),
  ).toBeUndefined();
});
