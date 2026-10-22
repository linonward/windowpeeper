import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { cleanup, fireEvent, screen, waitFor } from "@testing-library/react";
import { renderWithIntl } from "@/test/intl";

// src/lib/analytics.test.ts covers sending; this checks which steps fire.
const track = vi.fn();
vi.mock("@/lib/analytics", () => ({ track }));

const { BuyCreditsProvider, useBuyCredits } = await import("./buy-credits");

const fetchMock = vi.fn();
const assign = vi.fn();
const packs = [
  { id: "small", credits: 100, amount: 500, currency: "usd" },
  { id: "large", credits: 1200, amount: 4000, currency: "usd" },
];

beforeEach(() => {
  vi.stubGlobal("fetch", fetchMock);
  vi.stubGlobal("location", { ...window.location, assign });
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.clearAllMocks();
  fetchMock.mockReset();
});

function Opener() {
  const buyCredits = useBuyCredits();
  return <button type="button" onClick={() => buyCredits?.open()}>Open</button>;
}

test("the pay button goes to checkout for the picked pack and records the click", async () => {
  fetchMock.mockResolvedValueOnce(Response.json({ url: "https://checkout.test/s" }));
  renderWithIntl(
    <BuyCreditsProvider packs={packs} prices={{ standard: 10, pro: 20 }} featured="small">
      <Opener />
    </BuyCreditsProvider>,
  );

  fireEvent.click(screen.getByRole("button", { name: "Open" }));
  fireEvent.click(await screen.findByRole("button", { name: /\$5\.00/ }));

  await waitFor(() => expect(assign).toHaveBeenCalledWith("https://checkout.test/s"));
  expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({ packId: "small", locale: "en" });
  expect(track.mock.calls).toEqual([["checkout_clicked", { surface: "buy_dialog", pack_id: "small" }]]);
});
