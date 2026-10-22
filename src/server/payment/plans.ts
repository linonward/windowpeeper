// Subscription plans, billed monthly or yearly. Either way, a plan grants
// its credits every month: a yearly plan grants the first month with the
// charge and the other eleven as each month begins (grantYearlyMonths).
// Unused credits carry over. Amounts are per billing period, in the
// currency's smallest unit.
export const SUBSCRIPTION_PLANS = [
  { id: "pro", interval: "month", credits: 300, amount: 1000, currency: "usd" },
  { id: "pro-yearly", interval: "year", credits: 300, amount: 10800, currency: "usd" },
] as const;

// The plans on sale: none. The site sells credit packs only, so no page
// shows a plan and subscribing answers UNKNOWN_PLAN. Subscriptions already
// bought keep renewing, granting credits and taking webhooks, refunds and
// the portal. List a plan's ID to sell it again.
export const PLANS_ON_SALE: readonly string[] = [];

export const PLAN_INTERVALS = ["month", "year"] as const;
export type PlanInterval = (typeof PLAN_INTERVALS)[number];

export type SubscriptionPlan = (typeof SUBSCRIPTION_PLANS)[number];

export function findPlan(id: string): SubscriptionPlan | undefined {
  return SUBSCRIPTION_PLANS.find((plan) => plan.id === id);
}
