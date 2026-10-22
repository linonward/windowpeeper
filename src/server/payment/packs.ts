// Credit packs for sale. Checkout prices them inline, so Stripe needs no
// products or prices set up. Amounts are in the currency's smallest unit.
// A window peeper video costs 10 credits, a Pro one 20 (src/server/videos/window-peeper.ts):
// small buys one video, medium five, large twenty-five (the prices on the
// design boards, docs/design/windowpeeper.pen). Waffo sells each pack as the
// product its ID maps to, so keep the IDs.
export const CREDIT_PACKS = [
  { id: "small", credits: 10, amount: 990, currency: "usd" },
  { id: "medium", credits: 50, amount: 2990, currency: "usd" },
  { id: "large", credits: 250, amount: 9990, currency: "usd" },
] as const;

// The pack the pricing and billing pages highlight.
export const DEFAULT_PACK_ID: (typeof CREDIT_PACKS)[number]["id"] = "medium";

export type CreditPack = (typeof CREDIT_PACKS)[number];

export function findPack(id: string): CreditPack | undefined {
  return CREDIT_PACKS.find((pack) => pack.id === id);
}
