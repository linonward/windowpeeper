import { expect, test } from "vitest";
import { SUBSCRIPTION_PLANS } from "./plans";
import { createSubscriptionCheckout, offeredPlans, UnknownPlanError } from "./subscriptions";

// The site sells credit packs only (PLANS_ON_SALE in plans.ts). Existing
// subscriptions still renew; subscriptions.int.test.ts puts the plans on
// sale to cover them.
test("offers no subscription plan and refuses to start one", async () => {
  expect(offeredPlans()).toEqual([]);

  for (const { id } of SUBSCRIPTION_PLANS) {
    await expect(
      createSubscriptionCheckout({
        userId: "user",
        email: "ada@example.com",
        planId: id,
        locale: "en",
        successUrl: "http://localhost:3000/en/billing?checkout=success",
        cancelUrl: "http://localhost:3000/en/billing?checkout=cancel",
      }),
    ).rejects.toBeInstanceOf(UnknownPlanError);
  }
});
