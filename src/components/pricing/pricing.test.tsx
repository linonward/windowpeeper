import { afterEach, expect, test, vi } from "vitest";
import { cleanup, screen, within } from "@testing-library/react";
import { renderWithIntl } from "@/test/intl";

vi.mock("@/i18n/navigation", () => ({
  Link: ({ href, ...props }: React.ComponentProps<"a">) => <a href={`/en${href}`} {...props} />,
}));
vi.mock("@/lib/auth-client", () => ({ authClient: { useSession: () => ({ data: null, isPending: false }) } }));

const { Pricing } = await import("./pricing");

afterEach(cleanup);

// CREDIT_PACKS (src/server/payment/packs.ts) and the window peeper prices.
const packs = [
  { id: "small", credits: 10, amount: 590, currency: "usd" },
  { id: "medium", credits: 50, amount: 1990, currency: "usd" },
  { id: "large", credits: 250, amount: 6990, currency: "usd" },
];
const prices = { standard: 10, pro: 20 };
const render = (locale?: "en" | "es") =>
  renderWithIntl(<Pricing packs={packs} featured="medium" prices={prices} />, locale);
const cards = () =>
  Array.from(document.querySelector('[aria-labelledby="pricing-packs"] ul')!.children) as HTMLElement[];

test("the head says what a video costs, from the config", () => {
  render();

  expect(screen.getByRole("heading", { level: 1 }).textContent).toBe("Pay for the videos you make");
  expect(
    screen.getByText(
      "One Standard video costs 10 credits. A Pro video costs 20. Credits never expire, and a failed video gives them back.",
    ),
  ).toBeTruthy();
});

test("each card names the pack, its price and credits, who it's for and what it buys", () => {
  render();

  const [single, five, twentyFive] = cards();
  expect(within(single).getByRole("heading", { level: 3 }).textContent).toBe("Single");
  expect(single.textContent).toContain("$5.90");
  expect(single.textContent).toContain("10 credits");
  expect(single.textContent).toContain("For one try");
  expect(single.textContent).toContain("Any of the 6 scenes");
  expect(within(five).getByRole("heading", { level: 3 }).textContent).toBe("5-pack");
  expect(five.textContent).toContain("5 Standard or 2 Pro videos");
  expect(five.textContent).toContain("$3.98 a video, save 33%");
  expect(twentyFive.textContent).toContain("25 Standard or 12 Pro videos");
  expect(twentyFive.textContent).toContain("$2.80 a video, save 53%");
});

test("only the featured pack is recommended; nothing claims popularity", () => {
  const { container } = render();

  const [single, five, twentyFive] = cards();
  expect(five.textContent).toContain("Recommended");
  expect(single.textContent).not.toContain("Recommended");
  expect(twentyFive.textContent).not.toContain("Recommended");
  expect(container.textContent).not.toMatch(/most popular/i);
});

// BuyPack (src/components/billing/buy-pack.test.tsx) opens checkout.
test("each pack's button names the videos and buys that pack here, not on billing", () => {
  render();

  const buy = screen.getByRole("button", { name: "Buy 50 credits for $19.90" });
  expect(buy.textContent).toBe("Buy 5 videos");
  expect(screen.queryByRole("link", { name: /^Buy / })).toBeNull();
});

test("the cost table lists each quality's resolution, wait and credits", () => {
  render();

  const rows = within(screen.getByRole("table")).getAllByRole("row");
  expect(rows.map((row) => Array.from(row.children).map((cell) => cell.textContent))).toEqual([
    ["Quality", "Resolution", "Ready in", "Credits"],
    ["Standard", "720p · 9:16", "~3 min", "10"],
    ["Pro", "1080p · 9:16", "~6 min", "20"],
  ]);
});

test("renders in Chinese", () => {
  render("es");

  expect(screen.getByRole("heading", { level: 1 }).textContent).not.toBe("Pay for the videos you make");
  expect(cards()).toHaveLength(3);
});
