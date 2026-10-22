// Credit packs for sale. Checkout prices them inline, so Stripe needs no
// products or prices set up. Amounts are in the currency's smallest unit.
// A tip-toe video costs 10 credits, a Pro one 20 (src/server/videos/tiptoe.ts):
// small buys one video, medium one Pro video or two videos, large three
// videos. Waffo sells each pack as the product its ID maps to, so keep the IDs.
export const CREDIT_PACKS = [
  { id: "small", credits: 10, amount: 499, currency: "usd" },
  { id: "medium", credits: 20, amount: 799, currency: "usd" },
  { id: "large", credits: 30, amount: 1199, currency: "usd" },
] as const;

// The pack the pricing and billing pages highlight.
export const DEFAULT_PACK_ID: (typeof CREDIT_PACKS)[number]["id"] = "small";

export type CreditPack = (typeof CREDIT_PACKS)[number];

export function findPack(id: string): CreditPack | undefined {
  return CREDIT_PACKS.find((pack) => pack.id === id);
}
