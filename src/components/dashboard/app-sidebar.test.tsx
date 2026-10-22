import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { cleanup, fireEvent, screen, within } from "@testing-library/react";
import { SidebarProvider } from "@/components/ui/sidebar";
import { renderWithIntl } from "@/test/intl";
import { CreditsProvider } from "./credits";
import { AppSidebar } from "./app-sidebar";
import { photoEffectKinds } from "@/lib/photo-effects";
import en from "../../../messages/en.json";

let pathname = "/videos";
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
  pathname = "/videos";
});

afterEach(cleanup);

const user = { name: "Ada Lovelace", email: "ada@example.com" };
const TIPTOE = en.PhotoEffects.kinds.tiptoe.title;

function renderSidebar(isAdmin: boolean) {
  renderWithIntl(
    <CreditsProvider balance={10}>
      <SidebarProvider>
        <AppSidebar user={user} isAdmin={isAdmin} />
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

test("the video library sits under the video generator", () => {
  pathname = "/videos/library";
  const nav = renderSidebar(false);

  const videos = within(nav).getByRole("link", { name: "Video generator" });
  const library = within(nav).getByRole("link", { name: "All videos" });
  expect(videos.getAttribute("href")).toBe("/en/videos");
  expect(library.getAttribute("href")).toBe("/en/videos/library");
  expect(videos.closest("li")?.contains(library)).toBe(true);
  expect(library.getAttribute("aria-current")).toBe("page");
});

test("the tip-toe dance sits under the video generator", () => {
  pathname = "/videos/tiptoe";
  const nav = renderSidebar(false);

  const videos = within(nav).getByRole("link", { name: "Video generator" });
  const tiptoe = within(nav).getByRole("link", { name: TIPTOE });
  expect(tiptoe.getAttribute("href")).toBe("/en/videos/tiptoe");
  expect(videos.closest("li")?.contains(tiptoe)).toBe(true);
  expect(tiptoe.getAttribute("aria-current")).toBe("page");
});

// The loading skeleton reads this attribute on the next full page load.
test("mirrors the collapsed state on <html> for the loading skeleton", () => {
  renderSidebar(false);
  const html = document.documentElement;
  expect(html.hasAttribute("data-sidebar-collapsed")).toBe(false);

  fireEvent.click(screen.getByRole("button", { name: "Collapse sidebar" }));
  expect(html.hasAttribute("data-sidebar-collapsed")).toBe(true);

  fireEvent.click(screen.getByRole("button", { name: "Expand sidebar" }));
  expect(html.hasAttribute("data-sidebar-collapsed")).toBe(false);
});

test("one item opens credits and billing", () => {
  const nav = renderSidebar(false);

  expect(within(nav).queryByRole("link", { name: "Credits" })).toBeNull();
  expect(within(nav).getByRole("link", { name: "Credits & billing" }).getAttribute("href")).toBe(
    "/en/billing",
  );
});

test("groups the tools under Create, and billing under Account", () => {
  const nav = renderSidebar(false);

  const names = (group: string) =>
    within(within(nav).getByRole("list", { name: group }))
      .getAllByRole("link")
      .map((link) => link.textContent);
  // Every photo effect, by its title, before the library.
  const effects = photoEffectKinds.map((kind) => en.PhotoEffects.kinds[kind].title);
  expect(names("Create")).toEqual(["Video generator", ...effects, "All videos"]);
  expect(effects).toEqual([TIPTOE]);
  expect(names("Account")).toEqual(["Credits & billing"]);
  expect(within(nav).queryByRole("link", { name: "Feedback" })).toBeNull();
  expect(within(nav).queryByRole("link", { name: "Dashboard" })).toBeNull();
});

test("group labels are translated", () => {
  renderWithIntl(
    <CreditsProvider balance={10}>
      <SidebarProvider>
        <AppSidebar user={user} isAdmin={false} />
      </SidebarProvider>
    </CreditsProvider>,
    "zh",
  );

  expect(screen.getByRole("list", { name: "创作" })).toBeTruthy();
  expect(screen.getByRole("list", { name: "账户" })).toBeTruthy();
});

test("Profile opens from the user menu, not from the navigation", () => {
  const nav = renderSidebar(false);

  expect(within(nav).queryByRole("link", { name: "Profile" })).toBeNull();
});
