import { afterEach, expect, test } from "vitest";
import { cleanup, screen } from "@testing-library/react";
import { renderWithIntl } from "@/test/intl";
import { ShotList } from "./shot-list";

afterEach(cleanup);

// The tape's end state, which reduced motion shows at once: the full bar and
// every beat lit. The motion only holds the beats back until the bar passes.
test("ends on the full bar with every beat lit, in order", () => {
  const { container } = renderWithIntl(<ShotList />);

  for (const time of ["00:00", "00:03", "00:06", "00:09", "00:12"]) {
    expect(screen.getByText(time).classList).toContain("text-primary-text");
  }
  expect(container.querySelector(".playhead")?.classList).toContain("w-full");
  const beats = [...container.querySelectorAll<HTMLElement>("li")].map((li) => li.style.getPropertyValue("--i"));
  expect(beats).toEqual(["0", "1", "2", "3", "4"]);
});
