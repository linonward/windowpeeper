// Product analytics in the browser: one sender to PostHog's capture API for
// page views (src/components/layout/posthog.tsx) and funnel events
// (`track`). Off unless both NEXT_PUBLIC_POSTHOG_* variables are set at
// build time. Requests omit cookies; events carry no content, file names,
// emails or raw errors.
import { initialProperties, readFirstTouch } from "./first-touch";

// The funnel's browser steps. Properties carry choices, never content;
// `surface` says where the step happened.
export type FunnelEvent =
  | "sign_in_started"
  | "photo_selected"
  | "generate_clicked"
  | "paywall_viewed"
  | "checkout_clicked"
  | "video_downloaded"
  | "video_shared";
export type Surface = "home" | "dashboard" | "pricing" | "packs" | "billing" | "buy_dialog";
export type FunnelProperties = { surface?: Surface } & Record<string, string | number>;

const STORAGE_KEY = "windowpeeper:analytics";
const MAX_AGE = 30 * 24 * 60 * 60 * 1000;
export type Identity = { anonymous: string; userId: string | null; expires: number };

// Literal reads, so Next.js inlines them at build time.
function config() {
  const token = process.env.NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN;
  const host = process.env.NEXT_PUBLIC_POSTHOG_HOST;
  return token && host ? { token, host: host.replace(/\/$/, "") } : null;
}

export const analyticsEnabled = () => config() !== null;

// The identity when storage is blocked: kept for this page's life.
let memory: Identity | null = null;

function readIdentity(): Identity | null {
  try {
    const value = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "null");
    if (value && /^windowpeeper:anonymous:[0-9a-f-]{36}$/.test(value.anonymous)
      && (value.userId === null || typeof value.userId === "string")
      && value.expires > Date.now() && value.expires <= Date.now() + MAX_AGE) return value;
  } catch { /* Storage may be blocked. Keep this visit in memory instead. */ }
  return null;
}

function saveIdentity(identity: Identity) {
  memory = identity;
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(identity)); } catch { /* In-memory fallback. */ }
}

const newIdentity = (): Identity => ({
  anonymous: `windowpeeper:anonymous:${crypto.randomUUID()}`, userId: null, expires: Date.now() + MAX_AGE,
});

// The identity for the signed-in account (or none), once the session is
// known. Re-reads shared storage so another tab's logout or account switch
// is seen; logout or a switch rotates the anonymous ID, so two accounts are
// never merged.
export function resolveIdentity(userId: string | null): Identity {
  let current = readIdentity() ?? memory;
  if (!current || current.expires <= Date.now() || (current.userId !== null && current.userId !== userId)) {
    current = newIdentity();
  }
  current.userId = userId;
  saveIdentity(current);
  return current;
}

export const distinctIdOf = (identity: Identity) =>
  identity.userId ? `windowpeeper:${identity.userId}` : identity.anonymous;

// Sends one event as `identity`. Every event carries app=windowpeeper
// (the PostHog project is shared) and the first touch as $set_once.
export function send(event: string, identity: Identity, properties: Record<string, unknown>): Promise<Response> {
  const settings = config();
  if (!settings) return Promise.resolve(new Response(null, { status: 204 }));
  const setOnce = initialProperties(readFirstTouch());
  return fetch(`${settings.host}/i/v0/e/`, {
    method: "POST", credentials: "omit", referrerPolicy: "no-referrer", keepalive: true,
    headers: { "Content-Type": "text/plain" },
    body: JSON.stringify({
      api_key: settings.token, event, distinct_id: distinctIdOf(identity), timestamp: new Date().toISOString(),
      properties: {
        app: "windowpeeper", $process_person_profile: Boolean(identity.userId), $geoip_disable: true,
        ...(setOnce && { $set_once: setOnce }), ...properties,
      },
    }),
  });
}

// Records one funnel step, as whoever the page views last identified (or
// a new anonymous visitor). Call it from the handler of the action itself,
// so it fires once per action. Does nothing while analytics is off.
export function track(event: FunnelEvent, properties: FunnelProperties = {}): void {
  if (!config()) return;
  let identity = readIdentity() ?? memory;
  if (!identity || identity.expires <= Date.now()) {
    identity = newIdentity();
    saveIdentity(identity);
  }
  void send(event, identity, properties).catch(() => {});
}
