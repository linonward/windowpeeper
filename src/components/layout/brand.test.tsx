import { afterEach, expect, test } from "vitest";
import { cleanup, screen } from "@testing-library/react";
import { renderWithIntl } from "@/test/intl";
import { Brand } from "./brand";

afterEach(cleanup);

test("shows the lit window next to the wordmark, and the link is named by the name alone", () => {
  renderWithIntl(<Brand />);

  const link = screen.getByRole("link", { name: "WindowPeeper" });
  expect(link.getAttribute("href")).toBe("/");
  const mark = link.querySelector("svg");
  expect(mark?.getAttribute("aria-hidden")).toBe("true");
  // Four panes; the lower left one is dark (docs/DESIGN.md, Logo).
  expect(mark?.querySelectorAll("rect.fill-primary-hover").length).toBe(3);
  expect(mark?.querySelectorAll("rect.fill-background").length).toBe(1);
});

test("lights the second word of the name in lamp", () => {
  renderWithIntl(<Brand />);

  expect(screen.getByText("Window").className).not.toContain("text-primary");
  expect(screen.getByText("Peeper").className).toContain("text-primary");
});
