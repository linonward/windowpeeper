import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { afterEach, expect, test, vi } from "vitest";
import { auth } from "@/server/auth";
import { user } from "@/server/auth/schema";
import { getDb } from "@/server/db";
import { userInitialProperties } from "./index";

const cleanup: string[] = [];

afterEach(async () => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  const ctx = await auth.$context;
  for (const id of cleanup.splice(0)) await ctx.internalAdapter.deleteUser(id);
});

async function createUser(touch: Partial<typeof user.$inferInsert> = {}) {
  const ctx = await auth.$context;
  const created = await ctx.internalAdapter.createUser(
    { email: `analytics-${randomUUID()}@example.com`, name: "Analytics" },
    { method: "admin" },
  );
  cleanup.push(created.id);
  if (Object.keys(touch).length > 0) await getDb().update(user).set(touch).where(eq(user.id, created.id));
  return created.id;
}

test("reads a user's first touch as initial person properties", async () => {
  vi.stubEnv("NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN", "phc_test");
  vi.stubEnv("NEXT_PUBLIC_POSTHOG_HOST", "https://posthog.test");
  // Creating the users captures signup_completed.
  vi.stubGlobal("fetch", vi.fn(async () => new Response("{}")));
  const id = await createUser({ firstReferrer: "t.co/abc", firstUtmSource: "x", firstLandingPath: "/en" });
  const none = await createUser();

  expect(await userInitialProperties(id)).toEqual({
    $initial_referrer: "t.co/abc",
    $initial_referring_domain: "t.co",
    $initial_utm_source: "x",
    $initial_pathname: "/en",
  });
  expect(await userInitialProperties(none)).toBeUndefined();
});

test("reads nothing while analytics is off", async () => {
  vi.stubEnv("NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN", "");
  const id = await createUser({ firstUtmSource: "x" });

  expect(await userInitialProperties(id)).toBeUndefined();
});
