import { existsSync } from "node:fs";
import { Client } from "pg";

// Same source as drizzle.config.ts: the environment, else .env.
if (!process.env.DATABASE_URL && existsSync(".env")) process.loadEnvFile();

async function query<T>(sql: string, params: unknown[] = []): Promise<T[]> {
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  try {
    return (await client.query(sql, params)).rows;
  } finally {
    await client.end();
  }
}

// Rate-limit counters Better Auth stored for an IP.
export async function rateLimitKeys(ip: string): Promise<string[]> {
  const rows = await query<{ key: string }>(`select key from rate_limit where key like $1`, [`%${ip}%`]);
  return rows.map((row) => row.key);
}

// Makes sure at least `count` users exist, so a test doesn't depend on what
// earlier runs left in the database. Rerunning adds nothing.
export async function ensureUsers(count: number) {
  await query(
    `insert into "user" (id, name, email)
     select 'e2e-filler-' || n, 'E2E filler ' || n, 'e2e-filler-' || n || '@example.com'
     from generate_series(1, $1) as n
     on conflict do nothing`,
    [count],
  );
}

// Failed videos for a user, newest first. They render as placeholders, so
// the page needs no storage.
export async function addFailedVideos(userId: string, count: number) {
  await query(
    `insert into video (id, user_id, prompt, duration, provider, resolution, credits, status, created_at)
     select gen_random_uuid()::text, $1, 'Seeded video ' || n, 9, 'dashscope', '720p', 10, 'failed', now() - n * interval '1 minute'
     from generate_series(1, $2) as n`,
    [userId, count],
  );
}

// Credit-pack orders for the user with this email, newest first, in the given
// statuses. Returns their IDs in the same order.
export async function addOrders(email: string, statuses: string[]) {
  const rows = await query<{ id: string }>(
    `insert into "order" (id, user_id, pack_id, credits, amount, currency, status, provider, provider_session_id, created_at)
     select gen_random_uuid()::text, u.id, 'small', 100, 500, 'usd', s.status, 'stripe', 'cs_e2e_' || gen_random_uuid(), now() - s.n * interval '1 minute'
     from "user" u, unnest($2::text[]) with ordinality as s(status, n)
     where u.email = $1
     returning id, created_at`,
    [email, statuses],
  );
  return rows.map((row) => row.id);
}

// An active Stripe subscription for the user with this email, as if the
// first charge had gone through. Returns its ID, which Stripe events carry
// in their metadata.
export async function addSubscription(email: string) {
  const [row] = await query<{ id: string }>(
    `insert into subscription (id, user_id, plan_id, credits, amount, currency, status, provider, provider_session_id)
     select gen_random_uuid()::text, u.id, 'pro', 300, 1000, 'usd', 'active', 'stripe', 'cs_e2e_' || gen_random_uuid()
     from "user" u
     where u.email = $1
     returning id`,
    [email],
  );
  return row.id;
}

// A paid credit pack's grant for the user with this email: a ledger row and
// the balance, as fulfilling an order writes them. New accounts start with
// no credits, so a page that lists credit history needs one.
export async function addPurchase(email: string, credits: number) {
  await query(
    `with buyer as (select id from "user" where email = $1),
     grant_row as (
       insert into credit_transaction (id, user_id, amount, reason, idempotency_key)
       select gen_random_uuid()::text, id, $2, 'purchase', 'order:e2e-' || gen_random_uuid() from buyer
     )
     insert into credit_balance (user_id, balance)
     select id, $2 from buyer
     on conflict (user_id) do update set balance = credit_balance.balance + $2`,
    [email, credits],
  );
}

// The first touch stored on the user with this email at signup.
export async function firstTouchOf(email: string) {
  const [row] = await query<Record<string, string | null>>(
    `select first_referrer, first_utm_source, first_utm_medium, first_utm_campaign, first_landing_path, first_locale, first_seen_at
     from "user" where email = $1`,
    [email],
  );
  return row;
}
