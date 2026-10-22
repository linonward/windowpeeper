import { afterEach, expect, test, vi } from "vitest";
import { cleanup, fireEvent, screen } from "@testing-library/react";
import { useState } from "react";
import { renderWithIntl } from "@/test/intl";
import { Billing } from "@/components/billing/billing";
import { EffectGenerator } from "@/components/videos/effect-generator";
import { CreditsProvider, useCredits } from "./credits";

vi.mock("@/i18n/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn(), push: vi.fn(), replace: vi.fn() }),
}));

afterEach(cleanup);

const surfaces = {
  windowpeeper: (
    <EffectGenerator
      kind="windowpeeper"
      balance={100}
      credits={10}
      maxPickBytes={5 * 1024 * 1024}
      maxUploadBytes={4 * 1024 * 1024}
      imageLimits={{ minSide: 240, maxSide: 8000, maxRatio: 8 }}
      enabled
      videos={[]}
    />
  ),
  billing: (
    <Billing
      balance={100}
      packs={[]}
      featured="small"
      prices={{ standard: 10, pro: 20 }}
      orders={[]}
      transactions={[]}
      enabled={false}
    />
  ),
};

function SpendAndNavigate({ surface }: { surface: keyof typeof surfaces }) {
  const credits = useCredits();
  const [open, setOpen] = useState(false);
  return open ? surfaces[surface] : (
    <button onClick={() => {
      credits?.adjust(-4);
      setOpen(true);
    }}>
      Spend and navigate
    </button>
  );
}

test.each(Object.keys(surfaces) as (keyof typeof surfaces)[])(
  "%s shows the shared balance after spending on another page, even with stale route props",
  (surface) => {
    renderWithIntl(<CreditsProvider balance={100}><SpendAndNavigate surface={surface} /></CreditsProvider>);
    fireEvent.click(screen.getByRole("button", { name: "Spend and navigate" }));
    expect(screen.getByText(surface === "billing" ? "96 credits" : "96 credits left")).toBeTruthy();
  },
);

function Refund() {
  const credits = useCredits();
  return <button onClick={() => credits?.adjust(25, "video-refund:shared")}>Refund</button>;
}

function Balance() {
  return <output>{useCredits()?.balance}</output>;
}

test("a refund observed by two preserved generators changes the shared balance once", () => {
  renderWithIntl(<CreditsProvider balance={75}><Refund /><Refund /><Balance /></CreditsProvider>);
  for (const button of screen.getAllByRole("button", { name: "Refund" })) fireEvent.click(button);
  expect(screen.getByRole("status").textContent).toBe("100");
});
