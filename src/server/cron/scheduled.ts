// The request a Cloudflare Cron Trigger (wrangler.jsonc) sends through the
// app every few minutes: the same signed call another scheduler would make
// to the sweep route. Null when the secret or the origin is missing.
export function sweepRequest(env: { BETTER_AUTH_URL?: string; CRON_SECRET?: string }): Request | null {
  if (!env.CRON_SECRET || !env.BETTER_AUTH_URL) return null;
  return new Request(new URL("/api/cron/sweep", env.BETTER_AUTH_URL), {
    method: "POST",
    headers: { authorization: `Bearer ${env.CRON_SECRET}` },
  });
}
