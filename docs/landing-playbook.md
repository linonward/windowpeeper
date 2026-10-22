# Landing Playbook

How to turn one search query into a page that ranks and converts. Use it for every new video effect. Code layout is in [`architecture.md`](architecture.md); the PR flow is in [`workflow.md`](workflow.md).

A new effect ships in two steps:

1. **Generation first.** Add the photo effect ([`runbook.md` § Add a photo effect](runbook.md#add-a-photo-effect)): its file and prompt, its entry in the two lists and its dashboard copy. Deploy, then check it on real photos until the result is good. This step proves the effect works.
2. **Landing page and guide later.** Follow the checklist below in a separate PR. It is content for search, and it needs a real result from step 1.

## Principles

1. **One query, one page.** Each effect gets its own landing page for one search query, a blog guide for the same query, and links from the rest of the site.
2. **Show only real results.** Every image and video on the page comes from a real generation. The copy describes what that result shows. If copy and result disagree, change the copy. Don't pair frames and a video from different results.
3. **Let visitors use the page.** The form sits in the hero. Visitors pick photos before they sign in. Sign-in happens in a dialog on the same page, and the job sends itself on return. No button leads away to `/sign-in`.
4. **No free credits.** New accounts start with none (`signupCredits` is 0; `src/server/credits/config.test.ts` pins it). The smallest pack must buy one result of every landing page, so a visitor's first payment gets a video.
5. **Measure before tuning.** Pageviews, business events, checkout conversion and model cost are tracked. Check `/admin/metrics` and PostHog after each change.
6. **Guard the spend.** With `IMAGE_MODERATION` on, photos are screened before credits are spent. If free credits ever return, write down the cost per signup and how to spot mass signups.

## Guides

Guides are text pages for searches about the meme itself, not about one effect: `/tip-toe-in-my-jordans`, `/rumpelstiltskin-meme` and `/how-to-make-rumpelstiltskin-video`. They have no form; their calls to action lead to the home generator (`/<locale>#generator`). Add one as [`runbook.md`](runbook.md) describes under the legal pages. Keep their claims about the original viral clip general: no dates, creators or view counts. Name no brand, artist or song in the body; a meme's nickname may appear only in its own page's title and h1 (`guides.test.tsx` checks it).

## Checklist for a new landing page

Start when the effect is live at `/videos/<kind>` and has a good real result.

### Query and copy

- [ ] Pick one query. The page path is the query (`/ai-dance-video`).
- [ ] Title: `<Query>: <benefit> | AIRumpelstiltskinVideo`, 50–60 characters, so the query itself stays within 35. Description: 120–155 characters. Chinese follows the same shape.
- [ ] One H1 that holds the query. The FAQ H2 names the query (`AI dance video questions`). Leave the other H2s natural.
- [ ] Copy in `messages/en.json` and `messages/zh.json`, under the page's own namespace (`DanceLanding`).

### Real result

- [ ] Pick a real result from step 1, made from photos of AI-generated people.
- [ ] Add `public/landing/<kind>/`: `frames.jpg` (four frames, 1440×640), `preview.jpg`, `sample.mp4` and `poster.jpg`.
- [ ] Compress the video: H.264 + AAC, `-movflags +faststart`, 540×960 (portrait) or 960×540 (landscape), under 2 MB:

  ```sh
  ffmpeg -i in.mp4 -vf scale=540:-2 -c:v libx264 -preset slow -crf 27 -pix_fmt yuv420p \
    -c:a aac -b:a 96k -movflags +faststart public/landing/<kind>/sample.mp4
  ffmpeg -ss 1.5 -i public/landing/<kind>/sample.mp4 -frames:v 1 -q:v 4 public/landing/<kind>/poster.jpg
  ```

- [ ] Compare `frames.jpg` with frames cut from `sample.mp4`. Write the caption, alt text and video label from what they show, with timings.

### Page

- [ ] Route `src/app/[locale]/(marketing)/<path>/page.tsx` and `opengraph-image.tsx`.
- [ ] Build the hero form. No shared landing components exist now: `EffectLanding`, `LandingTryout` and `MoreEffects` were removed with the old effect pages. The home page's `TiptoeTryout` (`src/components/home/tiptoe-tryout.tsx`) and `src/lib/photo-draft.ts` show the pattern.
- [ ] Unit tests: the H1, the form, the real video and frames, the cost, the FAQ heading, en and zh.
- [ ] E2E: the signed-out flow (pick photos, sign in in the dialog, the job starts on return).

### Links

- [ ] Add the path to `PAGES` in `src/app/sitemap.ts`, a link in `src/app/llms.txt/route.ts` and the footer, and the route name to `ROUTES` in `src/components/layout/posthog.tsx`.
- [ ] A blog guide for the same query in `content/blog/<locale>/`, linking to the landing page and back.
- [ ] Link two related guides from the page (`relatedPosts`, `src/lib/content.ts`).

### Check

- [ ] Open the production build on desktop and mobile. The video plays muted, the form works, and the layout holds.
- [ ] Check the heading outline: one H1, no skipped levels.
- [ ] After deploy, generate one real video from the live page with a new account.
- [ ] A week later, compare the page's visits, signups, generations and payments in PostHog.

## Production data

- Query first. List what a change will touch, including rows linked without a foreign key (`apikey.reference_id`).
- Get explicit approval, then run the change in one transaction and count the result.
- Test accounts (`user-<uuid>@example.com`) in production mean a test ran against the production database. Find that `DATABASE_URL` before deleting the rows.
