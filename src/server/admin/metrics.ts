import { and, count, desc, eq, gte, inArray, like, lt, ne, type SQL, sql } from "drizzle-orm";
import type { AnyPgColumn } from "drizzle-orm/pg-core";
import { user } from "@/server/auth/schema";
import { creditTransaction } from "@/server/credits/schema";
import { getDb } from "@/server/db";
import { REFUND_REASON } from "@/server/payment/refunds";
import { order } from "@/server/payment/schema";
import { videoCosts, videoMetrics } from "@/server/videos";

export type Metrics = Awaited<ReturnType<typeof getMetrics>>;

// The ranges /admin/metrics offers, in days.
export const METRICS_RANGES = [1, 7, 30] as const;

type Within = (column: AnyPgColumn) => SQL | undefined;

const total = (value: SQL) => sql<number>`coalesce(${value}, 0)`.mapWith(Number);

// How the app did between `since` and `until`: who joined, the credits
// that moved, paid orders (also by the buyer's first-touch source) and how
// video jobs went. Rows count by when they were created; orders
// by when they were paid.
export async function getMetrics({ since, until = new Date() }: { since: Date; until?: Date }) {
  const db = getDb();
  const within: Within = (column) => and(gte(column, since), lt(column, until));

  const [[users], [newUsers], [credits], [orders], revenue, generations, costs, channels] = await Promise.all([
    db.select({ total: count() }).from(user),
    db.select({ total: count() }).from(user).where(within(user.createdAt)),
    db
      .select({
        // Credits taken back for a refunded payment weren't spent: they
        // count against the credits bought.
        spent: total(
          sql`-sum(${creditTransaction.amount}) filter (where ${creditTransaction.amount} < 0 and ${ne(creditTransaction.reason, REFUND_REASON)})`,
        ),
        refunded: total(sql`sum(${creditTransaction.amount}) filter (where ${like(creditTransaction.reason, "% refund")})`),
        bought: total(
          sql`sum(${creditTransaction.amount}) filter (where ${inArray(creditTransaction.reason, ["purchase", "subscription", REFUND_REASON])})`,
        ),
      })
      .from(creditTransaction)
      .where(within(creditTransaction.createdAt)),
    db
      .select({ paid: count() })
      .from(order)
      .where(and(eq(order.status, "paid"), within(order.paidAt))),
    db
      .select({ currency: order.currency, amount: total(sql`sum(${order.amount})`) })
      .from(order)
      .where(and(eq(order.status, "paid"), within(order.paidAt)))
      .groupBy(order.currency)
      .orderBy(desc(sql`sum(${order.amount})`), order.currency),
    Promise.all([videoMetrics({ since, until })]),
    modelCosts({ since, until }),
    channelRevenue(within),
  ]);

  return {
    users: { total: users.total, new: newUsers.total },
    credits,
    orders: { paid: orders.paid, revenue },
    generations,
    costs,
    channels,
  };
}

// Where a buyer first came from: their first utm_source (lowercased), else
// the host that referred them, else direct. Literal SQL, without
// parameters, so GROUP BY matches the selected expression.
const source = sql<string>`coalesce(nullif(lower(${user.firstUtmSource}), ''), nullif(split_part(${user.firstReferrer}, '/', 1), ''), 'direct')`;

// Paid orders and their revenue per currency, by the buyer's first-touch
// source, most orders first.
async function channelRevenue(within: Within) {
  const rows = await getDb()
    .select({ source, currency: order.currency, orders: count(), amount: total(sql`sum(${order.amount})`) })
    .from(order)
    .innerJoin(user, eq(order.userId, user.id))
    .where(and(eq(order.status, "paid"), within(order.paidAt)))
    .groupBy(source, order.currency)
    .orderBy(desc(sql`sum(${order.amount})`), order.currency);
  const channels = new Map<string, { source: string; orders: number; revenue: { currency: string; amount: number }[] }>();
  for (const row of rows) {
    const channel = channels.get(row.source) ?? { source: row.source, orders: 0, revenue: [] };
    channel.orders += row.orders;
    channel.revenue.push({ currency: row.currency, amount: row.amount });
    channels.set(row.source, channel);
  }
  return [...channels.values()].sort((a, b) => b.orders - a.orders || a.source.localeCompare(b.source));
}

// What each model cost between `since` and `until`, estimated from list
// prices: videos that succeeded, per model (usage in seconds; videoCosts).
// A row's costUsd is null without a price; the total leaves those out.
async function modelCosts(window: { since: Date; until: Date }) {
  const rows = (await videoCosts(window)).map((row) => ({
    kind: "video" as const,
    model: row.model,
    jobs: row.videos,
    usage: row.seconds,
    credits: row.credits,
    costUsd: row.costUsd,
  }));
  return { rows, totalUsd: rows.reduce((sum, row) => sum + (row.costUsd ?? 0), 0) };
}

const DAY_MS = 24 * 60 * 60 * 1000;

// The metrics of the last `days` days, up to now.
export function recentMetrics(days: number) {
  const until = new Date();
  return getMetrics({ since: new Date(until.getTime() - days * DAY_MS), until });
}
