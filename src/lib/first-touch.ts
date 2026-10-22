// A visitor's first touch: where they came from on their first page load.
// Recorded once per browser for FIRST_TOUCH_DAYS, in localStorage and in a
// first-party cookie the server reads when the visitor signs up
// (src/server/analytics/first-touch.ts, which checks it again). Only the
// referrer's host and path, the UTM tags, the landing path, the browser's
// language and the time are kept: no other query, hash or ID.

// Mirrored by src/server/analytics/first-touch.ts.
export const FIRST_TOUCH_COOKIE = "rs_ft";
const STORAGE_KEY = "windowpeeper:first-touch";
const FIRST_TOUCH_DAYS = 90;
const DAY_MS = 24 * 60 * 60 * 1000;
// The cookie, name included, stays under a kilobyte.
const MAX_COOKIE = 1024;
// Longest value kept per field, in characters.
const LIMITS = { referrer: 200, utm: 100, path: 200, locale: 35 };
const UTM_KEYS = ["utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content"] as const;

export type FirstTouch = {
  // Host and path, such as "www.google.com/"; absent for a direct visit.
  referrer?: string;
  utm_source?: string;
  utm_medium?: string;
  utm_campaign?: string;
  utm_term?: string;
  utm_content?: string;
  landing_path: string;
  locale?: string;
  // ISO time of the first visit.
  seen_at: string;
};

const clip = (value: string, max: number) => Array.from(value.trim()).slice(0, max).join("").trim();

// A stored first touch, if it has the right shape and isn't too old.
function valid(value: unknown, now: Date): FirstTouch | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const touch = value as Record<string, unknown>;
  if (Object.values(touch).some((field) => typeof field !== "string")) return null;
  if (typeof touch.landing_path !== "string" || typeof touch.seen_at !== "string") return null;
  const age = now.getTime() - new Date(touch.seen_at).getTime();
  return age >= -DAY_MS && age < FIRST_TOUCH_DAYS * DAY_MS ? (touch as FirstTouch) : null;
}

function fromStorage(now: Date): FirstTouch | null {
  try {
    return valid(JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "null"), now);
  } catch {
    // Storage may be blocked; the cookie still holds it.
    return null;
  }
}

function fromCookie(now: Date): FirstTouch | null {
  const raw = document.cookie
    .split("; ")
    .find((part) => part.startsWith(`${FIRST_TOUCH_COOKIE}=`))
    ?.slice(FIRST_TOUCH_COOKIE.length + 1);
  try {
    return raw ? valid(JSON.parse(decodeURIComponent(raw)), now) : null;
  } catch {
    return null;
  }
}

const encode = (touch: FirstTouch) => encodeURIComponent(JSON.stringify(touch));

// Halves the longest field until the cookie fits.
function fit(touch: FirstTouch): FirstTouch {
  const fitted = { ...touch };
  const room = MAX_COOKIE - FIRST_TOUCH_COOKIE.length - 1;
  while (encode(fitted).length > room) {
    const keys = (Object.keys(fitted) as (keyof FirstTouch)[]).filter((key) => key !== "seen_at");
    const longest = keys.reduce((a, b) => (encodeURIComponent(fitted[a] ?? "").length >= encodeURIComponent(fitted[b] ?? "").length ? a : b));
    const value = Array.from(fitted[longest] ?? "");
    fitted[longest] = value.slice(0, Math.floor(value.length / 2)).join("");
  }
  return fitted;
}

function referrer(): string | undefined {
  const url = URL.parse(document.referrer);
  // Another page of this site, or an app's referrer, is a direct visit.
  if (!url || !/^https?:$/.test(url.protocol) || url.host === window.location.host) return undefined;
  return clip(`${url.host.toLowerCase()}${url.pathname}`, LIMITS.referrer) || undefined;
}

function current(now: Date): FirstTouch {
  const params = new URLSearchParams(window.location.search);
  const touch: FirstTouch = {
    referrer: referrer(),
    landing_path: clip(window.location.pathname, LIMITS.path) || "/",
    locale: clip(navigator.language ?? "", LIMITS.locale) || undefined,
    seen_at: now.toISOString(),
  };
  for (const key of UTM_KEYS) touch[key] = clip(params.get(key) ?? "", LIMITS.utm) || undefined;
  // JSON drops the undefined fields, so the object matches what is stored.
  return fit(JSON.parse(JSON.stringify(touch)));
}

// This page load's UTM tags and referring site, for its landing page view:
// the five utm_ tags and the referrer's host and path, nothing else.
// Empty for a direct visit without tags.
export function landingProperties(): Record<string, string> {
  const params = new URLSearchParams(window.location.search);
  const properties: Record<string, string> = {};
  for (const key of UTM_KEYS) {
    const value = clip(params.get(key) ?? "", LIMITS.utm);
    if (value) properties[key] = value;
  }
  const from = referrer();
  if (from) {
    properties.$referrer = `https://${from}`;
    properties.$referring_domain = from.split("/")[0];
  }
  return properties;
}

// The first touch this browser recorded, if any.
export function readFirstTouch(now = new Date()): FirstTouch | null {
  return fromStorage(now) ?? fromCookie(now);
}

// Records this visit as the first touch unless one is already recorded,
// and puts it back in storage or the cookie if either was cleared. Returns
// the first touch.
export function recordFirstTouch(now = new Date()): FirstTouch {
  const stored = fromStorage(now);
  const cookie = fromCookie(now);
  const touch = stored ?? cookie ?? current(now);
  if (!stored) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(touch));
    } catch {
      // The cookie alone will do.
    }
  }
  if (!cookie) {
    const left = Math.round((new Date(touch.seen_at).getTime() + FIRST_TOUCH_DAYS * DAY_MS - now.getTime()) / 1000);
    const secure = window.location.protocol === "https:" ? "; Secure" : "";
    document.cookie = `${FIRST_TOUCH_COOKIE}=${encode(touch)}; Path=/; Max-Age=${left}; SameSite=Lax${secure}`;
  }
  return touch;
}

// PostHog's initial person properties, sent with $set_once so the first
// value wins. Mirrors initialProperties in src/server/analytics/first-touch.ts.
export function initialProperties(touch: FirstTouch | null): Record<string, string> | undefined {
  if (!touch) return undefined;
  const properties: Record<string, string> = {
    $initial_referrer: touch.referrer ?? "$direct",
    $initial_referring_domain: touch.referrer?.split("/")[0] ?? "$direct",
  };
  for (const key of UTM_KEYS) {
    const value = touch[key];
    if (value) properties[`$initial_${key}`] = value;
  }
  properties.$initial_pathname = touch.landing_path;
  if (touch.locale) properties.initial_locale = touch.locale;
  properties.initial_seen_at = touch.seen_at;
  return properties;
}
