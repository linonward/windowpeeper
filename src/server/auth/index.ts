import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { APIError } from "better-auth/api";
import { magicLink } from "better-auth/plugins";
import { capture } from "@/server/analytics";
import { initialProperties, readFirstTouch } from "@/server/analytics/first-touch";
import { afterDeleteUser, beforeDeleteUser, LiveSubscriptionError } from "@/server/account";
import { grantCredits } from "@/server/credits";
import { signupCredits } from "@/server/credits/config";
import { getDb } from "@/server/db";
import * as schema from "@/server/db/schema";
import { sendEmail } from "@/server/email/client";
import { magicLinkEmail } from "@/server/email/templates/magic-link";
import { confirmLink } from "./magic-link";
import { captchaPlugins } from "./captcha";
import { ipAddressHeaders } from "./client-ip";
import { socialProviders } from "./social-providers";

function firstTouchField(type: "string" | "date") {
  return { type, required: false, input: false, returned: false } as const;
}

// The first touch in the cookies of the request creating the user.
function firstTouchFrom(context: { headers?: Headers; request?: Request } | null) {
  return readFirstTouch(context?.headers?.get("cookie") ?? context?.request?.headers.get("cookie"));
}

export const auth = betterAuth({
  database: drizzleAdapter(getDb(), { provider: "pg", schema }),
  socialProviders: socialProviders(),
  // On by default in production only. The database shares the counters
  // between server instances; memory would give each its own. The
  // magic-link plugin allows 5 requests a minute per IP.
  rateLimit: { storage: "database" },
  advanced: {
    ipAddress: { ipAddressHeaders: ipAddressHeaders() },
  },
  // Deleting requires a fresh session (signed in within session.freshAge,
  // 1 day by default). Sessions, accounts, orders, subscriptions and videos
  // cascade with the user; afterDelete removes the stored files.
  user: {
    // Where the user first came from, copied from the rs_ft cookie at
    // signup (databaseHooks below). Server-set only and never returned to
    // the browser.
    additionalFields: {
      firstReferrer: firstTouchField("string"),
      firstUtmSource: firstTouchField("string"),
      firstUtmMedium: firstTouchField("string"),
      firstUtmCampaign: firstTouchField("string"),
      firstUtmTerm: firstTouchField("string"),
      firstUtmContent: firstTouchField("string"),
      firstLandingPath: firstTouchField("string"),
      firstLocale: firstTouchField("string"),
      firstSeenAt: firstTouchField("date"),
    },
    deleteUser: {
      enabled: true,
      // The provider would keep charging a live subscription, so the user
      // cancels it first.
      beforeDelete: async (user) => {
        try {
          await beforeDeleteUser(user.id);
        } catch (error) {
          if (!(error instanceof LiveSubscriptionError)) throw error;
          throw new APIError("BAD_REQUEST", { code: "ACTIVE_SUBSCRIPTION", message: error.message });
        }
      },
      afterDelete: (user) => afterDeleteUser(user.id),
    },
  },
  databaseHooks: {
    user: {
      create: {
        // The request that creates the account (the magic link's verify, or
        // Google's callback) is a top-level GET, so it carries the
        // SameSite=Lax first-touch cookie.
        before: async (user, context) => {
          const touch = firstTouchFrom(context);
          return touch ? { data: { ...user, ...touch } } : undefined;
        },
        // Runs after the user row commits. The key makes a retry safe.
        after: async (user, context) => {
          await capture("signup_completed", user.id, { $set_once: initialProperties(firstTouchFrom(context)) });
          if (signupCredits <= 0) return;
          await grantCredits({
            userId: user.id,
            amount: signupCredits,
            reason: "signup",
            idempotencyKey: `signup:${user.id}`,
          });
        },
      },
    },
  },
  plugins: [
    magicLink({
      sendMagicLink: ({ email, url }) => sendEmail(magicLinkEmail(email, confirmLink(url))),
    }),
    ...captchaPlugins(),
  ],
});
