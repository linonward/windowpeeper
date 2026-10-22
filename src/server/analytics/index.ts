import { eq } from "drizzle-orm";
import { user } from "@/server/auth/schema";
import { getDb } from "@/server/db";
import { log } from "@/server/log";
import { initialProperties } from "./first-touch";

type Event = "checkout_started" | "signup_completed" | "generation_started" | "generation_succeeded" | "generation_failed" | "payment_succeeded";
type Properties = {
  kind?: string;
  credits?: number;
  provider?: string;
  product_id?: string;
  payment_kind?: "pack" | "subscription";
  catalogue_amount_minor?: number;
  currency?: string;
  interval?: string;
  // Person properties set only if not set yet: the first touch.
  $set_once?: Record<string, string>;
};

const configured = () =>
  Boolean(process.env.NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN && process.env.NEXT_PUBLIC_POSTHOG_HOST);

// Best effort, awaited so serverless requests keep the send alive. No content,
// email, payment credentials, or raw error messages belong in analytics.
export async function capture(event: Event, userId: string, properties: Properties = {}): Promise<void> {
  const token = process.env.NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN;
  const host = process.env.NEXT_PUBLIC_POSTHOG_HOST;
  if (!token || !host) return;
  try {
    const response = await fetch(`${host.replace(/\/$/, "")}/i/v0/e/`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal: AbortSignal.timeout(1500),
      body: JSON.stringify({
        api_key: token,
        event,
        distinct_id: `windowpeeper:${userId}`,
        timestamp: new Date().toISOString(),
        properties: { ...properties, app: "windowpeeper", $process_person_profile: true, $geoip_disable: true },
      }),
    });
    if (!response.ok) log.warn("analytics.capture_failed", { event, status: response.status });
  } catch {
    log.warn("analytics.capture_failed", { event });
  }
}

// The user's first touch as PostHog's initial person properties, for
// events such as payment_succeeded. Undefined while analytics is off, so
// nothing is read for nothing, and if the lookup fails.
export async function userInitialProperties(userId: string): Promise<Record<string, string> | undefined> {
  if (!configured()) return undefined;
  try {
    const [found] = await getDb()
      .select({
        firstReferrer: user.firstReferrer,
        firstUtmSource: user.firstUtmSource,
        firstUtmMedium: user.firstUtmMedium,
        firstUtmCampaign: user.firstUtmCampaign,
        firstUtmTerm: user.firstUtmTerm,
        firstUtmContent: user.firstUtmContent,
        firstLandingPath: user.firstLandingPath,
        firstLocale: user.firstLocale,
        firstSeenAt: user.firstSeenAt,
      })
      .from(user)
      .where(eq(user.id, userId));
    return initialProperties(found ?? null);
  } catch {
    log.warn("analytics.first_touch_failed", { userId });
    return undefined;
  }
}
