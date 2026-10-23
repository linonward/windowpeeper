import { afterEach, expect, test, vi } from "vitest";
import { cleanup, within } from "@testing-library/react";
import { renderWithIntl } from "@/test/intl";

vi.mock("@/lib/auth-client", () => ({ authClient: { useSession: () => ({ data: null, isPending: false }) } }));

const { Pricing } = await import("./pricing");

afterEach(cleanup);

const packs = [
  { id: "small", credits: 10, amount: 590, currency: "usd" },
  { id: "medium", credits: 50, amount: 1990, currency: "usd" },
  { id: "large", credits: 250, amount: 6990, currency: "usd" },
];

// BuyPack (src/components/billing/buy-pack.test.tsx) opens checkout and
// comes back to #pricing.
test("each pack card has its own buy button", () => {
  renderWithIntl(<Pricing packs={packs} featured="medium" prices={{ standard: 10, pro: 20 }} />);

  const cards = within(document.getElementById("pricing")!.querySelector("ul")!).getAllByRole("listitem");
  expect(cards.map((card) => within(card).getByRole("button").getAttribute("aria-label"))).toEqual([
    "Buy 10 credits for $5.90",
    "Buy 50 credits for $19.90",
    "Buy 250 credits for $69.90",
  ]);
  expect(within(cards[1]).getByRole("button").textContent).toBe("Buy 5 videos");
});
