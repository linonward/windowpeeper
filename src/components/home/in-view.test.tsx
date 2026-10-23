import { afterEach, expect, test, vi } from "vitest";
import { act, cleanup, render, screen } from "@testing-library/react";
import { InView } from "./in-view";

type Callback = (entries: Partial<IntersectionObserverEntry>[]) => void;
const observers: { callback: Callback; options?: IntersectionObserverInit; disconnect: ReturnType<typeof vi.fn> }[] = [];

function stubObserver() {
  vi.stubGlobal(
    "IntersectionObserver",
    class {
      disconnect = vi.fn();
      observe = vi.fn();
      constructor(callback: Callback, options?: IntersectionObserverInit) {
        observers.push({ callback, options, disconnect: this.disconnect });
      }
    },
  );
}

afterEach(() => {
  cleanup();
  observers.length = 0;
  vi.unstubAllGlobals();
});

test("marks its motion and waits until it is in view", () => {
  stubObserver();
  render(
    <InView motion="settle" threshold={0.15} data-testid="box">
      text
    </InView>,
  );

  const box = screen.getByTestId("box");
  expect(box.dataset.motion).toBe("settle");
  expect(box.dataset.shown).toBeUndefined();
  expect(observers[0].options).toEqual({ threshold: 0.15 });
});

test("shows once it comes into view, then stops watching", () => {
  stubObserver();
  render(
    <InView motion="windows" threshold={0.3} data-testid="box">
      text
    </InView>,
  );

  act(() => observers[0].callback([{ isIntersecting: false }]));
  expect(screen.getByTestId("box").dataset.shown).toBeUndefined();

  act(() => observers[0].callback([{ isIntersecting: true }]));
  expect(screen.getByTestId("box").dataset.shown).toBeDefined();
  expect(observers[0].disconnect).toHaveBeenCalled();
});
