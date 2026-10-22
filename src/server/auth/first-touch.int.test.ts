import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { afterEach, expect, test, vi } from "vitest";
import { getDb } from "@/server/db";
import type { Email } from "@/server/email/client";
import { user } from "./schema";

const { sendEmail } = vi.hoisted(() => ({ sendEmail: vi.fn<(email: Email) => Promise<void>>(async () => {}) }));
vi.mock("@/server/email/client", () => ({ sendEmail }));
const { auth } = await import("./index");

const BASE = process.env.BETTER_AUTH_URL ?? "http://localhost:3000";
const cleanup: string[] = [];

afterEach(async () => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.clearAllMocks();
  const ctx = await auth.$context;
  for (const id of cleanup.splice(0)) await ctx.internalAdapter.deleteUser(id);
});

const firstTouch = {
  referrer: "www.google.com/",
  utm_source: "tiktok",
  utm_medium: "social",
  utm_campaign: "launch",
  landing_path: "/en/how-to-make-window-peeper-video",
  locale: "en-US",
  seen_at: "2026-10-01T08:00:00.000Z",
};

// Signs up through the magic link, opening it with these cookies, as the
// browser would. Returns the new user's row.
async function signUp(cookie?: string) {
  const email = `first-touch-${randomUUID()}@example.com`;
  const request = await auth.handler(
    new Request(`${BASE}/api/auth/sign-in/magic-link`, {
      method: "POST",
      headers: { "content-type": "application/json", origin: BASE },
      body: JSON.stringify({ email, callbackURL: "/en" }),
    }),
  );
  expect(request.status).toBe(200);
  // The email opens the confirm page; its button sends the same query to
  // the verify endpoint.
  const link = new URL(sendEmail.mock.calls.at(-1)![0].text.match(/https?:\/\/\S+/)![0]);
  expect(link.pathname).toBe("/sign-in/confirm");
  const verify = `${BASE}/api/auth/magic-link/verify${link.search}`;
  const verified = await auth.handler(new Request(verify, { headers: cookie ? { cookie } : {} }));
  expect(verified.status).toBe(302);
  const [row] = await getDb().select().from(user).where(eq(user.email, email));
  cleanup.push(row.id);
  return { row, session: verified.headers.getSetCookie().join("; ") };
}

test("signing up stores the visitor's first touch on the user", async () => {
  const { row } = await signUp(`theme=dark; rs_ft=${encodeURIComponent(JSON.stringify(firstTouch))}`);

  expect(row).toMatchObject({
    firstReferrer: "www.google.com/",
    firstUtmSource: "tiktok",
    firstUtmMedium: "social",
    firstUtmCampaign: "launch",
    firstUtmTerm: null,
    firstUtmContent: null,
    firstLandingPath: "/en/how-to-make-window-peeper-video",
    firstLocale: "en-US",
    firstSeenAt: new Date("2026-10-01T08:00:00.000Z"),
  });
});

test("signing up without the cookie leaves the first touch empty", async () => {
  const { row } = await signUp();

  expect(row).toMatchObject({ firstReferrer: null, firstUtmSource: null, firstLandingPath: null, firstSeenAt: null });
});

test("the session never returns the first touch to the browser", async () => {
  const { session } = await signUp(`rs_ft=${encodeURIComponent(JSON.stringify(firstTouch))}`);
  const cookies = session
    .split("; ")
    .filter((part) => part.startsWith("better-auth."))
    .join("; ");

  const response = await auth.handler(new Request(`${BASE}/api/auth/get-session`, { headers: { cookie: cookies } }));
  const body = await response.json();

  expect(body.user.email).toMatch(/^first-touch-/);
  expect(JSON.stringify(body)).not.toContain("tiktok");
});

test("signup_completed sets the first touch once on the PostHog person", async () => {
  vi.stubEnv("NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN", "phc_test");
  vi.stubEnv("NEXT_PUBLIC_POSTHOG_HOST", "https://posthog.test");
  const fetcher = vi.fn(async () => new Response("{}"));
  vi.stubGlobal("fetch", fetcher);

  await signUp(`rs_ft=${encodeURIComponent(JSON.stringify(firstTouch))}`);

  const events = fetcher.mock.calls.map((call) => JSON.parse((call as unknown as [string, RequestInit])[1].body as string));
  expect(events.find((event) => event.event === "signup_completed")).toMatchObject({
    properties: {
      app: "windowpeeper",
      $set_once: {
        $initial_referrer: "www.google.com/",
        $initial_referring_domain: "www.google.com",
        $initial_utm_source: "tiktok",
        $initial_utm_campaign: "launch",
        $initial_pathname: "/en/how-to-make-window-peeper-video",
      },
    },
  });
});
