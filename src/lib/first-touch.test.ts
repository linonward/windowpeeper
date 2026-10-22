import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { FIRST_TOUCH_COOKIE, initialProperties, readFirstTouch, recordFirstTouch } from "./first-touch";

const now = new Date("2026-10-17T12:00:00Z");
const DAY = 24 * 60 * 60 * 1000;

function visit(url: string, referrer = "", language = "en-US") {
  window.history.replaceState(null, "", url);
  vi.spyOn(document, "referrer", "get").mockReturnValue(referrer);
  vi.spyOn(navigator, "language", "get").mockReturnValue(language);
}

function cookie(): Record<string, string> | null {
  const raw = document.cookie
    .split("; ")
    .find((part) => part.startsWith(`${FIRST_TOUCH_COOKIE}=`))
    ?.slice(FIRST_TOUCH_COOKIE.length + 1);
  return raw ? JSON.parse(decodeURIComponent(raw)) : null;
}

function clearCookie() {
  document.cookie = `${FIRST_TOUCH_COOKIE}=; Path=/; Max-Age=0`;
}

beforeEach(() => {
  localStorage.clear();
  clearCookie();
});
afterEach(() => {
  vi.restoreAllMocks();
  window.history.replaceState(null, "", "/");
});

it("records the first visit's source, UTM tags, landing path, language and time", () => {
  visit(
    "/en/tip-toe-in-my-jordans?utm_source=tiktok&utm_medium=social&utm_campaign=launch&utm_term=tip%20toe&utm_content=clip-1&email=a%40b.c#faq",
    "https://www.google.com/search?q=rumpelstiltskin",
  );

  const touch = recordFirstTouch(now);

  const expected = {
    referrer: "www.google.com/search",
    utm_source: "tiktok",
    utm_medium: "social",
    utm_campaign: "launch",
    utm_term: "tip toe",
    utm_content: "clip-1",
    landing_path: "/en/tip-toe-in-my-jordans",
    locale: "en-US",
    seen_at: now.toISOString(),
  };
  expect(touch).toEqual(expected);
  expect(readFirstTouch(now)).toEqual(expected);
  // The server reads the cookie at signup.
  expect(cookie()).toEqual(expected);
  expect(JSON.stringify(cookie())).not.toContain("a@b.c");
});

it("never overwrites the first touch on later visits", () => {
  visit("/en?utm_source=tiktok", "https://www.tiktok.com/");
  recordFirstTouch(now);

  visit("/en/pricing?utm_source=newsletter", "https://mail.example.com/");
  const later = recordFirstTouch(new Date(now.getTime() + DAY));

  expect(later).toMatchObject({ utm_source: "tiktok", referrer: "www.tiktok.com/", landing_path: "/en" });
  expect(cookie()).toMatchObject({ utm_source: "tiktok" });
});

it("restores a cleared cookie from storage, and storage from the cookie", () => {
  visit("/en?utm_source=tiktok");
  recordFirstTouch(now);

  clearCookie();
  visit("/en?utm_source=other");
  recordFirstTouch(now);
  expect(cookie()).toMatchObject({ utm_source: "tiktok" });

  localStorage.clear();
  recordFirstTouch(now);
  expect(readFirstTouch(now)).toMatchObject({ utm_source: "tiktok" });
});

it("starts over after 90 days", () => {
  visit("/en?utm_source=tiktok");
  recordFirstTouch(now);
  clearCookie();

  visit("/en?utm_source=newsletter");
  expect(recordFirstTouch(new Date(now.getTime() + 91 * DAY))).toMatchObject({ utm_source: "newsletter" });
});

it("treats this site and non-web referrers as direct", () => {
  visit("/en/pricing", `${window.location.origin}/en`);
  expect(recordFirstTouch(now)).not.toHaveProperty("referrer");

  localStorage.clear();
  clearCookie();
  visit("/en", "android-app://com.google.android.gm/");
  expect(recordFirstTouch(now)).not.toHaveProperty("referrer");
});

it("cuts long values so the cookie stays under 1 KB", () => {
  visit(
    `/en/${"p".repeat(500)}?utm_source=${"s".repeat(500)}&utm_campaign=${"活动".repeat(300)}&utm_content=${"c".repeat(500)}`,
    `https://${"r".repeat(60)}.example/${"x".repeat(500)}`,
  );

  const touch = recordFirstTouch(now);

  expect(touch.utm_source).toBe("s".repeat(100));
  expect(touch.landing_path).toHaveLength(200);
  const raw = document.cookie.split("; ").find((part) => part.startsWith(`${FIRST_TOUCH_COOKIE}=`))!;
  expect(raw.length).toBeLessThanOrEqual(1024);
  expect(cookie()).toEqual(touch);
});

it("keeps working when storage is blocked", () => {
  vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
    throw new Error("blocked");
  });
  vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
    throw new Error("blocked");
  });
  visit("/en?utm_source=tiktok");

  expect(recordFirstTouch(now)).toMatchObject({ utm_source: "tiktok" });
  expect(cookie()).toMatchObject({ utm_source: "tiktok" });
});

it("maps the first touch to PostHog's initial person properties", () => {
  expect(
    initialProperties({ referrer: "t.co/x", utm_source: "x", landing_path: "/en", locale: "en", seen_at: now.toISOString() }),
  ).toEqual({
    $initial_referrer: "t.co/x",
    $initial_referring_domain: "t.co",
    $initial_utm_source: "x",
    $initial_pathname: "/en",
    initial_locale: "en",
    initial_seen_at: now.toISOString(),
  });
  expect(initialProperties({ landing_path: "/en", seen_at: now.toISOString() })).toMatchObject({
    $initial_referrer: "$direct",
    $initial_referring_domain: "$direct",
  });
  expect(initialProperties(null)).toBeUndefined();
});
