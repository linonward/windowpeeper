import { afterEach, expect, test, vi } from "vitest";
import { cleanup, screen, within } from "@testing-library/react";
import { renderWithIntl } from "@/test/intl";

vi.mock("@/i18n/navigation", () => ({
  Link: ({ href, ...props }: React.ComponentProps<"a">) => <a href={`/en${href}`} {...props} />,
}));

const { Pricing } = await import("./pricing");

afterEach(cleanup);

// CREDIT_PACKS (src/server/payment/packs.ts) and the tip-toe prices.
const packs = [
  { id: "small", credits: 10, amount: 499, currency: "usd" },
  { id: "medium", credits: 20, amount: 799, currency: "usd" },
  { id: "large", credits: 30, amount: 1199, currency: "usd" },
];
const prices = { standard: 10, pro: 20 };
const render = () => renderWithIntl(<Pricing packs={packs} featured="small" prices={prices} />);
// The cards, without the perks listed inside each.
const cards = () =>
  Array.from(screen.getByRole("region", { name: "Pick your pack" }).querySelector("ul")!.children) as HTMLElement[];

test("the h1 names the meme and the lowest price, and the free preview comes first", () => {
  render();

  expect(screen.getByRole("heading", { level: 1 }).textContent).toBe("Rumpelstiltskin meme videos, from $4.99");
  const intro = screen.getByRole("heading", { level: 1 }).nextElementSibling?.textContent ?? "";
  expect(intro).toMatch(/^Try a free 5-second preview first\./);
  expect(intro).toContain("no subscription");
});

// A pack reads as what it buys, not as credits: the title is videos, the
// credits are the small print.
test("each pack is titled by the videos it buys, with its price, the price per video and its credits", () => {
  render();

  const items = cards();
  expect(items.map((card) => within(card).getByRole("heading", { level: 3 }).textContent)).toEqual([
    "1 video",
    "1 Pro video",
    "3 videos",
  ]);
  expect(items[0].textContent).toContain("$4.99");
  expect(items[0].textContent).toContain("10 credits");
  expect(items[1].textContent).toContain("or 2 videos");
  expect(items[2].textContent).toContain("$4.00 a video");
  // One video needs no price per video.
  expect(items[0].textContent).not.toMatch(/\$\d+\.\d\d a video/);
});

// Badges state facts: the pack to start with, and the lowest price per video
// (medium: $7.99 for 2 videos is $3.995 each; large: $11.99 for 3, $3.997).
test("the small pack is recommended and the cheapest per video is the best value; nothing claims popularity", () => {
  const { container } = render();

  const items = cards();
  expect(items[0].textContent).toContain("Recommended");
  expect(items[1].textContent).toContain("Best value");
  expect(items[2].textContent).not.toMatch(/Recommended|Best value/);
  expect(container.textContent).not.toMatch(/most popular/i);
});

test("each pack's button names its price and leads to billing for that pack", () => {
  render();

  const buy = screen.getByRole("link", { name: "Buy 20 credits for $7.99" });
  expect(buy.textContent).toBe("Buy for $7.99");
  expect(buy.getAttribute("href")).toBe("/en/billing?pack=medium");
  expect(buy.getAttribute("rel")).toBe("nofollow");
});

test("what every pack includes sits under the packs", () => {
  render();

  const includes = screen.getByRole("list", { name: "Every pack" });
  expect(within(includes).getAllByRole("listitem").map((item) => item.textContent)).toEqual([
    "Secure checkout",
    "Credits arrive within minutes",
    "Refund within 14 days if unused",
    "Credits back if a video fails",
  ]);
  expect(screen.getByText("Spend credits on either quality: Standard takes 10 per video, Pro takes 20.")).toBeDefined();
});

test("the questions cover the preview, quality, expiry, billing, failures, refunds, watermark and music", () => {
  render();

  const faq = screen.getByRole("region", { name: "Questions about paying" });
  expect(within(faq).getAllByRole("term").map((term) => term.textContent)).toEqual([
    "Can I try it for free first?",
    "How is Pro different from Standard?",
    "Do credits expire?",
    "Will I be charged every month?",
    "What if a video fails?",
    "Can I get a refund?",
    "Is there a watermark?",
    "Does the video have sound?",
  ]);
  expect(faq.textContent).toContain("5 seconds with a watermark, once per account");
  expect(within(faq).getByRole("link", { name: "refund policy" }).getAttribute("href")).toBe("/en/refund");
});

test("renders in Chinese", () => {
  renderWithIntl(<Pricing packs={packs} featured="small" prices={prices} />, "zh");

  expect(screen.getByRole("heading", { level: 1 }).textContent).toMatch(/侏儒怪表情包视频/);
  expect(screen.getByRole("region", { name: "选择套餐" })).toBeDefined();
});
