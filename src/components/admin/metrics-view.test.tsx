import { afterEach, expect, test } from "vitest";
import { cleanup, screen, within } from "@testing-library/react";
import { renderWithIntl } from "@/test/intl";
import { MetricsView, type MetricsData } from "./metrics-view";

afterEach(cleanup);

const metrics: MetricsData = {
  users: { total: 1200, new: 34 },
  credits: { spent: 5400, refunded: 120, bought: 9000 },
  orders: {
    paid: 12,
    revenue: [
      { currency: "usd", amount: 48000 },
      { currency: "cny", amount: 9900 },
    ],
  },
  generations: [
    {
      kind: "video",
      total: 40,
      succeeded: 30,
      failed: 10,
      pending: 0,
      medianMs: 12_400,
      p95Ms: 95_000,
      errors: [
        { error: "Bailian 400 DataInspectionFailed", count: 7 },
        { error: "Never submitted", count: 3 },
      ],
    },
  ],
  costs: {
    rows: [
      { kind: "video", model: "wan2.7-r2v 720P", jobs: 3, usage: 35, credits: 175, costUsd: 3.5 },
      { kind: "video", model: "wan2.7-r2v 1080P", jobs: 1, usage: 5, credits: 20, costUsd: 0.0031 },
      { kind: "video", model: "fal 1080p", jobs: 1, usage: 5, credits: 20, costUsd: null },
    ],
    totalUsd: 3.5031,
  },
  channels: [
    { source: "tiktok", orders: 3, revenue: [{ currency: "usd", amount: 1298 }, { currency: "cny", amount: 900 }] },
    { source: "direct", orders: 1, revenue: [{ currency: "usd", amount: 499 }] },
  ],
};

const slow = { ...metrics.generations[0], medianMs: 2 * 3600_000, p95Ms: 5_400_000 };
const none = { ...metrics.generations[0], total: 0, succeeded: 0, failed: 0, medianMs: null, p95Ms: null, errors: [] };

test("links each range and marks the current one", () => {
  renderWithIntl(<MetricsView metrics={metrics} days={7} ranges={[1, 7, 30]} />);

  const nav = screen.getByRole("navigation", { name: "Range" });
  const links = within(nav).getAllByRole("link");
  expect(links.map((link) => [link.textContent, link.getAttribute("href")])).toEqual([
    ["24 hours", "/admin/metrics?days=1"],
    ["7 days", "/admin/metrics?days=7"],
    ["30 days", "/admin/metrics?days=30"],
  ]);
  expect(links[1].getAttribute("aria-current")).toBe("page");
  expect(links[0].getAttribute("aria-current")).toBeNull();
});

test("shows users, credits and orders with their notes", () => {
  renderWithIntl(<MetricsView metrics={metrics} days={7} ranges={[1, 7, 30]} />);

  const card = (name: string) => screen.getByRole("group", { name });
  expect(card("New users").textContent).toContain("34");
  expect(card("New users").textContent).toContain("1,200 users in total");
  expect(card("Credits spent").textContent).toContain("5,400");
  expect(card("Credits spent").textContent).toContain("120 refunded");
  expect(card("Credits bought").textContent).toContain("9,000");
  expect(card("Paid orders").textContent).toContain("12");
  expect(card("Paid orders").textContent).toContain("$480.00");
  expect(card("Paid orders").textContent).toContain("CN¥99.00");
});

test("shows each kind's outcomes and timings, with dashes when there's nothing to measure", () => {
  renderWithIntl(<MetricsView metrics={metrics} days={7} ranges={[1, 7, 30]} />);

  const table = screen.getByRole("table", { name: "Generations" });
  const [, videos] = within(table).getAllByRole("row");
  const cells = (row: HTMLElement) => within(row).getAllByRole("cell").map((cell) => cell.textContent);
  expect(within(videos).getByRole("rowheader").textContent).toBe("Videos");
  expect(cells(videos)).toEqual(["40", "30", "10", "0", "75%", "12.4 sec", "1.6 min"]);
  cleanup();

  renderWithIntl(<MetricsView metrics={{ ...metrics, generations: [none] }} days={7} ranges={[1, 7, 30]} />);
  const [, empty] = within(screen.getByRole("table", { name: "Generations" })).getAllByRole("row");
  expect(cells(empty)).toEqual(["0", "0", "0", "0", "—", "—", "—"]);
  cleanup();

  renderWithIntl(<MetricsView metrics={{ ...metrics, generations: [slow] }} days={7} ranges={[1, 7, 30]} />);
  const [, row] = within(screen.getByRole("table", { name: "Generations" })).getAllByRole("row");
  expect(cells(row).slice(-2)).toEqual(["2 hr", "1.5 hr"]);
});

test("lists the most common failures per kind", () => {
  renderWithIntl(<MetricsView metrics={metrics} days={7} ranges={[1, 7, 30]} />);

  const videos = screen.getByRole("list", { name: "Video failures" });
  expect(within(videos).getAllByRole("listitem").map((item) => item.textContent)).toEqual([
    "Bailian 400 DataInspectionFailed7",
    "Never submitted3",
  ]);
  cleanup();

  renderWithIntl(<MetricsView metrics={{ ...metrics, generations: [none] }} days={7} ranges={[1, 7, 30]} />);
  expect(screen.queryByRole("list", { name: "Video failures" })).toBeNull();
  expect(screen.getByText("No video failures.")).toBeTruthy();
});

test("says when no orders were paid", () => {
  renderWithIntl(
    <MetricsView metrics={{ ...metrics, orders: { paid: 0, revenue: [] } }} days={1} ranges={[1, 7, 30]} />,
  );

  expect(screen.getByRole("group", { name: "Paid orders" }).textContent).toContain("No revenue");
});

test("lists each model's jobs, usage, credits and estimated cost, with a total", () => {
  renderWithIntl(<MetricsView metrics={metrics} days={7} ranges={[1, 7, 30]} />);

  const table = screen.getByRole("table", { name: "Model costs" });
  const rows = within(table)
    .getAllByRole("row")
    .slice(1)
    .map((row) => [...row.querySelectorAll("th, td")].map((cell) => cell.textContent));
  expect(rows).toEqual([
    ["Videos", "wan2.7-r2v 720P", "3", "35 seconds", "175", "$3.50"],
    ["Videos", "wan2.7-r2v 1080P", "1", "5 seconds", "20", "$0.0031"],
    ["Videos", "fal 1080p", "1", "5 seconds", "20", "—"],
    ["Total", "$3.50"],
  ]);
});

test("says when no model use was billed", () => {
  renderWithIntl(<MetricsView metrics={{ ...metrics, costs: { rows: [], totalUsd: 0 } }} days={7} ranges={[1, 7, 30]} />);

  expect(screen.queryByRole("table", { name: "Model costs" })).toBeNull();
  expect(screen.getByText("No billed model use in this range.")).toBeTruthy();
});

test("lists paid orders and revenue by first-touch source", () => {
  renderWithIntl(<MetricsView metrics={metrics} days={7} ranges={[1, 7, 30]} />);

  const table = screen.getByRole("table", { name: "Orders by first-touch source" });
  const rows = within(table)
    .getAllByRole("row")
    .slice(1)
    .map((row) => [...row.querySelectorAll("th, td")].map((cell) => cell.textContent));
  expect(rows).toEqual([
    ["tiktok", "3", "$12.98 · CN¥9.00"],
    ["Direct", "1", "$4.99"],
  ]);
});

test("says when no orders came from any source", () => {
  renderWithIntl(<MetricsView metrics={{ ...metrics, channels: [] }} days={7} ranges={[1, 7, 30]} />);

  expect(screen.queryByRole("table", { name: "Orders by first-touch source" })).toBeNull();
  expect(screen.getByText("No paid orders in this range.")).toBeTruthy();
});
