import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { cleanup, fireEvent, screen, within } from "@testing-library/react";
import { SidebarProvider } from "@/components/ui/sidebar";
import { renderWithIntl } from "@/test/intl";
import { CreditsProvider } from "./credits";
import { AppSidebar } from "./app-sidebar";

let pathname = "/videos/windowpeeper";
vi.mock("@/i18n/navigation", () => ({
  useRouter: () => ({ push() {} }),
  usePathname: () => pathname,
  Link: ({ href, ...props }: React.ComponentProps<"a"> & { href: string }) => (
    <a href={`/en${href}`} {...props} />
  ),
}));

beforeEach(() => {
  // jsdom has no media queries; render the desktop layout.
  window.matchMedia = vi.fn(
    () => ({ matches: false, addEventListener() {}, removeEventListener() {} }) as never,
  );
  pathname = "/videos/windowpeeper";
  openBuy.mockReset();
});

afterEach(cleanup);

const user = { name: "Ada Lovelace", email: "ada@example.com" };
const openBuy = vi.fn();
vi.mock("@/components/billing/buy-credits", () => ({ useBuyCredits: () => ({ open: openBuy }) }));

function renderSidebar(isAdmin: boolean) {
  renderWithIntl(
    <CreditsProvider balance={10}>
      <SidebarProvider>
        <AppSidebar user={user} isAdmin={isAdmin} videos={12} standardCredits={10} />
      </SidebarProvider>
    </CreditsProvider>,
  );
  return screen.getByRole("navigation", { name: "Dashboard navigation" });
}

test("non-admins see no admin links", () => {
  const nav = renderSidebar(false);

  expect(within(nav).queryByRole("link", { name: "Admin" })).toBeNull();
  expect(within(nav).queryByRole("link", { name: "Users" })).toBeNull();
});

test("admins see the admin pages nested under Admin", () => {
  const nav = renderSidebar(true);

  const admin = within(nav).getByRole("link", { name: "Admin" });
  const users = within(nav).getByRole("link", { name: "Users" });
  expect(admin.getAttribute("href")).toBe("/en/admin");
  expect(users.getAttribute("href")).toBe("/en/admin/users");
  expect(admin.closest("li")?.contains(users)).toBe(true);
});

test("on an admin page, the sub item is the current page and Admin stays highlighted", () => {
  pathname = "/admin/users";
  const nav = renderSidebar(true);

  const admin = within(nav).getByRole("link", { name: "Admin" });
  const users = within(nav).getByRole("link", { name: "Users" });
  expect(users.getAttribute("aria-current")).toBe("page");
  expect(admin.hasAttribute("aria-current")).toBe(false);
  expect(admin.hasAttribute("data-active")).toBe(true);
});

test("the new video page is current on the generator", () => {
  const nav = renderSidebar(false);

  const link = within(nav).getByRole("link", { name: "New video" });
  expect(link.getAttribute("href")).toBe("/en/videos/windowpeeper");
  expect(link.getAttribute("aria-current")).toBe("page");
});

test("My videos leads to the library and counts the user's videos", () => {
  pathname = "/videos/library";
  const nav = renderSidebar(false);

  const link = within(nav).getByRole("link", { name: /My videos/ });
  expect(link.getAttribute("href")).toBe("/en/videos/library");
  expect(link.textContent).toBe("My videos12");
  expect(link.getAttribute("aria-current")).toBe("page");
});

// The loading skeleton reads this attribute on the next full page load.
test("mirrors the collapsed state on <html> for the loading skeleton", () => {
  renderSidebar(false);
  const html = document.documentElement;
  expect(html.hasAttribute("data-sidebar-collapsed")).toBe(false);

  fireEvent.click(screen.getByRole("button", { name: "Toggle Sidebar" }));
  expect(html.hasAttribute("data-sidebar-collapsed")).toBe(true);

  fireEvent.click(screen.getByRole("button", { name: "Toggle Sidebar" }));
  expect(html.hasAttribute("data-sidebar-collapsed")).toBe(false);
});

test("groups the video pages under Create, and the account pages under Account", () => {
  const nav = renderSidebar(false);

  const names = (group: string) =>
    within(within(nav).getByRole("list", { name: group }))
      .getAllByRole("link")
      .map((link) => link.textContent);
  expect(names("Create")).toEqual(["New video", "My videos12"]);
  expect(names("Account")).toEqual(["Billing", "Profile", "Feedback"]);
});

test("the credits card shows the balance and what it buys, and opens the buy-credits dialog", () => {
  renderSidebar(false);

  expect(screen.getByText("= 1 video")).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "Buy credits" }));
  expect(openBuy).toHaveBeenCalled();
});
