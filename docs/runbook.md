# Runbook

How to set up, run and operate the app, and how to fix common problems.

## First-time setup

1. Install dependencies and the Playwright browser:

   ```sh
   pnpm install
   pnpm exec playwright install chromium
   ```

2. Create `.env` and set a secret:

   ```sh
   cp .env.example .env
   openssl rand -base64 32   # paste into BETTER_AUTH_SECRET
   ```

3. Start Postgres and apply migrations:

   ```sh
   docker compose up -d --wait
   pnpm db:migrate
   ```

4. Start the app and check it:

   ```sh
   pnpm dev
   curl http://localhost:3000/api/health   # {"status":"ok","database":"ok"}
   ```

## Environment variables

The table lists every variable in `.env.example` and every `process.env` read in `src/`; `pnpm test` fails if they differ (`src/server/env-docs.test.ts`).

| Variable             | Required          | Purpose                                                       |
| -------------------- | ----------------- | ------------------------------------------------------------- |
| `DATABASE_URL`       | Yes               | Postgres connection string                                    |
| `BETTER_AUTH_SECRET` | Yes               | Signs sessions. 32+ characters. Rotating it signs everyone out |
| `BETTER_AUTH_URL`    | Yes               | Public base URL. Magic links point here. `https://` in production, except on localhost. Also set it when building: prerendered pages use it for canonical and `hreflang` links, which are relative paths without it |
| `CRON_SECRET`        | In production with videos or yearly plans | Bearer token for `/api/cron/sweep` (`GET` or `POST`). 32+ characters. Empty closes the route |
| `INDEXNOW_KEY`       | No                | IndexNow key, 8-128 letters, digits or hyphens. Served at `/indexnow.txt`; `POST /api/indexnow` needs it and `CRON_SECRET` ([IndexNow](#indexnow)). Empty turns IndexNow off |
| `CLIENT_IP_HEADER`   | No                | Request header with the client IP for sign-in rate limits. Default `x-forwarded-for` (Vercel and most proxies). Set `cf-connecting-ip` on Cloudflare. Only this header is trusted |
| `ADMIN_EMAILS`       | No                | Emails that can open `/admin`, separated by commas. Empty means no admins. They also get the [alerts](#alerts) |
| `ALERT_WEBHOOK_URL`  | No                | Incoming webhook for the [alerts](#alerts): a Feishu or Lark custom bot, Slack, or anything that takes `POST {"text": "..."}`. Empty sends alerts by email only |
| `LOG_LEVEL`          | No                | `debug`, `info` (default), `warn` or `error`. Drops server log events below it |
| `LOG_FORMAT`         | No                | `json` (one object per line) or `pretty`. Default `json` in production, else `pretty` |
| `NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN` | No | Public PostHog project token (`phc_`). Set with host; empty disables analytics. Browser value is baked at build time |
| `NEXT_PUBLIC_POSTHOG_HOST` | No | Ingestion origin: `https://us.i.posthog.com` or `https://eu.i.posthog.com`. Set with project token |
| `NEXT_PUBLIC_SENTRY_DSN` | No            | Sentry project DSN. Empty turns error tracking off. Read at build time for the browser |
| `SENTRY_AUTH_TOKEN`  | No                | Build time only. Sentry auth token; with it, the build uploads source maps |
| `SENTRY_ORG`         | With `SENTRY_AUTH_TOKEN` | Sentry organization slug                              |
| `SENTRY_PROJECT`     | With `SENTRY_AUTH_TOKEN` | Sentry project slug                                   |
| `NEXT_PUBLIC_VERCEL_ANALYTICS` | No      | `1` turns Vercel Web Analytics on. Empty turns it off. Read at build time |
| `NEXT_PUBLIC_VERCEL_SPEED_INSIGHTS` | No | `1` turns Vercel Speed Insights on. Empty turns it off. Read at build time |
| `GOOGLE_CLIENT_ID`   | No                | Google OAuth client. Google sign-in is off unless both are set |
| `GOOGLE_CLIENT_SECRET` | No              | Google OAuth client secret                                     |
| `NEXT_PUBLIC_TURNSTILE_SITE_KEY` | No    | Cloudflare Turnstile site key for magic-link sign-in. Read at build time. Turnstile is off unless both are set |
| `TURNSTILE_SECRET_KEY` | No              | Cloudflare Turnstile secret key                                |
| `RESEND_API_KEY`     | Yes in production | Without it, emails are logged; production throws               |
| `EMAIL_FROM`         | In production with `RESEND_API_KEY` | Sender, on a domain verified in Resend. Default `<project name> <onboarding@resend.dev>` |
| `EMAIL_OUTBOX_DIR`   | No                | Saves each email as `<to>.json`. Used by E2E only; refused in production unless `BETTER_AUTH_URL` is localhost |
| `PAYMENT_PROVIDER`   | No                | `stripe` or `waffo`. Empty turns buying off                    |
| `STRIPE_SECRET_KEY`  | With Stripe       | Secret API key (`sk_test_...` / `sk_live_...`) or restricted key (`rk_...`) |
| `STRIPE_WEBHOOK_SECRET` | With Stripe    | Signing secret of the webhook endpoint (`whsec_...`)           |
| `WAFFO_MERCHANT_ID`  | With Waffo        | Merchant ID (`MER_...`)                                        |
| `WAFFO_PRIVATE_KEY`  | With Waffo        | RSA private key, PEM on one line with `\n`                     |
| `WAFFO_PACK_SMALL_PRODUCT_ID` | With Waffo packs | One-time product the `small` pack is sold as (`PROD_...`) |
| `WAFFO_PACK_MEDIUM_PRODUCT_ID` | With Waffo packs | One-time product the `medium` pack is sold as (`PROD_...`) |
| `WAFFO_PACK_LARGE_PRODUCT_ID` | With Waffo packs | One-time product the `large` pack is sold as (`PROD_...`) |
| `WAFFO_SUBSCRIPTION_PRODUCT_ID` | With Waffo subscriptions | Monthly subscription product the plans are sold as (`PROD_...`) |
| `WAFFO_STORE_ID`     | With Waffo subscriptions | Store ID (`STO_...`) for customer portal links          |
| `WAFFO_SUBSCRIPTION_YEARLY_PRODUCT_ID` | With Waffo yearly plans | Yearly subscription product the yearly plans are sold as (`PROD_...`). Empty hides the yearly plans |
| `WAFFO_ENVIRONMENT`  | No                | `test` or `prod` (default). Webhooks from the other environment are rejected |
| `DASHSCOPE_API_KEY`  | No                | Alibaba Cloud Model Studio (Bailian) API key. Empty turns the window peeper video off |
| `DASHSCOPE_BASE_URL` | No                | API host for the key's region. Default `https://dashscope.aliyuncs.com` (Beijing) |
| `IMAGE_MODERATION`   | No                | `seeapi` checks the photos of the photo effects with SeeAPI's NSFW filter. Empty turns the check off |
| `SEEAPI_API_KEY`     | With `IMAGE_MODERATION` | SeeAPI API key                                          |
| `STORAGE_ENDPOINT`   | No                | S3-compatible endpoint. Empty means AWS S3                    |
| `STORAGE_REGION`     | No                | Region for request signing. Default `auto`                    |
| `STORAGE_BUCKET`     | With videos       | Private bucket for uploaded photos and generated videos   |
| `STORAGE_ACCESS_KEY_ID` | With videos    | Access key for the bucket                                     |
| `STORAGE_SECRET_ACCESS_KEY` | With videos | Secret key for the bucket                                    |
| `STORAGE_FORCE_PATH_STYLE` | No          | `true` for MinIO. Leave empty for R2, OSS and S3              |

The server checks these variables when it starts (`src/server/env.ts`, run from `src/instrumentation.ts`). If any is missing or malformed, the log lists every problem as `- NAME: reason` (never the value), and every request returns 500 until you fix them and restart. Empty values count as unset. Variables the app no longer reads, such as `VIDEO_PROVIDER`, `FAL_KEY`, `DASHSCOPE_VIDEO_MODEL` and `PROMPT_MODERATION` from the dropped image-to-video generator, are ignored; delete them from the deployment when convenient. The check also enforces the pairs:

- Both Google variables or neither.
- The keys of the chosen `PAYMENT_PROVIDER`. Waffo needs the three `WAFFO_PACK_*_PRODUCT_ID`, or both subscription variables, or all of them.
- All three `WAFFO_PACK_*_PRODUCT_ID`, or none.
- Both `WAFFO_SUBSCRIPTION_PRODUCT_ID` and `WAFFO_STORE_ID`, or neither.
- `WAFFO_SUBSCRIPTION_PRODUCT_ID` with `WAFFO_SUBSCRIPTION_YEARLY_PRODUCT_ID`.
- The three storage keys when `DASHSCOPE_API_KEY` or any of them is set.
- `SEEAPI_API_KEY` with `IMAGE_MODERATION=seeapi`.

In production it also requires:

- `RESEND_API_KEY`, and `EMAIL_FROM` with it, unless `EMAIL_OUTBOX_DIR` is set.
- `CRON_SECRET` with `DASHSCOPE_API_KEY`, and with yearly plans on sale: `PAYMENT_PROVIDER=stripe`, or `waffo` with `WAFFO_SUBSCRIPTION_YEARLY_PRODUCT_ID`.
- On a public URL (not localhost): `https://`, and no `EMAIL_OUTBOX_DIR`.

## Database

All worktrees share one Compose project (`starter`) and one database volume.

| Task                     | Command                                          |
| ------------------------ | ------------------------------------------------ |
| Start / stop             | `docker compose up -d --wait` / `docker compose stop`. Also starts MinIO on port 9000 (console on 9001, `starter` / `starter-secret`). Change the ports with `STORAGE_PORT` and `STORAGE_CONSOLE_PORT` |
| Open `psql`              | `docker compose exec db psql -U starter starter` |
| Browse data              | `pnpm db:studio`                                 |
| Apply migrations         | `pnpm db:migrate`                                |
| Reset (deletes all data) | `docker compose down -v`, then start and migrate |

### Change the schema

1. Edit the module's `src/server/<module>/schema.ts`. For auth tables, run `pnpm auth:generate` instead.
2. Make sure `src/server/db/schema.ts` re-exports the module's schema.
3. Run `pnpm db:generate --name <change>` and review the SQL in `drizzle/`.
4. Run `pnpm db:migrate`.
5. Commit the schema, the SQL file and `drizzle/meta/` together.

Never run `drizzle-kit push`. Never edit a migration that has been applied anywhere; add a new one.

## Email (Resend)

- Locally, leave `RESEND_API_KEY` empty. Emails (magic links, billing emails, finished-video emails) print to the `pnpm dev` console as `email.not_sent` log events ([Logs](#logs)).
- For production:
  1. Verify the sending domain in Resend.
  2. Create an API key with sending access.
  3. Set `RESEND_API_KEY` and `EMAIL_FROM` (for example `starter <hello@your-domain.com>`).
  4. Set `BETTER_AUTH_URL` to the public URL.

## Google sign-in

1. In Google Cloud Console, create an OAuth client of type **Web application**.
2. Add the authorized redirect URIs:
   - `http://localhost:3000/api/auth/callback/google`
   - `https://<your-domain>/api/auth/callback/google`
3. Set `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET`.
4. Restart the app.

## Bot protection (Turnstile)

New accounts get no credits (`signupCredits` is 0), but bulk signups still cost email sends and clutter the user list. Cloudflare Turnstile makes each magic-link request pass a challenge first. Google sign-in has no challenge: each account needs a Google account.

1. In the Cloudflare dashboard, open **Turnstile** and add a widget. Add your domain (and `localhost` to try it locally). Choose **Managed** mode.
2. Set `NEXT_PUBLIC_TURNSTILE_SITE_KEY` to the site key and `TURNSTILE_SECRET_KEY` to the secret key.
3. Rebuild and restart the app. The site key is read at build time.

The sign-in form then shows the challenge, and the send button waits for it. The server rejects a magic-link request without a valid token (`POST /api/auth/sign-in/magic-link` answers 400). A token works once; after a failed send, the form runs the challenge again.

## Feedback

Signed-in users submit feedback from the fixed bottom-right link in the signed-in layout at `/feedback`. Apply the committed migrations with `pnpm db:migrate` before deploying this feature. Users can select image files or paste images into the feedback box. They can send text, images, or both: up to 2,000 characters and three JPEG, PNG or WebP files totaling 4 MB, at most five requests per minute. Retries of the same submission create one record.

Set `ADMIN_EMAILS` to allow administrators to read `/admin/feedback` and send notifications from `/admin/notifications`. The list includes account names, emails, full messages and timestamps, 20 per page. Configure `STORAGE_*` for image uploads; locally, `docker compose up -d --wait storage` starts MinIO. Without storage, text submissions still work. The list shows image thumbnails and full-size links. Deleting an account also deletes its feedback and stored attachments.

## Credits

New accounts start with no credits: `signupCredits` in `src/server/credits/config.ts` is 0, so signing up writes no ledger row. No page offers free credits; raise it only together with the pricing copy. Videos spend credits; packs add them (and, for subscriptions already bought, renewals).

## Payments

Users buy one-time credit packs on `/billing`. Packs live in `src/server/payment/packs.ts` (amounts in cents): `small` 10 credits for $9.90, `medium` 50 for $29.90, `large` 250 for $99.90. A window peeper video costs 10 credits and a Pro one 20 (`src/server/videos/window-peeper.ts`), so the packs buy 1, 5 and 25 videos. `/pricing` lists the packs, what each buys and what a video costs, and recommends `DEFAULT_PACK_ID` (`medium`); its buttons open `/billing?pack=<id>`, which signs visitors in first and picks that pack. The dashboard's buy-credits dialog and the home page's generator also sell packs: when a video costs more than the balance, the generator lists the packs, picks the recommended one, and checkout returns to the generator, which makes the video once the webhook adds the credits (it retries every 3 seconds for 90 seconds). Set `PAYMENT_PROVIDER` to switch providers, then restart. Orders and subscriptions from the old provider keep working while its webhook stays configured.

Subscriptions aren't sold. `PLANS_ON_SALE` in `src/server/payment/plans.ts` is empty, so no page shows a plan and `POST /api/payment/subscribe` answers 400 `UNKNOWN_PLAN`. Subscriptions already bought keep renewing, and `/billing` shows them to their subscribers. To sell a plan again, add its ID to `PLANS_ON_SALE`, restore the plan copy on `/pricing` and run `pnpm test`. The rest of this list covers subscriptions already bought.

- Each plan bills monthly or yearly (`interval`). `credits` is per month either way; `amount` is per billing period. With both, `/pricing` and `/billing` show a Monthly / Yearly toggle.
- A yearly plan grants the first month with the charge. The sweep grants each later month as it begins, so yearly plans need `CRON_SECRET` and a schedule ([Pending sweep](#pending-sweep)). A past-due or ended subscription gets no more months; a canceling one keeps the months it paid for.
- A subscription checkout closes after 31 minutes (`CHECKOUT_MINUTES` in `src/server/payment/subscriptions.ts`). Until then, or until Stripe reports it expired, starting another answers `409 CHECKOUT_PENDING`, so two checkouts can't both be paid.
- Subscribers switch plans by canceling and subscribing again. They cancel and change cards in the provider's portal ("Manage subscription"). While a subscription is live, account deletion asks them to cancel first.
- Refund in the provider's dashboard. The webhook takes back the refunded share of the credits that charge bought, up to the user's balance; a lost chargeback counts as a refund. Credits already spent stay spent (`payment.refund_shortfall`). A refund doesn't cancel a subscription, and a yearly plan keeps getting months until it ends, so cancel it in the provider too. A won chargeback gives nothing back; add credits on `/admin/users/<id>`.
- The app notifies and emails the subscriber when a charge fails (once per billing period) and when a live subscription ends, with a link to `/billing`. Receipts come from the provider. A failed send logs `payment.email_failed`; the webhook still succeeds.

### Stripe

1. In the Stripe Dashboard, copy the secret key into `STRIPE_SECRET_KEY`.
2. Add a webhook endpoint `https://<your-domain>/api/webhooks/payment/stripe` with the events `checkout.session.completed`, `checkout.session.async_payment_succeeded`, `checkout.session.async_payment_failed`, `checkout.session.expired`, `invoice.paid`, `customer.subscription.created`, `customer.subscription.updated`, `customer.subscription.deleted`, `charge.refunded` and `charge.dispute.funds_withdrawn`.
3. Copy its signing secret into `STRIPE_WEBHOOK_SECRET`.
4. Under Settings → Billing → Customer portal, save the portal settings once and allow cancellation. "Manage subscription" fails until you do.
5. Set `PAYMENT_PROVIDER=stripe`.

Locally, forward webhooks with the Stripe CLI and use the secret it prints:

```sh
stripe listen --forward-to localhost:3000/api/webhooks/payment/stripe
```

### Waffo Pancake

Waffo Pancake is a merchant of record: it charges tax and handles invoices. It requires an `https://` return URL, so locally open the app through an HTTPS tunnel and set `BETTER_AUTH_URL` to the tunnel URL.

1. In the Waffo dashboard, create three one-time products, one per credit pack in `src/server/payment/packs.ts`, named and priced like the pack: "10 credits" at $9.90, "50 credits" at $29.90 and "250 credits" at $99.90. Copy their IDs into `WAFFO_PACK_SMALL_PRODUCT_ID`, `WAFFO_PACK_MEDIUM_PRODUCT_ID` and `WAFFO_PACK_LARGE_PRODUCT_ID`. Keep the pack IDs: each variable maps to one. Checkout still sends each pack's price. A new pack needs its own product, variable and line in `packProductId` (`src/server/payment/providers/waffo.ts`).
2. Under Settings → Developers, copy the merchant ID and API private key into `WAFFO_MERCHANT_ID` and `WAFFO_PRIVATE_KEY`.
3. Subscriptions aren't sold, so skip this step and the next unless subscriptions already bought run through Waffo. For subscriptions, create a monthly subscription product (for example "Pro"). Copy its ID into `WAFFO_SUBSCRIPTION_PRODUCT_ID`, and the store ID into `WAFFO_STORE_ID`. Without them, packs still work and subscribing is off.
4. For yearly plans, create a second subscription product with a yearly billing period (for example "Pro yearly"). Copy its ID into `WAFFO_SUBSCRIPTION_YEARLY_PRODUCT_ID`. Without it, the yearly plans are hidden. Waffo bills the period the product sets, so each product needs its own.
5. Add a webhook endpoint `https://<your-domain>/api/webhooks/payment/waffo` for `order.completed`, the `subscription.*` events and `refund.succeeded`.
6. Set `WAFFO_ENVIRONMENT` to `test` or `prod` to match the keys, and `PAYMENT_PROVIDER=waffo`.

Waffo sends no event when a checkout is abandoned, so those orders stay "Pending". Waffo takes only a success URL; a buyer who leaves its checkout goes back with the browser, so the "Payment canceled" note shows only with Stripe.

#### Go live

Waffo reviews the store before it takes live payments. Until then, use Test Mode keys and `WAFFO_ENVIRONMENT=test`.

1. Before you apply, make the site agree with itself. The reviewer compares the pricing page with the Terms, Refund Policy and Privacy Policy. If the site sells packs only, no legal page may describe subscriptions.
2. In Settings → Business Details, fill in the application and submit it. The merchant name there goes on card statements, and it is locked after approval. Set it to the brand on the site before you submit. A rejection blocks a new review for one week.
3. After approval, open API & Development, switch to Live Mode and create a key for this site only. Test and live keys are separate. The merchant ID is the same.
4. Check the products in Live Mode. Approved stores publish their test products, and the product IDs stay the same. If a product is missing, publish it.
5. Add the webhook from step 5 again in Live Mode. Test Mode webhooks don't receive live events.
6. In the production environment, set `WAFFO_PRIVATE_KEY` to the live key and `WAFFO_ENVIRONMENT=prod`. Set the three `WAFFO_PACK_*_PRODUCT_ID` again, even if you think they are right: hidden values can't be checked. Redeploy.
7. Buy the smallest pack with a real card. Check that the balance goes up and the order shows "Paid". Refund it in the Waffo dashboard, and check that the credits go back down.

With `WAFFO_ENVIRONMENT=prod`, the app rejects Test Mode events. Keep the test key in your local `.env`.

The store name under Settings → General shows at checkout. You can change it at any time.

## Bailian and storage

The window peeper video runs on Alibaba Cloud Model Studio (Bailian). Finished videos are copied to a private bucket.

1. In the [Model Studio console](https://bailian.console.aliyun.com/), create an API key in the Beijing region. Copy it into `DASHSCOPE_API_KEY`.
2. For another region, set `DASHSCOPE_BASE_URL` to that region's host. Keys and hosts from different regions don't mix.
3. Set the `STORAGE_*` variables. Locally, copy them from `.env.example`; they match the MinIO in `compose.yaml`.
4. Restart the app.

For production storage, create a private bucket and an access key limited to it:

- Cloudflare R2: `STORAGE_ENDPOINT=https://<account-id>.r2.cloudflarestorage.com`, `STORAGE_REGION=auto`.
- Alibaba Cloud OSS: `STORAGE_ENDPOINT=https://oss-cn-beijing.aliyuncs.com`, `STORAGE_REGION=cn-beijing`.

Leave `STORAGE_FORCE_PATH_STYLE` empty for both.

## Video generation

Signed-in users make videos on `/videos/<kind>` (`/videos` opens the window peeper video) and on the home page. Every video is a photo effect on Bailian; a failed generation refunds its credits.

- `REFERENCE_COST_PER_SECOND` holds what Bailian charges per second of wan2.7-r2v with sound: 720P $0.10, 1080P $0.15 (Singapore; Beijing charges less). The photo isn't billed.
- `src/server/payment/margins.test.ts` fails if any pack sells a photo effect video in either quality for less than 1.5 times that cost. When you change a price or a pack, run `pnpm test` and raise the credits if it fails.
- Videos finish while the page polls, so no public URL or webhook is needed. A video the sweep settles instead (the page was closed) also emails its owner, once: "ready" with a link to `/videos/<id>`, or "couldn't be made" with the refunded credits. A video the page collects sends no email. Emails are in English, like the billing emails. A failed send logs `video.email_failed`; the sweep goes on.
- Older rows may name a provider the app dropped with the image-to-video generator (`fal`, `seeapi`). Production had none. Such a row still pending fails on its next poll or sweep with `Provider <id> was removed` and refunds its credits.
- Deleting an account deletes its `video` rows and its files under `videos/<userId>/`, uploaded photos included. It also deletes files under `images/<userId>/` and the account's rows in `apikey`, left from text-to-image and API keys, which the app no longer has. If storage fails then, the server logs `storage.user_files_not_deleted`; delete those folders by hand.

### Photo effects: the window peeper video (Bailian wan2.7-r2v)

`/videos/<kind>` and the home page turn one photo into a video: Bailian makes the effect's prompt into a multi-shot video that stars the photo's subject, with generated music. `PHOTO_EFFECTS` (`src/server/videos/photo-effects.ts`) lists the effects; the window peeper video (`src/server/videos/window-peeper.ts`) is the only one. It lasts 14 seconds and costs 10 credits at 720P, or 20 in Pro (1080P), refunded on failure. The buyer picks one of six scenes (`SCENES` in `window-peeper.ts`); each is its own prompt at the same price. Each video is new: the shots differ from one photo to the next.

1. Set `DASHSCOPE_API_KEY` (and `DASHSCOPE_BASE_URL` outside Beijing) and the `STORAGE_*` variables, as in [Bailian and storage](#bailian-and-storage). Photo effects use Bailian `wan2.7-r2v`.
2. Rebuild and restart: the prerendered home page reads these at build time.

- Each photo is a JPEG, PNG or WebP, 240 to 8,000 pixels a side, up to 8:1 (`EFFECT_IMAGE_LIMITS`). Visitors may pick up to 10 MB (`EFFECT_MAX_PICK_BYTES`); the browser shrinks the photo, and the server takes at most 4 MB (`EFFECT_MAX_IMAGE_BYTES`), under Vercel's 4.5 MB request body limit. Don't raise the server limit past that on Vercel.
- Each effect's file holds its definition: title, photos, duration, credits, prompt and the resolutions it sells. The prompt calls the photo's subject "Image 1", fixes every other person's look (or the model changes it between shots), and never names real people, brands or songs.
- Videos made by the retired two-photo effects (the rap duo, zombie couple, hug and raindance duo) last 15 seconds (`TWO_PHOTO_DURATION`): the upload cleanup still deletes their second photo, `<id>-2.<ext>`. Some older videos have a poster frame (`poster_key`); the player still shows it.

#### Add a photo effect

Ship the effect first and check it on real photos.

1. Add `src/server/videos/<kind>.ts`: the definition, as in `window-peeper.ts`, with its prompt.
2. Add the definition to `PHOTO_EFFECTS`, and the kind and its number of photos to `PHOTO_EFFECT_KINDS` (`src/lib/photo-effects.ts`), in the same order.
3. Add `PhotoEffects.kinds.<kind>` to every `messages/*.json`: `title`, `description`, `left`, `photoHint` and `disabled`.
4. Run `pnpm test`. `src/test/photo-effects.test.ts` checks the two lists and the copy; `src/server/payment/margins.test.ts` checks every pack sells it above cost.
5. Deploy. Generate 2 or 3 videos at `/videos/<kind>` with photos of AI-generated people, and check the result.

The sidebar, `POST /api/videos/<kind>`, the page, analytics and the legal pages need no change.

## Content moderation

Photo effects take no prompt, so only photos are checked (`src/server/moderation/`).

- With `IMAGE_MODERATION=seeapi`, each photo of a photo effect is stored, then checked with SeeAPI's [NSFW filter](https://www.seeapi.com/docs/nsfw-filter/image-moderation) before it spends credits. SeeAPI downloads it from a signed URL, so the bucket must be reachable from the internet (not the local MinIO). The check takes a few seconds and costs 0.01 SeeAPI credits. Create the key in [SeeAPI → Keys](https://www.seeapi.com/keys/?tab=api-keys) and copy it into `SEEAPI_API_KEY`.
  - A flagged photo returns 422 `CONTENT_BLOCKED` and logs `video.blocked` with the labels.
  - No verdict within 30 seconds, or an error from SeeAPI, returns 503 `MODERATION_UNAVAILABLE` and logs `video.moderation_failed`. The upload is refused (fail closed); nothing is spent.
  - Either way the stored photo is deleted.
- Without `IMAGE_MODERATION`, photos aren't checked before submission. Bailian's own moderation still refuses what it blocks (`DataInspectionFailed`, `IPInfringementSuspect`): 422 `CONTENT_BLOCKED`, with a refund.

## Pending sweep

A crash during generation leaves a video `pending` with its credits spent, and a video finishes only while someone polls it. `POST /api/cron/sweep` settles them:

- Never submitted after 15 minutes: fail and refund.
- Submitted more than 15 minutes ago: collect from the provider, 20 per run, least recently checked first (`checked_at`; never checked first), 4 at a time.
- Not finished after a day: fail and refund.

Each run fails at most 100 videos, oldest first. A refund reuses the request's own idempotency key, so nothing is refunded twice.

Each run also grants yearly plans every month that has begun in the current period and wasn't granted yet ([Payments](#payments)), keyed `subscription:<id>:<period end>:m<month>`. A yearly subscription still without a period end a day after it started logs `subscription.no_period_end`.

Each run also deletes uploaded photos (photo effect photos, and start images of older videos) more than a day old (`UPLOAD_RETENTION_MS` in `src/server/videos/config.ts`), 100 videos per run, oldest first, and clears the video's `image_key`. The video and its MP4 stay; the library shows it without a poster. An upload that can't be deleted logs `video.upload_not_deleted` and is retried next run. The privacy policy states this period: change both together.

Videos, yearly grants and uploads run independently. If one throws, the others finish and stay committed; the sweep logs `cron.task_failed` and returns 500. Check the error and retry; the idempotency keys make retries safe.

1. Generate a secret with `openssl rand -base64 32`. Set it as `CRON_SECRET`, then restart.
2. Schedule a call every 10 minutes. On Cloudflare Workers, the Cron Trigger in `wrangler.jsonc` already does this ([Deploy to Cloudflare Workers](#deploy-to-cloudflare-workers)). Elsewhere, call `curl -X POST -H "Authorization: Bearer $CRON_SECRET" <BETTER_AUTH_URL>/api/cron/sweep` from any scheduler.

Without `CRON_SECRET`, the route answers 404 to everyone.

After the tasks, each run checks the failure rate and may send an [alert](#alerts). The response's `failureRate` gives the counts (`finished`, `failed`) and whether it alerted.

## Alerts

The server alerts the operators about two problems. Each kind goes out at most once an hour (`ALERT_EVERY_MS`); the `alert` table keeps when each kind last went out, so several servers or sweeps send one.

| Kind | When | Where it's checked |
| ---- | ---- | ------------------ |
| `failure_rate` | Of the videos that finished in the last 60 minutes, at least 5 did and at least 30% failed | Each [sweep](#pending-sweep) run |
| `provider_balance` | A Bailian submission or job fails with `Arrearage`, `AllocationQuota.FreeTierOnly` or `Throttling.AllocationQuota`: the account is in arrears or out of quota | At once, when the job fails |

The thresholds and the codes are in `src/server/alerts/config.ts`. A DashScope key can't read the account's balance, so these codes are the only signal. Check the list against Bailian's [error codes](https://help.aliyun.com/zh/model-studio/error-code) when Bailian changes them. Moderation codes such as `DataInspectionFailed` don't alert.

Each alert goes to:

- every address in `ADMIN_EMAILS`, as a short plain email;
- `ALERT_WEBHOOK_URL`, if set: `POST` with JSON `{ "text": "[windowpeeper] ..." }`. Feishu and Lark hosts (`open.feishu.cn`, `open.larksuite.com`) get `{ "msg_type": "text", "content": { "text": ... } }` instead;
- the log, as `alert.sent`, always. With neither set, the log is the only alert.

Alerts hold counts and codes only: no emails, prompts or raw error messages. A failed email or webhook logs `alert.email_failed` or `alert.webhook_failed` and doesn't retry until the next hour; alerting never fails the sweep or the job.

To send alerts to a Feishu group:

1. In the group, open **Settings** → **Bots** → **Add Bot** → **Custom Bot**.
2. Under security settings, add the custom keyword `windowpeeper`. Every alert starts with it. Don't turn on signature verification; the server doesn't sign.
3. Copy the webhook URL (`https://open.feishu.cn/open-apis/bot/v2/hook/...`).
4. Set it as `ALERT_WEBHOOK_URL` and redeploy.

To test it, send a message the same way: `curl -X POST -H 'Content-Type: application/json' -d '{"msg_type":"text","content":{"text":"windowpeeper test"}}' "$ALERT_WEBHOOK_URL"`.

## Landing page and visual system

- Copy lives under `Home` in every `messages/*.json`. Replace it with what your product does; keep sentence case.
- The hero's viewfinder (`src/components/home/hero.tsx`) plays a real window peeper video from `public/landing/windowpeeper/` (`sample.mp4` and `poster.jpg`), made from an AI-generated person; `Home.hero.clip.note` says so. The other stills in `public/landing/` (the scenes and the before/after) are AI placeholders from the design boards; replace them with frames of real videos. To replace the clip, make a video on the site from a photo you may publish, never a clip from TikTok. Encode it as H.264 + AAC, 540×960, `-movflags +faststart`, under 2 MB; the poster is a frame of that MP4. Then set `EXAMPLE_ADDED` and `EXAMPLE_SECONDS` in `src/app/[locale]/(marketing)/page.tsx` and check `Home.hero.clip` still describes it.
- Colors, radius and fonts are tokens in `src/app/globals.css` (`:root`, `--font-display` for headings). Change them there, not per component.
- The site is dark only. There is no light theme and no theme choice.
- Icons come from `lucide-react` only; ESLint blocks other icon libraries. Stroke width is set once in `globals.css` (`svg.lucide`). Icons are `aria-hidden` by default; give icon-only buttons an `aria-label`.
- Icon motion uses `.icon-nudge` (arrow on hover), `.icon-turn` (plus in an open `<details>`) and `.icon-swap` (cross-fade). All turn off with reduced motion.

## Blog

Posts are MDX files in `content/blog/<locale>/<slug>.mdx`; the file name is the URL (`/blog/<slug>` in English, `/es/blog/<slug>` in Spanish). Each language has its own posts. Give two translations the same file name, so they share a URL.

1. Add the file. Use lowercase letters, digits and hyphens for the slug.
2. Add the slug to its locale in [`content/blog/posts.ts`](../content/blog/posts.ts). A Worker can't list a directory; `src/lib/content.test.ts` fails when the list and the files differ.
3. Start it with its metadata:

   ```mdx
   export const metadata = {
     title: "Writing a post",
     description: "One sentence for the list and search results.",
     date: "2026-10-12",
     tags: ["guides"], // optional
   };
   ```

4. Write the body in Markdown. Start headings at `##`; the title is the page's `#`. Code blocks (```) scroll sideways on phones instead of widening the page.

- `/blog` lists posts newest first. A missing title, description or `YYYY-MM-DD` date fails the build, and so does a post called `tags`.
- Posts appear in the sitemap and `/llms.txt`. Each post's page names its canonical URL, links only the translations that exist, carries schema.org `BlogPosting` JSON-LD (`blogPosting` in `src/lib/seo.ts`) and has its own preview image.
- Tags are optional words in the post's language, such as `guides` or `公告`, without `/` or `%`. Each links to `/blog/tags/<tag>`, which lists the locale's posts with it and stays out of the sitemap.

## IndexNow

[IndexNow](https://www.indexnow.org) tells Bing, Yandex, Naver, Seznam and Yep which URLs changed, so they crawl them sooner. Google doesn't use it; submit the sitemap in Google Search Console instead.

1. Generate a key with `openssl rand -hex 16`. Set it as `INDEXNOW_KEY` in Production, next to `CRON_SECRET`.
2. Deploy. Check that `<BETTER_AUTH_URL>/indexnow.txt` shows the key.
3. After each deploy that adds or changes public pages, run `curl -fsS -X POST -H "Authorization: Bearer $CRON_SECRET" <BETTER_AUTH_URL>/api/indexnow`.

The route sends every sitemap URL (`src/app/sitemap.ts`) and answers `{ "submitted": <count>, "status": <engine status> }`: 200 when the engines accept, 502 when they refuse. A 403 status means the engines couldn't fetch the key at `/indexnow.txt`. Without `INDEXNOW_KEY` or `CRON_SECRET`, both routes answer 404.

## Languages

The app ships in English (`en`), Spanish (`es`) and German (`de`). Blog posts exist in English only. English URLs have no locale prefix; Spanish and German do (`/es/...`, `/de/...`), and `/en/...` redirects to the unprefixed page. Chinese was dropped; old `/zh/*` links redirect to the English pages (`next.config.ts`). Language menus list every locale, so adding one needs no UI change. To add a locale, for example `ja`:

1. Add `"ja"` to `locales` in `src/i18n/routing.ts`, and its own name (`ja: "日本語"`) to `LOCALE_NAMES` there.
2. Copy `messages/en.json` to `messages/ja.json` and translate it. Keep the same keys.
3. Add `content/legal/ja/{privacy,terms,refund}.mdx`. Blog posts in `content/blog/ja/` are optional; without them `/ja/blog` says there are no posts yet, carries `noindex` and stays out of the sitemap and the other blogs' hreflang links (`blogLocales`).
4. Optional: map it to a Waffo cashier language in `src/server/payment/providers/waffo.ts`. Unmapped locales get the English cashier.

## Project settings and legal pages

- Change the project name or support email in `project.config.ts`. The header, footer, home page, legal pages and sign-in email read it. The browser tab title and description are `Metadata` in every `messages/*.json`; change them too. The preview image a shared link shows (Open Graph, 1200×630) uses both; change its layout in `src/app/_lib/og-image.tsx`.
- Set `ADMIN_EMAILS` (comma-separated), then restart. Admins see "Admin" in the sidebar; everyone else gets the 404 page on every admin page. E2E sets its own admin (`ADMIN_EMAIL` in `playwright.config.ts`).
  - `/admin` opens `/admin/users`: 50 users per page, newest first, searched by part of an email or name. An email opens `/admin/users/<id>`: profile, balance, subscription and credit history. On both, a row's + button adds 1 to 1,000,000 credits; the user sees "Added by an admin" on `/billing`, and the log records the admin.
  - `/admin/orders` lists credit-pack orders, 50 per page, newest first, filtered by status and provider. Search matches part of the buyer's email, or an order or provider session ID exactly. It is read-only and lists no subscriptions.
  - `/admin/metrics` covers 24 hours, 7 days (default) or 30 days: new users; credits spent, refunded and bought; paid pack orders with revenue per currency. For videos: jobs by status, success rate (pending left out), median and p95 time to stored file of successes, and the 5 most common failure reasons. Model costs: per model (`wan2.7-r2v 720P` or `1080P`, by the resolution a video stored; older videos as provider and resolution), the jobs, usage (seconds of video), credits and estimated cost in US dollars, with a total. Jobs and credits count by creation time, orders by payment time.
  - Model costs are estimates from list prices kept in the code. Update them when Bailian changes its prices: `REFERENCE_COST_PER_SECOND` (`src/server/videos/config.ts`, dollars per second). Only videos that succeeded count. A model without a price (older videos from dropped generators) shows a dash and adds nothing to the total.
- Legal texts are templates in `content/legal/<locale>/{privacy,terms,refund}.mdx`. Have a lawyer review them, then edit both locales and the "Last updated" line. Search results show each page's one-line summary, `Legal.descriptions.<doc>` in every `messages/*.json`; keep it true to the text.
- Inside the MDX, use `<ProjectName />` and `<SupportEmail />` instead of typing the values.
- To add a legal page:
  1. Add `content/legal/<locale>/<doc>.mdx` for every locale.
  2. Add `<doc>` to `LEGAL_DOCS` in `src/lib/content.ts`.
  3. Add its title under `Legal`, and a one-line summary under `Legal.descriptions`, in every `messages/*.json`.
  4. Add `src/app/[locale]/(marketing)/(legal)/<doc>/page.tsx`, copying an existing one.
  5. Add a Lucide icon for it to `ICONS` in `src/components/legal/legal-nav.tsx` (typecheck fails until you do).

  The sitemap and `/llms.txt` pick it up from `LEGAL_DOCS`. A guide (a page that answers one search and leads to the home generator) needs only its slug in `GUIDES` (`src/lib/guides.ts`), its copy under `Guides.pages.<slug>` in every `messages/*.json` and a three-line `src/app/[locale]/(marketing)/<slug>/page.tsx` like the others; the sitemap, `/llms.txt`, the footer and analytics read `GUIDES`. For any other public page, add its path to `PAGES` in `src/app/sitemap.ts` and a link in `src/app/llms.txt/route.ts`. `/llms.txt` reads the landing page's copy from `Home`, so replacing that copy updates it too.

## Translations

- Put every UI string in every `messages/*.json` under the same key. `pnpm test` (`src/i18n/messages.test.ts`) checks every locale in `src/i18n/routing.ts`: it fails if a locale's file is missing, if its keys differ from `en.json`, or if any message, at any depth, is empty.
- Read strings with `useTranslations("<Namespace>")` (or `getTranslations` in `generateMetadata`).
- The browser gets only the namespaces in `CLIENT_NAMESPACES` (`src/i18n/client-messages.ts`). When a client component (a `"use client"` file, or a file one imports) reads a new namespace, add it there. `pnpm test` (`src/i18n/client-messages.test.ts`) fails until you do, and requires a string literal as the namespace.
- To add a language, follow [Languages](#languages).

## Logs

The server writes one line per event to stdout, and warnings and errors to stderr. In production each line is a JSON object with `time`, `level`, `event` and the event's fields, so a log drain can filter by field. Outside production the line reads `LEVEL event key=value`, with an error's stack below it. Set `LOG_FORMAT` and `LOG_LEVEL` to change this ([Environment variables](#environment-variables)).

| Event | Level | Fields |
| ----- | ----- | ------ |
| `video.submitted` | info | `id`, `userId`, `credits` |
| `video.succeeded` | info | `id`, `userId`, `ms` (from the request to the stored file) |
| `video.failed` | warn | `id`, `userId`, `credits` (refunded), `error` |
| `video.moderation_failed` | error | `userId`, `error`. SeeAPI's image check gave no verdict; the upload got 503 |
| `video.image_not_deleted` | error | `key`, `error`. An uploaded image that failed the check or couldn't be paid for stays in the bucket |
| `video.submit_failed`, `video.refresh_failed`, `video.sweep_refresh_failed` | error | `id` or `userId`, `error` |
| `credits.changed` | info | `userId`, `delta`, `reason`, `balance` |
| `payment.checkout_failed`, `payment.subscribe_failed`, `payment.portal_failed` | error | `userId`, `error` |
| `video.email_failed` | error | `userId`, `error`. The notification is stored; only the email is lost |
| `payment.email_failed` | error | `userId`, `email` (`past_due` or `ended`), `error`. The notification is stored; only the email is lost |
| `payment.refund_unmatched` | warn | `provider`, `refundId`, `orderId` or `subscriptionId`. The refund names no paid order or subscription of this provider; nothing changes |
| `payment.refund_shortfall` | error | `provider`, `userId`, `orderId` or `subscriptionId`, `owed`, `taken`. The user had spent the rest of the refunded credits |
| `payment.unknown_order` | error | `provider`, `error` (names the order ID). The webhook answers 409, so the provider retries |
| `admin.credits_added` | info | `admin` (email) and what changed |
| `cron.sweep` | info | the counts the route returns |
| `video.upload_not_deleted` | error | `id`, `error`. The sweep couldn't delete an upload past its retention; it keeps the key and retries next run |
| `cron.task_failed` | error | `task` (`videos`, `subscriptionMonths` or `uploads`), `error`. Other sweep tasks still finish; the route returns 500 |
| `notification.not_stored`, `storage.user_files_not_deleted` | error | `userId`, `error` |
| `email.not_sent` | info | `to`, `subject`, `text`. Only without `RESEND_API_KEY`; the text holds the magic link |

The startup check of the environment throws instead of logging, so its message is plain text.

## Deploy to Cloudflare Workers

The production setup: a Cloudflare Worker runs the app and the sweep ([`wrangler.jsonc`](../wrangler.jsonc)), Neon hosts Postgres and Cloudflare R2 stores the generated files. `@opennextjs/cloudflare` turns the `next build` output into the Worker (`pnpm cf:build`, [`open-next.config.ts`](../open-next.config.ts)); [`worker.ts`](../worker.ts) wraps it and adds the Cron Trigger.

> **Warning:** use the Workers **Paid** plan. The Worker is about 6 MB gzipped (the Free plan allows 3 MB), and rendering a page takes more than the Free plan's 10 ms of CPU. `pnpm exec wrangler deploy --dry-run` prints the size after `pnpm cf:build`.

What differs from a Node.js server:

- **Database connections**: a Worker can't use a socket another request opened. In a Worker, `getDb()` ([`src/server/db/index.ts`](../src/server/db/index.ts)) returns a client that forwards each use to the current request's own pool, keyed by its execution context. `pg` reaches the database through `pg-cloudflare` (TCP sockets, `nodejs_compat`); `next.config.ts` adds that package to the build, because file tracing misses it.
- **No Cache Components**: with `cacheComponents` on, page renders hang in a Worker ([vercel/next.js#94880](https://github.com/vercel/next.js/issues/94880)), so `next.config.ts` leaves it off.
- **No file system**: the blog's post list is [`content/blog/posts.ts`](../content/blog/posts.ts), not a directory listing ([Blog](#blog)). Without `RESEND_API_KEY` the app can't save emails to `EMAIL_OUTBOX_DIR`, so production needs the key.
- **Cron**: a Cron Trigger (`triggers` in `wrangler.jsonc`) calls `/api/cron/sweep` through the app every 10 minutes with `CRON_SECRET` ([`src/server/cron/scheduled.ts`](../src/server/cron/scheduled.ts)). Without `CRON_SECRET` it logs `cron.skipped` and does nothing.
- **Environment**: `wrangler.jsonc` `vars` holds the settings that aren't secret; the rest are Worker secrets. `next build` reads `BETTER_AUTH_URL` and the `NEXT_PUBLIC_*` variables, so the build needs them too.

### 1. Database (Neon)

The project is `windowpeeper` (`super-frost-35071364`), `aws-us-east-1`, PostgreSQL 18.

1. Copy two connection strings from **Connect**: the pooled one (host contains `-pooler`) and the direct one. In both, change `sslmode=require` to `sslmode=verify-full`. `pg` 8 already treats `require` as `verify-full` and warns about it; `pg` 9 will make `require` skip the certificate check.
2. Apply the migrations from your machine with the direct string:

   ```sh
   DATABASE_URL='<direct connection string>' pnpm db:migrate
   ```

3. Use the pooled string as the Worker's `DATABASE_URL` secret ([3. Secrets](#3-secrets)).

Run step 2 again before you deploy a change that adds a migration.

### 2. Storage (Cloudflare R2)

1. In Cloudflare, create a private R2 bucket. Keep public access off: the app serves files through signed URLs. Production uses `windowpeeper-prod`.
2. Create an R2 API token with **Object Read & Write** on that bucket.
3. `wrangler.jsonc` sets `STORAGE_BUCKET` and `STORAGE_REGION` (`auto`). Set `STORAGE_ENDPOINT=https://<account-id>.r2.cloudflarestorage.com`, `STORAGE_ACCESS_KEY_ID` and `STORAGE_SECRET_ACCESS_KEY` as secrets. Leave `STORAGE_FORCE_PATH_STYLE` unset.

The bucket needs no CORS rules: the server uploads the files, and browsers only open signed URLs in `<img>`, `<video>` and download links.

### 3. Secrets

Set each with `pnpm exec wrangler secret put <NAME>` (needs `wrangler login`), or in the dashboard under **Workers & Pages → windowpeeper → Settings → Variables and Secrets**. Never commit one. The minimum ([Environment variables](#environment-variables)):

- `DATABASE_URL`, `BETTER_AUTH_SECRET`, `RESEND_API_KEY`, `CRON_SECRET`, `ADMIN_EMAILS`
- `STORAGE_ENDPOINT`, `STORAGE_ACCESS_KEY_ID`, `STORAGE_SECRET_ACCESS_KEY`, `DASHSCOPE_API_KEY`
- `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`
- Payments: `PAYMENT_PROVIDER`, `WAFFO_ENVIRONMENT`, `WAFFO_MERCHANT_ID`, `WAFFO_PRIVATE_KEY` and the `WAFFO_PACK_*_PRODUCT_ID`s ([Waffo Pancake](#waffo-pancake))

The app checks the variables when the Worker starts and answers every request with 500 while one is wrong; the message is in [Workers Logs](#6-logs).

### 4. Builds

Cloudflare builds and deploys each push to `main` (Workers Builds). Setup, done once in the Cloudflare dashboard:

1. **Workers & Pages → Create → Import a repository** → `linonward/windowpeeper`. For an existing `windowpeeper` Worker, use **Settings → Builds → Connect** instead.
2. Build settings:
   - Build command: `pnpm cf:build`
   - Deploy command: `npx wrangler deploy`
   - Production branch: `main`; preview builds off
   - Build variables: `BETTER_AUTH_URL=https://windowpeeper.org` and any `NEXT_PUBLIC_*` you use. `next build` reads them; the Worker's own `vars` and secrets don't reach the build.
   - Node.js comes from [`.node-version`](../.node-version); pnpm from `packageManager` in `package.json`.
3. Push to `main` and confirm in **Deployments** that the commit builds and deploys.

> **Warning:** OpenNext copies `.env` files into the Worker bundle. Don't run `pnpm cf:deploy` from a checkout whose `.env` holds secrets: they would ship inside the code. Workers Builds has no `.env`. To test the Worker locally, run `pnpm cf:preview` with the settings in a git-ignored `.dev.vars`.

Roll back a bad deploy with `pnpm exec wrangler rollback`, then fix `main`.

### 5. Domain and services

`windowpeeper.org` is a Cloudflare zone. The `routes` entry in `wrangler.jsonc` (`custom_domain: true`) creates its DNS record and certificate on deploy; don't add it in the dashboard too. Then point each service at it:

- Resend: verify the sending domain ([Email (Resend)](#email-resend)).
- Google sign-in: add `https://windowpeeper.org/api/auth/callback/google` ([Google sign-in](#google-sign-in)).
- Payments: add the webhook endpoint `https://windowpeeper.org/api/webhooks/payment/waffo` ([Waffo Pancake](#waffo-pancake)).

If the domain changes, change `BETTER_AUTH_URL` in `wrangler.jsonc` and in the build variables, and the route.

### 6. Logs

Workers Logs is on (`observability` in `wrangler.jsonc`), with query strings removed, because sign-in links carry their token there. The app's JSON lines ([Logs](#logs)) are in **Workers & Pages → windowpeeper → Logs**. For a live stream: `pnpm exec wrangler tail windowpeeper --format pretty`.

### 7. Each deploy

1. If the change adds a migration, apply it first ([1. Database (Neon)](#1-database-neon), step 2).
2. Merge to `main`. Check the deployment in the dashboard and that the domain serves it.
3. If the change adds or changes public pages, submit the sitemap to [IndexNow](#indexnow):

   ```sh
   curl -fsS -X POST -H "Authorization: Bearer $CRON_SECRET" https://windowpeeper.org/api/indexnow
   ```

   Expect `{"submitted":<count>,"status":200}`. Cloudflare doesn't show a secret again, so keep a copy of `CRON_SECRET` in a password manager.

## Self-host with Docker

The `Dockerfile` builds a single image that runs the app with Node.js on any host: a VPS, Fly.io, Railway, Kubernetes. Bring your own Postgres (Neon works) and S3-compatible storage (R2 works, [Deploy to Cloudflare Workers § Storage](#2-storage-cloudflare-r2)).

> **Warning:** run one instance. Next.js keeps its cache on the container's disk, so several instances can serve different versions of a cached page. Running more needs a shared cache handler ([Next.js self-hosting guide](https://nextjs.org/docs/app/guides/self-hosting#multi-server-deployments)).

1. Build the image. The build bakes `BETTER_AUTH_URL` and the `NEXT_PUBLIC_*` variables into the pages, so pass them as build arguments and build again when one changes:

   ```sh
   docker build -t starter \
     --build-arg BETTER_AUTH_URL=https://your-domain.com \
     --build-arg NEXT_PUBLIC_TURNSTILE_SITE_KEY= \
     --build-arg NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN= \
     --build-arg NEXT_PUBLIC_POSTHOG_HOST= \
     --build-arg NEXT_PUBLIC_SENTRY_DSN= \
     .
   ```

2. Apply the migrations. The `migrate` target holds the migrations and `drizzle-kit`, applies them to `DATABASE_URL` and exits. Use the direct (not pooled) connection string:

   ```sh
   docker build --target migrate -t starter-migrate .
   docker run --rm -e DATABASE_URL='<direct connection string>' starter-migrate
   ```

   Run it again before you start an image that adds a migration.

3. Put the run-time variables in a file, such as `.env.production`. The minimum is the same as on Workers ([3. Secrets](#3-secrets)), plus `BETTER_AUTH_URL`.

4. Start the container. It listens on port 3000 and reports its health from `/api/health`:

   ```sh
   docker run -d --name starter --restart unless-stopped -p 3000:3000 --env-file .env.production starter
   ```

5. Put a reverse proxy with TLS in front, such as Caddy or nginx. It must set `X-Forwarded-For`, or set `CLIENT_IP_HEADER` to the header it sets ([Environment variables](#environment-variables)). Sign-in rate limits read the client IP from it.

6. Schedule the sweep every 10 minutes from the host's crontab ([Pending sweep](#pending-sweep)):

   ```sh
   */10 * * * * curl -fsS -X POST -H "Authorization: Bearer <CRON_SECRET>" https://your-domain.com/api/cron/sweep > /dev/null
   ```

7. Point Resend, Google sign-in and your payment provider at the domain ([Deploy to Cloudflare Workers § Domain and services](#5-domain-and-services)).

Vercel Web Analytics and Speed Insights work only on Vercel: leave `NEXT_PUBLIC_VERCEL_ANALYTICS` and `NEXT_PUBLIC_VERCEL_SPEED_INSIGHTS` empty. The build sets `BUILD_STANDALONE`, which makes `next build` write `.next/standalone`; other builds leave it unset.

## Error tracking (Sentry)

Sentry groups errors and alerts you. With a DSN set, it reports errors thrown while rendering or handling a request (`onRequestError`), every `log.error` event with its fields, tagged with the event name ([Logs](#logs)), and uncaught browser errors and rejections. It sends no performance traces or session replays.

1. In Sentry, create a Next.js project. Copy its DSN into `NEXT_PUBLIC_SENTRY_DSN`.
2. Rebuild and restart the app. The browser reads the DSN at build time.
3. Optional, for readable stack traces: in Sentry, create an organization auth token (**Settings → Auth Tokens**). Set `SENTRY_AUTH_TOKEN`, `SENTRY_ORG` and `SENTRY_PROJECT` where the app builds (on Workers Builds, as build variables). The build then uploads source maps.

Without a DSN, the app never loads the Sentry SDK, on the server or in the browser.

## Analytics (Vercel Web Analytics)

Counts page views and visitors without cookies, so it needs no consent banner. It works only on Vercel and is off by default:

1. In the Vercel project, open **Analytics** and select **Enable**.
2. Set `NEXT_PUBLIC_VERCEL_ANALYTICS=1` for Production.
3. Redeploy. The flag is read at build time.

Pages then load `/_vercel/insights/script.js`. The app sends no custom events.

## Performance (Vercel Speed Insights)

Measures Core Web Vitals from real visits. It works only on Vercel and is off by default:

1. In the Vercel project, open **Speed Insights** and select **Enable**.
2. Set `NEXT_PUBLIC_VERCEL_SPEED_INSIGHTS=1` for Production.
3. Redeploy. The flag is read at build time.

Pages then load `/_vercel/speed-insights/script.js`.

## Troubleshooting

| Symptom                                                   | Fix                                                                                           |
| --------------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| Every page returns 500; the log says `Invalid environment` | Fix the listed variables in `.env` (or the host's settings), then restart. The reasons are in [Environment variables](#environment-variables) |
| `/api/health` returns 503 `database: unreachable`         | Run `docker compose up -d --wait`. Check `DATABASE_URL`                                        |
| `relation "user" does not exist`                          | Run `pnpm db:migrate`                                                                          |
| `DATABASE_URL is not set`                                 | Create `.env` from `.env.example`                                                              |
| `SECURITY WARNING: The SSL modes 'prefer', 'require', and 'verify-ca' are treated as aliases for 'verify-full'` | In `DATABASE_URL`, change `sslmode=require` to `sslmode=verify-full`, then redeploy ([Database (Neon)](#1-database-neon)) |
| Port 3000, 5432, 9000 or 9001 in use                      | Find the process with `lsof -nP -iTCP:<port> -sTCP:LISTEN`. For Postgres, set `POSTGRES_PORT` and update `DATABASE_URL`. For MinIO, set `STORAGE_PORT` (and update `STORAGE_ENDPOINT`) or `STORAGE_CONSOLE_PORT` |
| Magic link opens `?error=INVALID_TOKEN`                   | Links work once and expire after 5 minutes; the confirm page's button spends them. Request a new one |
| Magic link points to the wrong host                       | Set `BETTER_AUTH_URL` to the URL you open the app on                                           |
| "Google sign-in isn't available" / `PROVIDER_NOT_FOUND`   | Set `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET`, then restart                                 |
| Google shows `redirect_uri_mismatch`                      | Register `<BETTER_AUTH_URL>/api/auth/callback/google` in the OAuth client                      |
| "For your security, sign in again before deleting your account." (`SESSION_EXPIRED`) | Account deletion needs a session younger than 1 day (`session.freshAge`). Sign out and sign in again |
| `429 Too many requests` on sign-in for everyone at once | Better Auth rate-limits per client IP (counters in the `rate_limit` table) and reads the IP from `CLIENT_IP_HEADER` (default `x-forwarded-for`). Set it to the header your host fills with the client address, such as `cf-connecting-ip` on Cloudflare; otherwise all users share one bucket |
| Startup log lists `RESEND_API_KEY: required in production` | Set `RESEND_API_KEY` and `EMAIL_FROM`, then restart                                           |
| `Resend: ...` error                                       | Check the key and that `EMAIL_FROM` uses a verified domain                                     |
| `MISSING_MESSAGE` in the console, or a key shows instead of text | Add the key to every `messages/*.json` file. In the browser only: add the namespace to `CLIENT_NAMESPACES` in `src/i18n/client-messages.ts` |
| A link drops the locale (`/sign-in` instead of `/es/sign-in`) | Import `Link` / `useRouter` / `redirect` from `@/i18n/navigation`                                |
| An API call answers `403 FORBIDDEN_ORIGIN`                 | Requests that change data must carry `Origin` equal to `BETTER_AUTH_URL`'s origin. Browsers send it from the app's pages; set `BETTER_AUTH_URL` to the URL you open the app on. Scripts and tests must send the header themselves |
| A script's call answers `401 INVALID_API_KEY`             | The key is wrong, expired or revoked. Create a new one; the full key is shown only when it's created |
| An API call answers `429 RATE_LIMITED`                     | The user passed a per-user limit in `src/app/api/_lib/limits.ts`. Wait `Retry-After` seconds, or raise the limit |
| `/admin` shows "Page not found" for you                    | Add your sign-in email to `ADMIN_EMAILS` and restart. Matching ignores case                       |
| E2E fails broadly, even `/api/health`, or uses a stale or another worktree's server | Each worktree has its own port (3100-3899, from its path), and Playwright reuses a server already on it. Find it with `lsof -nP -iTCP:<port> -sTCP:LISTEN`, stop it, or set `E2E_PORT`. Also check `BETTER_AUTH_SECRET` is set in `.env` |
| `pnpm typecheck` can't find `LayoutProps`                 | Use `pnpm typecheck`, not bare `tsc`; it runs `next typegen` first                             |
| Playwright: `Executable doesn't exist`                    | Run `pnpm exec playwright install chromium`                                                    |
| Videos fail; the log says `Bailian 401 InvalidApiKey` | The key is wrong or from another region. Match `DASHSCOPE_BASE_URL` to the key's region |
| A window peeper task is refunded but the log says `Bailian task ... SUCCEEDED` | Check the deployed result parser. Motion transfer returns `output.results.video_url`; older image-to-video tasks returned `output.video_url`. The parser must accept both. A task already marked failed stays refunded; do not replay its success event or change its ledger entry to make analytics pass. Run a new task after deploying the fix |
| Every window peeper upload answers 503 `MODERATION_UNAVAILABLE` with the local MinIO | `IMAGE_MODERATION=seeapi` needs a bucket SeeAPI can download from. Use one reachable from the internet, or leave `IMAGE_MODERATION` empty locally |
| Videos fail; the log shows an S3 error (`NoSuchBucket`, `AccessDenied`, `ECONNREFUSED`) | Run `docker compose up -d --wait` locally. Elsewhere, check the bucket name, the key's permissions and `STORAGE_ENDPOINT` |
| "Payments aren't set up yet." on `/billing`               | Set `PAYMENT_PROVIDER` and that provider's keys, then restart                                   |
| "Couldn't open subscription management"                  | Stripe: save the Customer portal settings in the Dashboard. Waffo: set `WAFFO_STORE_ID`        |
| "You already started a subscription checkout"             | Expected for 31 minutes after a checkout opens. Finish it, or wait until it closes          |
| Account deletion says to cancel the subscription first    | Expected while the subscription is active, canceling or past due. Cancel it under Manage subscription; deletion works once the provider reports it canceled |
| Paid, but credits don't appear                            | Check the provider's webhook log. `400 INVALID_SIGNATURE`: wrong `STRIPE_WEBHOOK_SECRET`, or `WAFFO_ENVIRONMENT` doesn't match the event. `409 UNKNOWN_ORDER` (log `payment.unknown_order`): a payment names an order this database never recorded, such as an event from another app on the same Stripe account, or a database restored from an older backup. The provider retries for days; find the order ID in the log |
| Waffo checkout fails right away                           | Waffo needs an `https://` return URL. Set `BETTER_AUTH_URL` to an HTTPS URL                    |
| Waffo checkout fails with "Product not found or not active for this environment" | A `WAFFO_PACK_*_PRODUCT_ID` names no product active in the key's environment. Set the three IDs from the dashboard in the same mode as `WAFFO_PRIVATE_KEY`, and publish missing products. Then redeploy |
| `ERR_PNPM_IGNORED_BUILDS`                                 | Add the package to `allowBuilds` in `pnpm-workspace.yaml` (`false` unless it needs its script) |
| `AGENTS.md` changes after `pnpm dev`                      | `next dev` re-adds its agent rules block. Commit it                                            |


## PostHog

Set `NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN` and `NEXT_PUBLIC_POSTHOG_HOST` in the deployment environment, then rebuild. Use the public project token, never a personal API key. Leave both empty in local development and previews to keep test traffic out of production reporting. To disable collection, clear both and redeploy.

All events carry `app=windowpeeper`; filter by it in a shared PostHog project. The implementation uses the capture HTTP API without an additional SDK dependency.

| Event | Source and meaning |
| --- | --- |
| `$pageview` | Initial page and client pathname changes; query, hash, referrer and resource IDs are excluded from the page itself. The page load's first view also carries its `utm_source`, `utm_medium`, `utm_campaign`, `utm_term` and `utm_content` and, for an outside referrer, `$referrer` (host and path) and `$referring_domain`, so PostHog's sources and channels count every visit. The first touch goes with it as `$set_once` ([First touch](#first-touch)) |
| `$identify` | Links the browser anonymous ID to the authenticated account ID |
| `checkout_started` | A pack or subscription checkout was created by the provider and its session saved; rejected attempts do not count |
| `signup_completed` | Better Auth creates a new account, including accounts without signup credits |
| `generation_started` | A video job and its credit debit have committed |
| `generation_succeeded` | The result has been stored and the job changed to succeeded |
| `generation_failed` | A pending job failed and its refund committed |
| `payment_succeeded` | Verified payment webhook fulfills a pack or a subscription charge |
| `photo_selected` | Home generator: the visitor picked a photo in the file input. A photo restored after sign-in or checkout doesn't count |
| `generate_clicked` | Home generator: the Make my video button was pressed with a photo and the consent box ticked. `quality`: `standard`; `ratio`: `9:16` |
| `paywall_viewed` | Home generator: a send the visitor started answered 402 and the packs showed. `quality` (`standard`), `credits_needed` (10). The retries after a payment don't count |
| `checkout_clicked` | Home generator: the pay button was pressed. `pack_id` (`small`, `medium`, `large`), `quality` |
| `video_downloaded` | Home generator: the Download link of the finished video was clicked |
| `video_shared` | Home generator: the video was shared. `method`: `native` (the share sheet completed; closing it doesn't count) or `copy` (the link was copied) |

The six home generator events are sent from the browser, from the handler of the action, so each fires once per action and never on a re-render. They carry choices only, never the photo, its name or an error message.

Generation properties include `kind` and `credits`. Payment properties include `payment_kind`, `provider`, `product_id`, `credits`, `catalogue_amount_minor`, `currency` and subscription `interval`. The catalogue amount is not net revenue or the actual tax-adjusted charge. Refunds are not revenue adjustments in PostHog.

### First touch

On a visitor's first page load, the browser records where they came from (`src/lib/first-touch.ts`), whether or not PostHog is on: the referrer's host and path (no query or hash; this site's own pages and app referrers count as direct), `utm_source`, `utm_medium`, `utm_campaign`, `utm_term` and `utm_content`, the landing path (no query), the browser's language and the time. It keeps it in `localStorage` (`windowpeeper:first-touch`) and in the first-party cookie `rs_ft` (URL-encoded JSON, at most 1 KB, `SameSite=Lax`, `Secure` on HTTPS, 90 days from the first visit). Later visits never overwrite it; if one store was cleared, the other restores it. After 90 days the next visit records a new one.

Signing up copies it onto the account: the request that creates the user (the magic link, or Google's callback) carries the cookie, and Better Auth's `user.create.before` hook stores the checked and shortened values in the user's `first_*` columns. Users who signed up before this, or whose browser blocked the cookie, have none. The columns never go to the browser.

Every browser event and the server's `signup_completed` and `payment_succeeded` set it once on the PostHog person with `$set_once`: `$initial_referrer` and `$initial_referring_domain` (`$direct` without a referrer), `$initial_utm_source`, `$initial_utm_medium`, `$initial_utm_campaign`, `$initial_utm_term`, `$initial_utm_content`, `$initial_pathname`, `initial_locale` and `initial_seen_at`. PostHog's own funnels can then break down by these person properties. Anonymous events don't create person profiles, so the breakdown covers visitors once they sign in.

`/admin/metrics` also groups paid orders and revenue by the buyer's first-touch source: `utm_source` (lowercased), else the referrer's host, else direct.

### Identity

The browser stores a random anonymous ID, the last authenticated account ID and an expiry in `localStorage` (`windowpeeper:analytics`) for at most 30 days. Storage failures fall back to memory. Once Better Auth resolves the session, `$identify` links the anonymous ID to `windowpeeper:<userId>`; signed-in page views and server events use that same ID. Identification enables pseudonymous person profiles without name/email properties. Logout or a direct account switch rotates the anonymous ID before another account can be linked. A session fetch error does not count as logout. The only cookie is `rs_ft` ([First touch](#first-touch)); no autocapture or session replay is enabled. Prompts, files, names, emails, raw errors, payment credentials and provider payment IDs are excluded. GeoIP enrichment is disabled; the ingestion service still receives browser network requests.

Delivery is best effort, not a financial ledger. Server calls wait at most 1.5 seconds, log a generic failure and let the business operation succeed. Committed state transitions and unique notification records suppress repeated completion/payment events. A crash, failed notification insert or capture failure can lose an event; there is no durable retry queue. Use the payment database for accounting.

Verify with PostHog Activity filtered by `app=windowpeeper`: visit a page, then follow a normal signup/generation/payment flow. For ingestion-only tests use a separate `analytics_connection_test` event with `is_test=true`; do not fabricate business success events. Unit and integration tests exercise capture failures, private route redaction, lifecycle transitions and repeated webhooks without production charges.


### Conversion funnels

In PostHog, create a Funnels insight filtered by `app = windowpeeper`. For the home generator, use these ordered steps:

1. `$pageview` with `$pathname` = `/` (or `/es`, `/de`).
2. `photo_selected`.
3. `generate_clicked`.
4. `paywall_viewed`.
5. `checkout_clicked`.
6. `checkout_started`.
7. `payment_succeeded`.
8. `generation_succeeded`.

A visitor with credits skips steps 4-7, so also chart `generate_clicked` → `generation_succeeded`. Break any of them down by the person property `$initial_utm_source` or `$initial_referring_domain`, and by `quality`. Track sharing with `video_downloaded` and `video_shared` (break down by `method`).

For the account funnel, use unique persons and ordered steps:

1. `$pageview` (optionally filter `$pathname` to the landing page).
2. `signup_completed`.
3. `generation_started`.
4. `generation_succeeded`.
5. `checkout_started`.
6. `payment_succeeded`.

Use a 30-day conversion window initially. Also create separate activation (`signup_completed` → `generation_succeeded`) and purchase (`checkout_started` → `payment_succeeded`) funnels: users can purchase before generating, so a single strict six-step funnel excludes that valid path. Returning accounts do not emit another signup event. Break down checkout by `payment_kind`, `product_id`, `provider` and `interval`.

Historical anonymous traffic cannot be linked retroactively without its original browser ID. Cross-device visits, cleared/blocked storage, expired IDs and blocked analytics can leave gaps. Magic links opened in another tab on the same browser retain the ID; opening them on another device does not. Identification is best effort and retries on a later navigation after a failed send. Subscription renewals also emit `payment_succeeded`; this is a user-conversion funnel, not checkout-level reconciliation or net revenue reporting.
