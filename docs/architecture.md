# Architecture

Where code goes and which layer may import which.

## Layers

| Path                        | Contains                                                       | May import                          |
| --------------------------- | -------------------------------------------------------------- | ----------------------------------- |
| `src/app/`                  | Routes only: pages, layouts, route handlers, `sitemap.ts`, `robots.ts` | Everything                          |
| `src/server/<module>/`      | Server-only business logic, one directory per module           | `src/server`, `project.config`, npm packages |
| `src/components/<area>/`    | UI, one directory per area (`home`, `billing`, `videos`, ...). `ui/` is shadcn | `src/components`, `src/lib`, `src/hooks`, `src/i18n`, `project.config`; tests also `src/test` |
| `src/lib/`                  | Shared utilities and browser clients (`auth-client.ts`). `api.ts` is the API contract: error codes and response bodies. `photo-effects.ts` lists the photo effects' kinds for the UI. `photo-draft.ts` keeps a signed-out visitor's photos in IndexedDB across sign-in. `shrink-photo.ts` shrinks a picked photo in the browser before it uploads. `analytics.ts` sends PostHog events from the browser; `first-touch.ts` records the first visit's source | `src/lib`, `src/i18n`               |
| `src/hooks/`                | React hooks                                                    | `src/lib`, `src/hooks`              |
| `src/i18n/`                 | next-intl routing, locale-aware navigation, request config     | `src/i18n`, `messages/`, npm packages |
| `messages/<locale>.json`    | UI strings, one file per locale, same keys in every file       | —                                   |
| `src/test/`                 | Test helpers (`renderWithIntl`)                                | Everything                          |
| `content/`                  | MDX per locale (`legal/<locale>/*.mdx`, `blog/<locale>/*.mdx`), loaded by `src/lib/content.ts` | MDX components from `src/mdx-components.tsx` |
| `project.config.ts`         | Non-secret settings (name, support email). Client components bundle it, so keep server-only values out | — |
| `src/types/`                | Shared type declarations                                       | —                                   |
| `src/proxy.ts`              | Request-time redirects (Next.js 16 name for middleware)        | `src/i18n`, npm packages            |
| `src/instrumentation.ts`    | Runs `assertValidEnv` once at server start                     | `src/server`                        |

ESLint (`no-restricted-imports`) enforces the "May import" column, by alias and by relative path; `src/test/layers.test.ts` checks each rule. `src/server` stays self-contained so a module can move to a separate service. UI code calls the API instead of importing `src/server`.

A `"use client"` file in `src/app` could import `src/server`; the build then fails on Node-only packages such as `pg`. The `server-only` package isn't used: Better Auth's CLI (`pnpm auth:generate`) refuses a config that imports it.

Icons: `lucide-react` only, stroke width set in `globals.css`. Tests sit next to the code (`*.test.ts(x)`, `*.int.test.ts`); E2E specs live in `e2e/`.

## Routes

Every page sits under `src/app/[locale]/`. Locales are `en` (default) and `zh`; `/` redirects to `/en`. API routes have no locale prefix.

| Group         | Pages                         | Notes                                                                 |
| ------------- | ----------------------------- | --------------------------------------------------------------------- |
| `(marketing)` | home, `pricing`, `blog`, `blog/[slug]`, `blog/tags/[tag]`, the guides `tip-toe-in-my-jordans`, `rumpelstiltskin-meme`, `how-to-make-rumpelstiltskin-video`, `who-is-rumpelstiltskin`, `rumpelstiltskin-movie`, `rumpelstiltskin-1987-movie`, `rumpelstiltskin-dance-scene` | Site header and footer, shared by `(auth)` and `(legal)` inside it. The home page makes tip-toe dance videos ([Videos](#videos)). Its FAQ also renders FAQPage JSON-LD (`faqPage`, `src/lib/seo.ts`) from the same questions, with plain-text answers. The guides (`GUIDES`, `src/lib/guides.ts`) each answer one search: `GuidePage` (`src/components/guides/guide-page.tsx`) renders the h1, sections, links to the other guides and calls to action that lead to `/<locale>#generator`; they have no generator of their own. Copy is `Guides` in `messages/*.json` (one shape per guide, sections read with `t.raw`); prices and photo limits come from `homeFacts`. `guideMetadata` (`src/app/_lib/guide.tsx`) sets the title, description, canonical, languages and Open Graph. The sitemap, `/llms.txt`, the footer's Guides column and PostHog's `ROUTES` read `GUIDES`. The footer's Support column also has a "Report abuse" mailto to the support email with a "Content report" subject; the Terms explain reporting. The header's account button (`SiteAccount`, `src/app/_lib/site-account.tsx`) reads the session cookie behind its own `<Suspense>`, so the pages stay prerendered. An unlisted post or tag renders on first request and can answer 404, because `partialPrefetching` is off (`next.config.ts`) |
| `(marketing)/(auth)` | `sign-in`, `sign-in/confirm` | Magic link and Google. First sign-in creates the account. The emailed link opens `sign-in/confirm` (`confirmLink`, `src/server/auth/magic-link.ts`), whose button submits the token to `/api/auth/magic-link/verify`; email scanners that open links don't spend it. `noindex` |
| `(marketing)/(legal)` | `privacy`, `terms`, `refund` | MDX from `content/legal/`. Linked from the footer |
| `(dashboard)` | `dashboard`, `videos/library`, `videos/[id]`, `feedback`, `billing`, `profile`, `admin`, `admin/users`, `admin/users/[id]`, `admin/orders`, `admin/metrics`, `admin/feedback` | Signed-in area with a shadcn Sidebar shell, `noindex`. `src/proxy.ts` checks the cookie; `(dashboard)/layout.tsx` verifies the session. Read it with `currentSession()` (`src/app/_lib/session.ts`, React `cache`), so a render looks it up once; ESLint keeps `getSession` out of `src/app/[locale]`. `userBalance` and `userSubscription` (`src/app/_lib/account.ts`) work the same way. Admin pages call `notFound()` unless the email is in `ADMIN_EMAILS`. `/credits` redirects (308) to `/billing`. `dashboard` only redirects to `/videos`, so sign-in's default return and old links land there; `/videos` redirects (307, `next.config.ts`, before the session check) to the only photo effect, `/videos/tiptoe` |
| —             | `[...rest]`                   | Calls `notFound()` for the localized 404 (`[locale]/not-found.tsx`). `src/app/not-found.tsx` covers paths outside a locale |
| —             | `/indexnow.txt` | The IndexNow key, `INDEXNOW_KEY`, as plain text; 404 without it. `POST /api/indexnow` names it as `keyLocation` |
| —             | `/sitemap.xml`, `/robots.txt`, `/llms.txt` | The sitemap lists home, legal, pricing, blog and each locale's posts, with `hreflang` alternates (a post links only its locales). The home pages share a domain-root `WebSite` identity and name the brand in Open Graph metadata. Pages name the same canonical URL and alternates (`languageAlternates`, `src/lib/seo.ts`); next-intl's `hreflang` Link header is off (`alternateLinks: false`). `robots.txt` allows all but `/api/`. `llms.txt` ([llmstxt.org](https://llmstxt.org)) gives the name, description, landing copy and links to public pages and posts. All three read `BETTER_AUTH_URL` per request |
| —             | `opengraph-image`, `blog/[slug]/opengraph-image-<hash>` | 1200×630 PNGs rendered by `next/og` from `src/app/_lib/og-image.tsx` at build time. Chinese text loads Noto Sans SC from Google Fonts when the image renders |
| `api/`        | `auth/[...all]`, `health`, `admin/credits`, `admin/feedback/[id]/images/[index]`, `videos/[id]`, `videos/[id]/download`, `notifications`, `notifications/read`, `feedback`, `cron/sweep`, `indexnow`, `payment/{checkout,subscribe,portal}`, `webhooks/payment/[provider]` | Handlers call `src/server`. Signed-in routes use `withSession` (`api/_lib/with-session.ts`): 401 without a session; 403 `FORBIDDEN_ORIGIN` for a POST, PUT, PATCH or DELETE whose `Origin` is missing or not `BETTER_AUTH_URL`; 429 `RATE_LIMITED` with `Retry-After` past a per-user limit (`api/_lib/limits.ts`). Webhooks, cron, `indexnow` (the `CRON_SECRET` bearer; sends the sitemap URLs to IndexNow), health and `/api/auth` check their own callers |

`next.config.ts` sends `Content-Security-Policy: frame-ancestors 'none'`, `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, `Strict-Transport-Security: max-age=63072000` (without `includeSubDomains` or `preload`) and `Referrer-Policy: strict-origin-when-cross-origin` with every response. To embed a page elsewhere, relax the frame headers for that path only.

`src/proxy.ts` runs locale routing and the cookie check. A signed-out visitor goes to `/<locale>/sign-in?next=<path>`; sign-in returns to `next` if it is a path on this site (`signInReturnPath`, `src/lib/sign-in.ts`), else to `/videos`. To add a `(dashboard)` page:

1. Add its path to `PROTECTED` in `src/proxy.ts`.
2. Add a sidebar item to `CREATE` or `ACCOUNT` in `src/components/dashboard/app-sidebar.tsx`.
3. Start the page with `<PageHeader title description />`.
4. Read the request (`headers()`, the session, `searchParams`) in a child inside the page's own `<Suspense>`, with static content outside it. The layout stays mounted on client navigation, so without that boundary navigation blocks and `next dev` reports `uncached data during prerendering or a navigation`. Use `<PageSkeleton />` (`<PageSkeleton header />` if the header waits too) as the fallback, `ListSkeleton` on admin lists. See `billing/page.tsx`.

The layout reads the credit balance once for the sidebar's account menu. Generation forms and billing read `useCreditBalance(initialBalance)` so prefetched or preserved page props cannot restore an old balance. A page that spends or refunds credits calls `useCredits()?.adjust(delta)` (`src/components/dashboard/credits.tsx`) to keep it current; `router.refresh()` also re-reads it.

API routes answer errors with `apiError(code, status)` and type success bodies with `satisfies` against `src/lib/api.ts`. Components read them as `ApiBody<...>` and key messages by `ApiErrorCode`, so a renamed field or code fails `pnpm typecheck`. Add a new code to `ApiErrorCode` first.

Use `Link`, `redirect` and `useRouter` from `@/i18n/navigation`, not `next/*`, so URLs keep the locale.

Dates: the server renders them in UTC (`timeZone` in `src/i18n/request.ts`), so pages hydrate wherever they render. `LocalTimeZone` (`src/components/layout/local-time-zone.tsx`), inside the locale layout's provider, then re-renders client components' dates in the browser's time zone. Format dates with `useFormatter` in a client component, not on the server, so readers see their own time.

## Server modules

A module that owns tables keeps them in its `schema.ts`; `db/schema.ts` re-exports them all. `db/legacy-schema.ts` keeps the tables of features the app dropped (`chat`, `chat_message`, `ai_usage`, `image`, `apikey`, `broadcast`): no code writes them, and they stay defined until a deliberate migration drops them, so `pnpm db:generate` finds no change.

| Module   | Files                                                    |
| -------- | -------------------------------------------------------- |
| `db`     | `index.ts` (client), `schema.ts`, `legacy-schema.ts` |
| `auth`   | `index.ts` (Better Auth; production rate limits per IP in `rate_limit`), `magic-link.ts` (`confirmLink`), `client-ip.ts` (the one trusted IP header, `CLIENT_IP_HEADER`), `schema.ts`, `session.ts`, `social-providers.ts` |
| `account` | `index.ts`: `beforeDeleteUser` throws `LiveSubscriptionError` while a subscription is live; `afterDeleteUser` deletes the user's stored files, and the `apikey` rows (no foreign key) and `images/<userId>/` files left from dropped features. A new module that stores a user's files adds itself here, not to `auth` |
| `admin`  | `access.ts` (`isAdmin`, `ADMIN_EMAILS`), `users.ts`, `credits.ts` (`addCredits`, idempotent per request ID), `orders.ts`, `metrics.ts` (users, credits, orders, revenue, paid orders and revenue by the buyer's first-touch source, video outcomes, median and p95 time and top failures, and model costs from `videoCosts`, over a window) |
| `alerts` | `index.ts` (`sendAlert`, `checkFailureRate`, `checkProviderError`), `config.ts` (thresholds, `PROVIDER_BALANCE_CODES`), `schema.ts` (`alert`: when each kind last went out). [Alerts](#alerts) |
| `analytics` | `index.ts` (`capture`, `userInitialProperties`): server events to PostHog. `first-touch.ts` (`readFirstTouch`, `initialProperties`): reads the `rs_ft` cookie. [Product analytics](#product-analytics) |
| `ai`     | `video/`: `dashscope.ts` (Bailian, with `DASHSCOPE_API_KEY` and `DASHSCOPE_BASE_URL`): `submitReferenceVideo`, a wan2.7-r2v video of a prompt that stars the subject of a photo, and the `VideoProvider` (`types.ts`) that polls its tasks. `video/index.ts`: `getEffectVideoProvider` submits; `getVideoProvider(id)` returns the poller a row's provider names, or null for a dropped provider (`fal`, `seeapi`) |
| `credits` | `index.ts` (`getBalance`, `listTransactions`, `usedIdempotencyKeys`, `grantCredits`, `spendCredits`, `spendUpTo` (spends at most the balance); the last three take an optional `tx`), `schema.ts` (balance + ledger), `config.ts` (`signupCredits`, 0: new accounts start with none) |
| `feedback` | `index.ts` (validate, submit idempotently, paginate for admins), `schema.ts`, `config.ts` |
| `email`  | `client.ts` (Resend or console), `templates/` (magic link; failed charge and ended subscription, linking to `/billing`; video ready or failed, sent only when the sweep settles it) |
| `health` | `index.ts`                                               |
| `ratelimit` | `index.ts` (`hitLimit`): fixed-window counter per key in `rate_limit`, one upsert per hit. Keys start with `api:` |
| `indexnow` | `index.ts` (`submitUrls`: posts one host's URLs to `api.indexnow.org` in batches of 10,000 with `INDEXNOW_KEY`) |
| `log`    | `index.ts` (`log.debug/info/warn/error`): one line per event, `<area>.<what happened>`, JSON in production. Server code never uses `console.*`. `onErrorLogged` lets a tracker see errors. [runbook § Logs](runbook.md#logs) |
| `monitoring` | `index.ts`: Sentry, off unless `NEXT_PUBLIC_SENTRY_DSN` is set. `src/instrumentation.ts` starts it; the browser starts its own in `src/instrumentation-client.ts` |
| `cron`   | `index.ts` (`isCronRequest`, `sweepPending`): settles pending videos, grants yearly months and deletes uploads past `UPLOAD_RETENTION_MS` (`expireUploads`), for `/api/cron/*` (`GET` from Vercel Cron per `vercel.json`, or `POST`). The tasks run independently; any failure is logged and the route returns 500 without skipping the others. Then `checkFailureRate` runs, whatever failed |
| `generations` | `columns.ts` (`generationColumns`, shared by every kind's table), `index.ts` (`lifecycle`, typed on those columns only). `start` inserts the pending row and spends credits in one transaction, then fails and refunds if submitting throws. Failing sets the status and refunds in one transaction; only the call that changed the status refunds. `refresh` polls the provider, stores the result and notifies. `sweep` fails at most 100 lost jobs per run, oldest first, then polls a batch, least recently checked first, 4 at a time. A kind (`GenerationKind`) supplies its name, table, job ID column, cost, poll, output type and notifications. The credit keys (`<kind>:<id>`, `<kind>-refund:<id>`) and reasons are fixed: jobs in flight during a deploy rely on them `unwatched` (optional) runs once when the sweep settles a job, as no page was open: videos email the owner |
| `videos` | `index.ts` (create a photo effect video, refresh, get, download URL, list, page, count, metrics, costs, sweep, delete), `schema.ts`, `config.ts` (`REFERENCE_COST_PER_SECOND` dollars per second by resolution, photo limits, page size), `photo-effects.ts` and `tiptoe.ts` |
| `notifications` | `index.ts` (`notify`, `pageNotifications`, `unreadCount`, `markRead`), `schema.ts` (`notification`), `types.ts` (`NotificationContent`), `config.ts` |
| `env.ts` | `validateEnv` / `assertValidEnv` check every variable in [runbook § Environment variables](runbook.md#environment-variables) at server start. `requireEnv(name)` reads a checked variable |
| `payment` | `orders.ts`, `subscriptions.ts` (`offeredPlans`, events, portal, `grantYearlyMonths`), `refunds.ts` (`applyRefund`), `emails.ts` (logs a failure instead of failing the webhook), `webhook.ts`, `packs.ts`, `plans.ts`, `periods.ts`, `schema.ts` (`order`, `subscription`), `providers/` (one file per `PaymentProvider`, IDs in `PROVIDER_IDS`) |
| `moderation` | `index.ts` (`ContentBlockedError`, `ModerationUnavailableError`). `image.ts` (`checkImage`): with `IMAGE_MODERATION=seeapi`, checks a photo effect's stored photo with SeeAPI before it spends credits; fails closed. Photo effects take no prompt, so nothing checks text |
| `storage` | `index.ts` (`putObject`, `signedUrl`, `deletePrefix`): S3-compatible client for a private bucket |

Credits are whole numbers and don't expire. Every change needs an idempotency key, so a retry never applies twice. `spendCredits` throws `InsufficientCreditsError` instead of going below zero. Auth grants `signupCredits` once per new user; it is 0, so signing up writes no ledger row. `/billing` shows the balance, the newest 50 ledger rows, packs, a subscriber's subscription and orders; give a new `reason` a label under `Credits.reasons` in `messages/*.json`.

### Videos

Videos run on the `generations` lifecycle. The `image` table is left from text-to-image, which the app dropped. Every new video is a photo effect.

1. `POST /api/videos/<kind>` validates the photo, the quality and the consent (below) before anything is stored or spent. The photo must be JPEG, PNG or WebP by its first bytes. Its pixel size, read from the header (`image-size.ts`), must fit `EFFECT_IMAGE_LIMITS`, or the route answers 400 `INVALID_IMAGE_SIZE`; a header that can't be read is 400 `INVALID_REQUEST`. The forms check the same limits in the browser with `createImageBitmap` when a photo is picked (`src/lib/image-limits.ts`), on the file they will send. Missing credits return 402 and record nothing.
2. It spends the effect's credits with the key `video:<id>`, inserts a `pending` row and submits the job. The photo is stored as `videos/<userId>/<id>.<ext>` and goes to Bailian as a one-hour signed URL, so the bucket must be reachable from the internet. It returns at once.
3. The client polls `GET /api/videos/<id>` (every 5 s, with `usePendingPoll`), which stops on 401, drops the item on 404, backs off up to a minute on server errors and pauses in hidden tabs. When the job finishes, the server copies the result to `videos/<userId>/<id>.mp4` (Bailian deletes results after 24 hours) and marks the row `succeeded`.
4. A failed submission or job marks the row `failed` and refunds with `video-refund:<id>`. Bailian's moderation (`DataInspectionFailed`, `IPInfringementSuspect`) returns 422 `CONTENT_BLOCKED`, other submission failures 502. If the provider or storage can't answer during a poll, the row stays `pending`.

Each row records its provider, resolution and credits spent. New rows name `dashscope`. Older rows may name `fal` or `seeapi`, from the image-to-video generator the app dropped (`POST /api/videos`, `VIDEO_PROVIDER`); production had none. `getVideoProvider` has no poller for them, so such a row still pending fails on its next poll, or the sweep's, with `Provider <id> was removed`, and refunds like any failed job. Their 5- or 10-second rows still list, play and download.

The photo effects are videos too: one photo and the effect's prompt become a video that stars the photo's subject, with generated music. `PHOTO_EFFECTS` (`src/server/videos/photo-effects.ts`) lists them; the tip-toe dance (`tiptoe.ts`) is the only one. Its definition has `kind`, `title` (the row's prompt column), `photos` (1), `duration` (seconds), `credits`, `prompt` (it calls the photo's subject "Image 1"), `resolution` and an optional `pro` (a resolution and its credits). `createEffectVideo` and `effectOptions` take the kind. `POST /api/videos/<kind>` (multipart: `image1` and `consent=yes`) is the `POST` of `src/app/api/videos/[id]/route.ts`: the segment is the effect's kind there, and any other segment is 404. Each photo is JPEG, PNG or WebP up to 4 MB (`EFFECT_MAX_IMAGE_BYTES`) and fits `EFFECT_IMAGE_LIMITS` (at least 240 pixels a side). `createEffectVideo` stores it as `videos/<userId>/<id>.<ext>` and sends a signed URL of it, the prompt, the resolution, the ratio and the duration to `getEffectVideoProvider` (Bailian wan2.7-r2v). The row's provider is `dashscope`, so polling, the sweep, the library and refunds treat it like any video. Without Bailian or storage, `effectOptions` reports the effect off and `createEffectVideo` throws `VideosDisabledError`. An effect with `pro` also sells the Pro quality: the tip-toe dance costs 10 credits at 720P and 20 at 1080P, both 12 seconds. The route takes an optional multipart `quality`, `standard` (the default) or `pro` (`VIDEO_QUALITIES`); any other value, or `pro` for an effect without it, is 400 `INVALID_REQUEST` before anything is stored or spent. An effect with `preview` also makes one free take per account: `quality=preview` costs 0 credits (the lifecycle neither spends nor refunds a free job) and sends the preview's prompt, resolution and seconds (the tip-toe dance: 720P, 5 s) with Bailian's watermark. The row has `preview = true`; a partial unique index (`video_one_preview_idx`, one per user where `preview` and the status isn't `failed`) refuses a second, so a failed preview can be retried and two at once can't both pass. `createEffectVideo` checks first, before anything is stored, and maps the index's refusal to `PreviewUsedError`; the route answers 409 `PREVIEW_USED`. So is an optional `ratio` other than `16:9` (the default) or `9:16` (`VIDEO_RATIOS`), at the same price; the row keeps it in `ratio` (`16:9` on older rows) and Bailian gets it. So is a missing `consent=yes`: the user confirms, that the photo is theirs or that the adult in it agreed: in a required checkbox on `EffectGenerator`, and on `TiptoeTryout` by pressing its button, under which a note says so. `createEffectVideo` stores that time in the row's `consented_at` (null on older rows). `effectOptions` reports `credits` and `proCredits` (null without Pro). The row stores what was spent in `credits` and the resolution, lowercase (`720p`, `1080p`). The UI, which may not import `src/server`, reads the kinds and their number of photos from `PHOTO_EFFECT_KINDS` (`src/lib/photo-effects.ts`): the sidebar, the analytics routes and `EffectGenerator` (`src/components/videos/effect-generator.tsx`). Their copy is `PhotoEffects` in `messages/*.json`: shared keys, plus `kinds.<kind>` for each effect's title, photo label and hint (`useEffectMessages`, `src/components/videos/effect-messages.ts`). `src/test/photo-effects.test.ts` checks that the two lists match and every locale has the copy.

Photo sizes have two limits (`src/server/videos/config.ts`). A visitor may pick a photo up to 5 MB (`EFFECT_MAX_PICK_BYTES`), which the copy states (hints, FAQ, guides, `llms.txt`). The server takes at most 4 MB (`EFFECT_MAX_IMAGE_BYTES`): Vercel refuses a function request body over 4.5 MB, and the rest of the multipart body needs room. `usePhotoPicks`, shared by `TiptoeTryout` and `EffectGenerator`, drops a pick over 5 MB at once (`errors.invalid`). It then calls `shrinkPhoto` (`src/lib/shrink-photo.ts`): if the photo's long side is over 2,048 pixels or the file is over 4 MB, the browser draws it on a canvas (`OffscreenCanvas`, else `<canvas>`) as a JPEG at quality 0.9, its long side at most 2,048 pixels (`fitWithin`, never larger), with the original name ending in `.jpg`. It decodes with `createImageBitmap` and `imageOrientation: "from-image"`, else `<img>`, so EXIF orientation is applied either way. If decoding or encoding fails, or the JPEG isn't smaller, the photo stays as picked. The result is the file previewed, checked against the pixel limits, saved in the draft and sent; one still over 4 MB is dropped (`errors.tooLarge`). The side stays empty until this finishes, and only the latest pick per side is kept.

Older rows come from features the app dropped: the rap duo, the zombie couple, hug and raindance duo (two photos, 15 s, `TWO_PHOTO_DURATION`; the second photo is `<id>-2.<ext>`, which `expireUploads` still deletes), the vampire transformation and object effects. Some have a poster frame (`poster_key`); `posterUrl` signs it and the player shows it before `imageUrl`. Nothing cuts posters any more.

`/videos` redirects to `/videos/tiptoe` (`next.config.ts`). `/videos/<kind>` shows a photo effect's form and recent videos (the `[id]` page, which checks `PHOTO_EFFECTS` first); it picks photos through `usePhotoPicks` (`src/components/videos/use-photo-picks.ts`). `/videos/library` pages videos 24 at a time (`?page=N`); a page past the last is 404. `/videos/<id>` shows one video and calls `refresh` once, so opening it collects a finished job; if the provider or storage fails, it shows the stored row. Another user's video or an unknown ID is 404.

The home page makes the tip-toe dance from start to finish. `TiptoeTryout` (`src/components/home/tiptoe-tryout.tsx`), right under the hero's headline, keeps to three controls: one photo (`usePhotoPicks`), Standard or Pro with each price, and one button that shows the price picked. A note under the button says pressing it confirms consent, and a link under that makes the free preview. Every video is Vertical (9:16); a draft saved with 16:9 keeps it. It posts to `/api/videos/tiptoe` with the photo, `quality` and `ratio`, polls with `usePendingPoll` every 5 s and plays the result in place, with Download and Share (the Web Share API, else the home URL copied). It reads the session in the browser (`authClient.useSession()`), so the page stays prerendered. A signed-out visitor, or a 401, saves the photo, the consent, the quality and the ratio with `savePhotoDraft` (`src/lib/photo-draft.ts`; IndexedDB, kept an hour) and signs in from a dialog that returns to `?try=1`. Back on the page, the draft comes back and goes out once the session is known; without a session, the dialog opens again. A 402 shows the price picked and the packs (`packs` prop), with the smallest that pays for the quality picked selected (Standard: small, Pro: medium), and one pay button. Paying saves the draft the same way and calls `redirectFrom` (`src/components/billing/redirect.ts`) with `returnTo: "home"`, so checkout returns to `?checkout=success&try=1#generator` (or `checkout=cancel`). After a success, the page waits for the webhook's credits: it sends the draft, and while that answers 402 sends again every 3 s, 30 tries, then says the payment is still processing and leaves the form ready. A 402 makes no video, and one send runs at a time, so the payment makes one video. After a cancel, the draft and the packs come back and nothing is sent. `homeFacts` (`src/app/_lib/home-facts.ts`) gives the page both prices, the packs (the FAQ states their dollar prices), the photo limits and whether the effect is on, at build time; `videoPrices` gives the pricing and billing pages the two prices. The home page has no `CreditsProvider`, so it shows no balance.

`GET /api/videos/<id>/download` redirects to a signed URL with `Content-Disposition: attachment`; a missing or foreign video returns 404 `VIDEO_NOT_FOUND`. The bucket is private: pages get one-hour signed URLs. Jobs nobody polls, or that a crash left unsubmitted, wait for the [pending sweep](runbook.md#pending-sweep), which settles them and gives up on videos after a day.

### Notifications

Modules call `notify(userId, key, { type, data })` for events outside the user's view. The key column is unique, so a retry or race stores one row. `notify` logs errors instead of throwing, and returns `true` only for a new row, so a caller that also emails sends once.

| Type | Sent by |
| ---- | ------- |
| `video_succeeded` | The lifecycle's `refresh`, from the call that marks the row `succeeded` |
| `video_failed` | The lifecycle, from the call that marks the row `failed`. `data.credits` is the refund |
| `order_paid` | `fulfillOrder`, after granting a pack. Key `order:<id>` |
| `subscription_paid` | `applySubscriptionEvent`, per charge. Key `subscription:<provider>:<payment id>` |
| `subscription_past_due` | `applySubscriptionEvent`, once per period: `subscription:<id>:past_due:<period end>` |
| `subscription_ended` | `applySubscriptionEvent`, when a live subscription becomes `canceled` or `expired`. An abandoned checkout sends nothing |
| `credits_added` | `addCredits` (key `admin:<request id>`) and `grantYearlyMonths` (key `subscription:<id>:<period end>:m<month>`) |

Rows store type and data, not text. No page shows them; only `GET /api/notifications` and `POST /api/notifications/read` read them. The types `image_succeeded`, `image_failed` and `broadcast` stay for older rows; nothing sends them now. To add a type, update `NOTIFICATION_TYPES` and `NotificationContent` (`types.ts`) and `AppNotification` (`src/lib/api.ts`).

### Feedback

Signed-in users open `/feedback` from the fixed bottom-right link in the signed-in layout and submit text, images, or both. Images can be selected or pasted into the feedback form; both share preview, removal and validation. Text is at most 2,000 characters; images are at most three JPEG, PNG or WebP files totaling 4 MB, checked by their first bytes. `POST /api/feedback` accepts multipart `message`, `requestId` and repeated `images` fields (JSON text submissions still work); `withSession` checks the session and Origin and limits each user to five requests a minute. A transaction advisory lock and unique `(user_id, request_id)` index make concurrent retries return the saved feedback without uploading twice. Each attempt uses unique object keys; failed attempts delete their uploads. The form retains text, images and the request ID after a failed request.

`src/server/feedback/` owns validation, storage and pagination. Feedback rows and the private `feedback/<userId>/` storage prefix are deleted with the account. Only admins can read `/admin/feedback`, which shows the full message, account name, email and submission time, newest first, 20 per page. Thumbnails and full-size links use `/api/admin/feedback/[id]/images/[index]`, which checks admin access before issuing a one-hour signed URL with a non-cacheable redirect. Without storage, text feedback still works and image submissions return `FEEDBACK_STORAGE_DISABLED`.

### Payments

`PAYMENT_PROVIDER` (`stripe` or `waffo`) picks the provider for new checkouts. Each order and subscription records its provider, and every provider's webhook stays on, so only the provider that took it can change it.

Only credit packs are on sale (`CREDIT_PACKS`, `src/server/payment/packs.ts`): small, 10 credits for $4.99 (one tip-toe video; `DEFAULT_PACK_ID`, which `/pricing` and `/billing` recommend); medium, 20 for $7.99 (one Pro video or two videos); large, 30 for $11.99 (three videos). The pages state what each pack buys from the tip-toe prices. `margins.test.ts` checks that every pack sells each photo effect quality (`REFERENCE_COST_PER_SECOND`) for at least 1.5 times its cost.

1. `POST /api/payment/checkout` (`{ packId, locale, returnTo? }`) records a pending `order` and returns the provider's checkout URL. A refusal fails the order. `returnTo: "home"` returns the buyer to the home generator (`/<locale>?checkout=success|cancel&try=1#generator`); anything else, URLs included, returns to `/<locale>/billing?checkout=success|cancel`. Both use the `BETTER_AUTH_URL` origin.
2. The provider calls `/api/webhooks/payment/<provider>`, which verifies the signature and maps the event to `paid`, `expired` or `failed`.
3. `paid` grants credits with `order:<id>`, then marks the order paid, so repeats and crash retries grant once. A payment for a failed or expired order still completes. An unknown order answers `409 UNKNOWN_ORDER`, so the provider retries.

Subscriptions aren't sold: `PLANS_ON_SALE` (`src/server/payment/plans.ts`) is empty, so `offeredPlans` returns no plan, no page shows one, and `POST /api/payment/subscribe` answers 400 `UNKNOWN_PLAN` for every plan. The code below stays for subscriptions already bought: renewals, webhooks, refunds, the portal and the billing card, which shows only to a subscriber. List a plan's ID in `PLANS_ON_SALE` to sell it again.

Subscriptions bill monthly or yearly (`interval`) and grant the plan's credits every paid month; unused credits carry over.

1. `POST /api/payment/subscribe` records a pending `subscription` and opens a checkout. Under a per-user advisory lock, a user has at most one live subscription (`active`, `canceling`, `past_due`) and one open checkout. A refusal expires the row.
2. Each charge (Stripe `invoice.paid`, Waffo `subscription.payment_succeeded`) grants credits with `subscription:<provider>:<payment id>`; for a yearly plan, that is the first month.
3. The sweep's `grantYearlyMonths` grants each later month of an `active` or `canceling` yearly plan as it begins: month `k` starts `k` calendar months after `currentPeriodEnd` minus a year. The key `subscription:<id>:<period end>:m<k>` makes it idempotent. Stripe prices intervals inline; Waffo needs `WAFFO_SUBSCRIPTION_YEARLY_PRODUCT_ID`, or `offeredPlans` hides yearly plans.
4. Status events update `status` and `currentPeriodEnd` on the row locked `FOR UPDATE`. `canceled` and `expired` are final; an event for an earlier period changes nothing.
5. Users cancel, change cards and get invoices in the provider's portal (`POST /api/payment/portal`).
6. Account deletion fails with `ACTIVE_SUBSCRIPTION` while a subscription is live.

Refunds and chargebacks (Stripe `charge.refunded` and `charge.dispute.funds_withdrawn`, Waffo `refund.succeeded`) become a `RefundEvent` for the order or subscription the charge paid. Stripe charges carry neither ID, so `parseWebhook` (async) looks up the payment intent's Checkout Session, then its invoice. `applyRefund` takes back the refunded share of the charge's credits (a yearly charge counts twelve months) with `spendUpTo`, keyed `refund:<provider>:<refund id>` and reason `refunded payment`. It takes at most the balance and logs the rest as `payment.refund_shortfall`. A refund that matches no paid order or subscription logs `payment.refund_unmatched` and answers 200.

To add a provider, implement `PaymentProvider` in `src/server/payment/providers/<id>.ts`, add its ID to `PROVIDER_IDS`, register it in `providers/index.ts` and require its keys in `crossChecks` in `src/server/env.ts`.

## Target structure

Planned directories, merged with what exists. Create each planned one in the slice that first needs it.

```
content/                   # Git-managed content: templates/, prompts/, blog/, legal/
public/                    # og/, posters/, samples/
scripts/                   # seed-templates.ts, generate-posters.ts
src/
  app/
    [locale]/              # every page under a locale prefix
      (marketing)/         # SSG pages: templates, create/[slug], prompts, blog, what-is, pricing, about, contact
        (legal)/           # more pages: safety, copyright, delete-my-data
        (auth)/            # sign-in
      (dashboard)/         # signed-in area: dashboard (redirects to videos), videos, billing, feedback, profile, admin; later projects
    api/                   # auth, videos, notifications, feedback, cron, admin, payment, webhooks/payment
    sitemap.ts, robots.ts, llms.txt/, indexnow.txt/
  components/              # ui, layout, home, auth, account, dashboard, videos, credits, billing, feedback, admin, legal, blog, pricing; later templates, projects, seo
  server/                  # env.ts, db, auth, account, admin, alerts, analytics, credits, ai, generations, videos, cron, notifications, storage, payment, email, health, indexnow, log, monitoring, moderation, ratelimit, feedback
  lib/                     # api, auth-client, content, utils; later seo, watermark
  i18n/                    # routing, request, navigation
  hooks/
  test/
  types/
  proxy.ts
```

### Product analytics

`src/server/analytics` sends explicit signup, generation and verified payment events to PostHog with bounded, best-effort HTTP calls. In the browser, `src/lib/analytics.ts` is the one sender: it keeps the anonymous ID, and `track` sends the home generator's funnel events. `src/components/layout/posthog.tsx` uses it for sanitized page routes and `$identify`. Every event attaches `app=windowpeeper`, as the PostHog project is shared. See [PostHog operations](runbook.md#posthog) for the event contract and delivery limits.

| Event | Sent by |
| ----- | ------- |
| `$pageview`, `$identify` | `PostHogPageviews`, on navigation and once the session is known |
| `photo_selected`, `generate_clicked`, `paywall_viewed`, `checkout_clicked`, `video_downloaded`, `video_shared` | `TiptoeTryout`, from each action's handler, so once per action |
| `signup_completed` | Auth's `user.create.after` hook |
| `checkout_started`, `payment_succeeded` | `payment/orders.ts` and `payment/subscriptions.ts` |
| `generation_started`, `generation_succeeded`, `generation_failed` | The `generations` lifecycle |

First touch: on each page load, `Analytics` (`src/components/layout/analytics.tsx`) calls `recordFirstTouch` (`src/lib/first-touch.ts`), which records the first visit's referrer host and path, UTM tags, landing path, language and time once, in `localStorage` and the `rs_ft` cookie, PostHog or not. The request that creates an account carries the cookie (the magic link and Google's callback are top-level GETs, and the cookie is `SameSite=Lax`), so Better Auth's `user.create.before` hook reads it (`readFirstTouch`, `src/server/analytics/first-touch.ts`, which checks every field again) and stores it in the user's `first_*` columns. They are `additionalFields` with `input: false` and `returned: false`: only the server sets them, and the session never returns them. Browser events, `signup_completed` and `payment_succeeded` send them as PostHog's `$initial_*` person properties with `$set_once`. The two `initialProperties` (browser and server) must agree. `/admin/metrics` groups paid orders by the source: `utm_source`, else the referrer's host, else `direct`.

### Alerts

`src/server/alerts` tells the operators about two problems, each at most once an hour: the claim is one upsert on the `alert` row of its kind, so concurrent sweeps send one. The sweep calls `checkFailureRate` (videos finished in the last hour, by `completed_at`). The lifecycle's `fail` calls `checkProviderError` with the provider's error code (`VideoGenerationError` from a submission, or the `code` of a failed job), and a code in `PROVIDER_BALANCE_CODES` alerts at once. Delivery is email to `ADMIN_EMAILS` and `ALERT_WEBHOOK_URL`; neither logs only. Alerting never throws. Thresholds, codes and setup: [runbook § Alerts](runbook.md#alerts).
