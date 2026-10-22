// A visitor's first touch: where they came from on their first page load.
// The browser records it once (src/lib/first-touch.ts) in the rs_ft cookie;
// signing up copies it onto the user row. The cookie is the visitor's own
// input, so everything here is checked again.

// Mirrors src/lib/first-touch.ts, which the server may not import.
export const FIRST_TOUCH_COOKIE = "rs_ft";

// Longest value kept per field, in characters.
const LIMITS = { referrer: 200, utm: 100, path: 200, locale: 35 };
const UTM_KEYS = ["utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content"] as const;
// Clock skew a first visit may be "in the future" by.
const SKEW_MS = 5 * 60 * 1000;

export type FirstTouch = {
  // Host and path, without query or hash, such as "www.google.com/".
  firstReferrer: string | null;
  firstUtmSource: string | null;
  firstUtmMedium: string | null;
  firstUtmCampaign: string | null;
  firstUtmTerm: string | null;
  firstUtmContent: string | null;
  // Path only, such as "/en/how-to-make-window-peeper-video".
  firstLandingPath: string | null;
  // The browser's language, such as "en-US".
  firstLocale: string | null;
  firstSeenAt: Date | null;
};

const COLUMNS = {
  utm_source: "firstUtmSource",
  utm_medium: "firstUtmMedium",
  utm_campaign: "firstUtmCampaign",
  utm_term: "firstUtmTerm",
  utm_content: "firstUtmContent",
} as const satisfies Record<(typeof UTM_KEYS)[number], keyof FirstTouch>;

// Trimmed, without control characters, cut to `max`. Null if empty.
function text(value: unknown, max: number): string | null {
  if (typeof value !== "string") return null;
  const clean = value.replace(/[\u0000-\u001f\u007f]/g, "").trim().slice(0, max).trim();
  return clean || null;
}

function referrer(value: unknown): string | null {
  const clean = text(value, LIMITS.referrer)?.split(/[?#]/)[0];
  return clean && /^[a-z0-9.-]+(:\d+)?(\/.*)?$/i.test(clean) ? clean.toLowerCase() : null;
}

function seenAt(value: unknown, now: Date): Date | null {
  if (typeof value !== "string") return null;
  const date = new Date(value);
  const time = date.getTime();
  return Number.isNaN(time) || time > now.getTime() + SKEW_MS ? null : date;
}

function cookieValue(header: string, name: string): string | null {
  for (const part of header.split(";")) {
    const [key, ...rest] = part.trim().split("=");
    if (key === name) return rest.join("=");
  }
  return null;
}

// The first touch in a Cookie header, sanitized. Null without the cookie,
// or if it holds nothing usable.
export function readFirstTouch(header: string | null | undefined, now = new Date()): FirstTouch | null {
  const raw = header && cookieValue(header, FIRST_TOUCH_COOKIE);
  if (!raw) return null;
  let value: unknown;
  try {
    value = JSON.parse(decodeURIComponent(raw));
  } catch {
    return null;
  }
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const input = value as Record<string, unknown>;
  const path = text(input.landing_path, LIMITS.path);
  const locale = text(input.locale, LIMITS.locale);
  const touch: FirstTouch = {
    firstReferrer: referrer(input.referrer),
    firstUtmSource: null,
    firstUtmMedium: null,
    firstUtmCampaign: null,
    firstUtmTerm: null,
    firstUtmContent: null,
    firstLandingPath: path?.startsWith("/") && !path.startsWith("//") ? path : null,
    firstLocale: locale && /^[a-z]{2,8}(-[a-z0-9]{1,8})*$/i.test(locale) ? locale : null,
    firstSeenAt: seenAt(input.seen_at, now),
  };
  for (const key of UTM_KEYS) touch[COLUMNS[key]] = text(input[key], LIMITS.utm);
  return Object.values(touch).some((field) => field !== null) ? touch : null;
}

// PostHog's initial person properties, sent with $set_once so the first
// value wins. Undefined for a user without a first touch, so nothing claims
// such a user came "direct".
export function initialProperties(touch: FirstTouch | null): Record<string, string> | undefined {
  if (!touch || Object.values(touch).every((field) => field === null)) return undefined;
  const properties: Record<string, string> = {
    $initial_referrer: touch.firstReferrer ?? "$direct",
    $initial_referring_domain: touch.firstReferrer?.split("/")[0] ?? "$direct",
  };
  for (const key of UTM_KEYS) {
    const value = touch[COLUMNS[key]];
    if (value) properties[`$initial_${key}`] = value;
  }
  if (touch.firstLandingPath) properties.$initial_pathname = touch.firstLandingPath;
  if (touch.firstLocale) properties.initial_locale = touch.firstLocale;
  if (touch.firstSeenAt) properties.initial_seen_at = touch.firstSeenAt.toISOString();
  return properties;
}
