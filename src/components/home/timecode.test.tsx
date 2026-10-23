import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { act, cleanup, render, screen } from "@testing-library/react";
import { Timecode } from "./timecode";

function stubReducedMotion(reduce: boolean) {
  vi.stubGlobal("matchMedia", (query: string) => ({
    matches: reduce && query === "(prefers-reduced-motion: reduce)",
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  }));
}

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

test("counts up one second a tick from the time it starts at", () => {
  stubReducedMotion(false);
  render(<Timecode start="REC 01:28:00 AM" />);

  expect(screen.getByText("REC 01:28:00 AM")).toBeDefined();
  act(() => vi.advanceTimersByTime(1000));
  expect(screen.getByText("REC 01:28:01 AM")).toBeDefined();
  act(() => vi.advanceTimersByTime(2000));
  expect(screen.getByText("REC 01:28:03 AM")).toBeDefined();
});

test("carries the seconds into the minutes", () => {
  stubReducedMotion(false);
  render(<Timecode start="REC 01:28:59 AM" />);

  act(() => vi.advanceTimersByTime(1000));
  expect(screen.getByText("REC 01:29:00 AM")).toBeDefined();
});

test("holds still for reduced motion", () => {
  stubReducedMotion(true);
  render(<Timecode start="REC 01:28:00 AM" />);

  act(() => vi.advanceTimersByTime(3000));
  expect(screen.getByText("REC 01:28:00 AM")).toBeDefined();
});
