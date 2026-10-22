# DESIGN.md

What the code ships: tokens in `src/app/globals.css`, fonts in `src/app/[locale]/layout.tsx`, components in `src/components/`. The look comes from the design boards in `docs/design/windowpeeper.pen` (Foundation, Brand & Logo, Components and the page boards); brand exports are in `docs/design/brand/`.

Change a value here and in the code together. When they disagree, the code wins and this file is the bug. `pnpm test` fails if this file names a token `globals.css` doesn't declare, or leaves out a theme token (`src/app/design-tokens.test.ts`).

## 1. Visual Identity

**Keywords:** dark only · one lit window · lamp amber · condensed display type · mono timecodes

One lit window at night: warm light, a curious stare, no horror. A night canvas with one warm accent, lamp (2.2). Big Shoulders titles, Instrument Sans sentences, JetBrains Mono labels and timecodes (3). Timecodes like `REC ● 01:28 AM` frame every video; they are the brand's voice, not decoration. The site is dark only: there is no light theme and no theme choice.

Voice: short, plain, a little deadpan. Talk about the clip and the stare, not about AI.

## 2. Color Tokens

Tokens are plain CSS hex colors with shadcn names, declared once in `:root`. `<html>` keeps the `dark` class so shadcn's `dark:` variants apply. `@theme inline` maps each one to a Tailwind color, so `--card` is `bg-card` and `--primary-text` is `text-primary-text`. Use the utilities; don't wrap the tokens in `hsl()`. 1px borders, no drop shadows on cards; glow comes only from lamp.

### 2.1 Night neutrals

| Token | Value | Board name | Use |
|---|---|---|---|
| `--background` | `#090C13` | `w-bg` | Page background, inputs and wells inside cards |
| `--card` | `#11151F` | `w-surface` | Cards, panels, the sidebar, dialogs. Also `bg-surface` |
| `--popover` / `--secondary` / `--muted` | `#181D2A` | `w-surface-2` | Menus, quiet fills, skeletons, video placeholders |
| `--accent` | `#252B3A` | | Hover and selected fills in menus |
| `--border` / `--input` | `#252B3A` | `w-border` | Borders, input borders |
| `--border-strong` | `#353D50` | `w-border-strong` | Outline buttons, the photo zone, dialog edges |
| `--foreground` | `#F3EEE4` | `w-text` | Primary text (warm cream) |
| `--muted-foreground` | `#98A0B3` | `w-muted` | Secondary text |
| `--faint` | `#646C80` | `w-faint` | Fine print, mono labels, inactive timecodes |

Each `*-foreground` pair (`--card-foreground`, `--popover-foreground`, `--secondary-foreground`, `--accent-foreground`) equals `--foreground`.

### 2.2 Lamp (brand)

Lamp is the only accent. Use it for the main action and the lit window, nowhere else. Lamp is a fill for actions; `--primary-text` is for lamp text and icons.

| Token | Value | Board name | Use |
|---|---|---|---|
| `--primary` | `#FFB445` | `w-lamp` | Primary buttons, the checked option's border, the logo tile, step numbers |
| `--primary-hover` | `#FFC56B` | `w-lamp-hover` | Primary button hover, the logo's lit panes |
| `--primary-foreground` | `#1B1206` | `w-on-lamp` | Text and icons on lamp |
| `--primary-text` | `#FFC877` | `w-lamp-text` | Lamp text, icons, links, eyebrows |
| `--primary-soft` | `#2A1F0E` | `w-lamp-soft` | Fill of the checked option, the recommended pack, icon tiles |
| `--ring` | `#FFC877` | | Focus ring. Equals `--primary-text` |

### 2.3 Signal

| Token | Value | Board name | Use |
|---|---|---|---|
| `--rec` | `#FF4B4B` | `w-rec` | The REC dot and failed renders. Live and recording state only |
| `--ok` | `#5FD49A` | `w-ok` | Privacy notes, "Photo ready", savings |
| `--curtain` | `#8E2F38` | `w-curtain` | The logo's curtain, the account avatar |
| `--destructive` | `#DF4949` | | Errors, delete actions |

The chart tokens hold five series colors. No chart uses them yet.

| Token | Value |
|---|---|
| `--chart-1` | `#FFC877` |
| `--chart-2` | `#67E8F9` |
| `--chart-3` | `#C4B5FD` |
| `--chart-4` | `#5FD49A` |
| `--chart-5` | `#F65A96` |

### 2.4 Sidebar

| Token | Value |
|---|---|
| `--sidebar` | `#11151F` |
| `--sidebar-foreground` | `#F3EEE4` |
| `--sidebar-accent` | `#181D2A` |
| `--sidebar-accent-foreground` | `#F3EEE4` |
| `--sidebar-border` | `#252B3A` |
| `--sidebar-primary` | `#FFB445` |
| `--sidebar-primary-foreground` | `#1B1206` |
| `--sidebar-ring` | `#FFC877` |

## 3. Typography

Fonts load with `next/font/google` in `src/app/[locale]/layout.tsx`.
Next.js makes a metric-matched Arial fallback for Instrument Sans and JetBrains Mono. It has no metrics for Big Shoulders, so `src/app/globals.css` declares `Big Shoulders Fallback` (Arial at `size-adjust: 84.5%`, measured at weight 800) and the layout turns Next.js's off for it (`adjustFontFallback: false`). Measure again if the display font or the title weights change.

| Variable | Font | Use |
|---|---|---|
| `--font-display` (`font-display`) | Big Shoulders | Titles, prices, big numbers, the wordmark |
| `--font-sans` (`font-sans`, also `--font-heading`) | Instrument Sans | Body, UI, card titles |
| `--font-mono` (`font-mono`) | JetBrains Mono | Eyebrows, labels, timecodes, credit amounts, code |

| Role | Classes | Where |
|---|---|---|
| Hero H1 | `font-display font-black leading-none`, `text-[clamp(2.5rem,11.4vw,3.875rem)]`; then the tagline in `font-bold text-primary-text`, `text-[clamp(1.5rem,6.5vw,2.25rem)]`. A visually hidden " — " (`sr-only`) sits between them, so search engines and screen readers read one line | `home/hero.tsx` |
| Section H2 | `font-display font-extrabold leading-none`, `text-[clamp(2.5rem,10vw,3.5rem)]` | `home/section-heading.tsx` |
| Final CTA title | `font-display font-black`, up to 88px | `home/cta.tsx` |
| Price | `font-display font-black tabular-nums`, 52-60px | Pricing |
| H3 / card title | Instrument Sans 600, 16-22px | Steps, scenes, cards |
| Body | Instrument Sans 16px; `text-muted-foreground` for secondary text | Everywhere |
| Eyebrow | `.eyebrow`: JetBrains Mono 12px, 500, uppercase, `0.16em` tracking, `--primary-text` | Above section titles |
| Mono label | `font-mono text-[10px]`-`text-[11px] uppercase tracking-[0.1em]`-`[0.15em]`, `text-faint` | Sidebar groups, footer columns, table heads, timecodes |
| Dashboard page title | `font-display font-extrabold`, 30-40px | `dashboard/page-header.tsx`, the new video page |

`.display-tight` tightens English display text (`-0.022em`). `.legal-prose` sets legal text to line-height 1.75.

## 4. Spacing, Layout & Radius

- **Containers:** marketing sections run full width and keep a `max-w-6xl` column with `px-5 sm:px-8`. Dashboard content is `max-w-[1240px]`, centered beside the sidebar, with `px-4 sm:px-8 lg:px-12` and `gap-7`.
- **Sections:** home sections are `py-20` on phones and `py-24`-`py-28` on large screens, split by `border-t`.
- **Header:** sticky, 56px on phones, 73px from `md`.
- **Radius:** `--radius: 0.625rem` (10px). The boards' `r-sm` 6, `r-md` 10 and `r-lg` 16 are `rounded-sm`, `rounded-lg` and `rounded-xl`. The scale: `rounded-sm` 6px, `rounded-md` 8px, `rounded-lg` 10px, `rounded-xl` 16px, `rounded-2xl` 20px, `rounded-3xl` 24px, `rounded-4xl` 28px (`globals.css`, `@theme inline`).

| Element | Radius |
|---|---|
| Buttons, inputs, option rows, scene cards, video tiles | `rounded-lg` 10px |
| Cards, panels, dialogs, the viewfinder | `rounded-xl` 16px |
| Thumbnails, icon tiles, sidebar items | `rounded-sm` 6px |
| REC badge, mono tags | 4px |
| Pills, avatars, radios | `rounded-full` |

## 5. Effects

| Effect | Classes |
|---|---|
| Sticky header | `border-b bg-background/80 backdrop-blur-xl backdrop-saturate-150` |
| Lamp glow | A radial gradient of `--primary` at 14-20% from the top: behind the hero (top right), the final CTA and the pricing head |
| Dialog overlay | `bg-[#05070b]/80 backdrop-blur-[4px]`; the dialog has `border-border-strong` and the only shadow (`0 30px 80px`) |
| Shade | Scene stills and the viewfinder fade to `--background` at the bottom (`bg-linear-to-b`) |

## 6. Components

### Buttons (`ui/button.tsx`)

| Variant | Look |
|---|---|
| `default` | Lamp: `bg-primary text-primary-foreground`, hover `bg-primary-hover` |
| `outline` | `border-border-strong`, transparent, hover `bg-muted` |
| `secondary` | `bg-secondary`, hover mixes in 5% foreground |
| `ghost` | Transparent, hover `bg-muted` |
| `destructive` | `bg-destructive/10 text-destructive` |
| `link` | `text-primary-text`, underline on hover |

Text is 14px/600. Sizes: `default` 40px, `lg` 48px (`px-[22px] text-[15px]`, 18px icons); the main call to action on a card is `h-[52px] w-full`. Buttons move down 1px while pressed. A trailing right arrow nudges on hover (`.icon-nudge`).

### REC badge (`home/rec-badge.tsx`)

A blinking `--rec` dot (`.rec-blink`) and a mono timecode on `bg-background/70`, 4px radius, `text-[11px] tracking-[0.11em] uppercase`. Above the hero H1 it has a border and `bg-card`.

### Viewfinder (`home/viewfinder.tsx`)

A 9:16 still in a `rounded-xl` frame: a bottom shade, four 18px corner marks in `foreground/80`, the REC badge at the top left and a mono caption at the bottom left (`CAM 03 · 0:14 · 9:16`).

### Option rows

Checked options (scenes, quality, packs) get a 2px `--primary` border on `--primary-soft`; others are 1px `--border` on `--background`. Radios are custom circles: a `--border-strong` ring, filled lamp when checked.

### Packs (`billing/packs.tsx`)

`packFacts` gives a pack's videos, Pro videos, price per video and its saving against the smallest pack. `PackOptions` is the radio list the buy-credits dialog, the home generator's offer and `/billing` share: name ("5-pack · 5 videos") with the lamp `Recommended` tag, "50 credits · $5.98 a video", the price in `font-display` and "Save 40%" in `--ok` mono. `PackBenefits` lists No watermark, Post anywhere, Never expire and Failed renders are free, as small notes or in lamp-soft tiles.

### Site header and footer (`layout/`)

- Header: the lockup (7.1), then a `nav` (Scenes, How it works, Pricing, Blog: `text-sm text-muted-foreground`, `/#scenes`, `/#how-it-works`, `/pricing`, `/blog`), a language menu (`LocaleSwitcher`: a bordered button with a globe and the current code, "EN"; a menu of every language in its own name, the current one checked), the Sign in link (Dashboard once signed in) and a primary "Make a video" button to `/#generator`. Below `md` the nav, the button and the languages (`LocaleLinks`) move into a sheet from the right (`layout/mobile-menu.tsx`), opened by a menu icon.
- Footer: the lockup and the independence note in `text-faint`, then three columns under mono titles (Product, Learn, Legal); a bottom bar with the copyright, the support email and the languages (`LocaleLinks`) split by dots.

### Home (`home/`)

1. **Hero** (`hero.tsx`): a lamp glow from the top right. Left: the REC badge, the H1, the body, and the generator. Right on large screens: the real example clip (`public/landing/windowpeeper/`) in a 340×604 viewfinder, with a note that its person is AI-generated. On phones a strip shows the photo, a lamp arrow and two frames instead.
2. **Generator** (`window-peeper-tryout.tsx`, `id="generator"`): a `rounded-xl bg-card` card in two numbered steps (a lamp mono number and a 14px/600 label). 01: the photo zone, a label for a hidden file input that takes clicks and drops (a lamp-soft `ImagePlus` tile, "Drop a photo or click to choose" and a faint hint; once picked, the thumbnail, the file name and "Photo ready · 2.4 MB"), then two `--ok` privacy notes. 02: the six scenes as image radios (a 64px still and the short name; the picked one has a lamp outline; on phones the row scrolls sideways). Then the consent checkbox, the full-width lamp "Make my video" button and the fine print. "Use this scene" on the page picks a scene through `SCENE_EVENT` (`scene-event.ts`). The home page makes Standard videos. Without enough credits, the button turns outline and a panel offers `PackOptions` with the recommended pack picked, a pay button, `PackBenefits` and the secure-checkout note. Back from a payment, a status row waits for the credits. Once sent, the card shows progress, then the 9:16 player with Download, Share and Make another, or the refund message and Try again. Sign-in opens in a dialog.
3. **Before / after** (`before-after.tsx`, large screens): the photo, a lamp arrow with "~3 min", three beat frames with REC timecodes, the label and a note that the example is AI-generated.
4. **Scenes** (`scenes.tsx`, `#scenes`, `bg-card`): the original large with a 2px lamp border, "The original" tag and a full-width "Use this scene" button; the other five in a grid with their timecode, name and a lamp "Use this scene" link; a "See all scenes" tile links the how-to guide.
5. **How it works** (`how-it-works.tsx`): the title on the left; three ruled rows with a 56px lamp number, a title, a body and a faint icon.
6. **Pricing** (`pricing.tsx`, `#pricing`): one card per pack: a strip of stacked frames with "×5 VIDEOS", then the name, the price, the price per video and a buy button (`BuyPack`: lamp on the recommended card, outline on the others); the recommended card is lamp-soft with a lamp border. Above the cards, `CheckoutNotice` after a checkout. `PackBenefits` in a bar, the CTA and a link to `/pricing`.
7. **Shot list** (`shot-list.tsx`): a track with a lamp progress bar over the first three beats, then five beats (mono timecode, display title, body). A ruled list on phones.
8. **FAQ** (`faq.tsx`): the title on the left; ruled `<details>` rows, the first two open, with a plus that turns lamp and 45° when open (`.icon-turn`).
9. **Final CTA** (`cta.tsx`): a lamp glow, the REC badge, the big title, a line and the lamp button up to the generator.
10. **Sticky bar** (`sticky-cta.tsx`, phones): once the generator scrolls out of view, a `bg-card/95` bar at the bottom with the price and "Make my video".

The scene stills and the before/after frames in `public/landing/` are AI placeholders from the design boards, not results made with the product. Replace them with frames of real videos.

### Pricing (`pricing/pricing.tsx`)

A centered head over a lamp glow, three plan cards (mono name, 60px price, credits, who it's for, three checked lines, a buy button; the recommended card is lamp-soft and comes first on phones), the cost table (mono head, Standard and Pro rows, credits in lamp mono) and three promises in lamp-soft tiles.

### 404 (`app/[locale]/not-found.tsx`)

The "ERROR 404" eyebrow, "This window is dark." in a 72px black display title, a line and two buttons (lamp "Make a video" to the generator, outline "Go to the home page"). On large screens a 270px viewfinder on the right shows a scene still at 30% brightness, "REC 01:28:00 AM" and "CAM 404 · NO SIGNAL". Below, "Or start from a scene": four scene cards (a 5:7 still with its timecode, the name and "Use this scene") that open the generator with the scene picked (`/?scene=<scene>#generator`).

### Buy a pack (`billing/buy-pack.tsx`)

`BuyPack` is a pack's button on `/pricing` and the home page's packs: it opens checkout straight away, and checkout comes back to the same page. Signed out, a sign-in dialog opens on the page ("Sign in to buy credits"); sign-in returns with `?buy=<pack>` and checkout opens. While it opens, the button reads "Opening checkout…"; a checkout that can't start shows a `text-destructive` line under it. `CheckoutNotice` is a `bg-card` status row above the packs after a checkout: "Payment received…" with a lamp "Make a video" link to the generator, or "Checkout canceled…".

### Buy credits (`billing/buy-credits.tsx`)

The dashboard's one dialog, opened through `useBuyCredits()` from the sidebar's credits card, the phone bar's balance pill and the generator. A 36px display title, the balance and what it buys, `PackOptions`, the balance after the purchase in a `--background` well, a lamp pay button, `PackBenefits` and the secure-checkout note. `/billing` shows the same list on the page.

### Guides (`guides/guide-page.tsx`) and Blog (`blog/`)

They keep their structure on the new tokens: `.eyebrow`, display titles, base cards (`rounded-xl border bg-card p-5`), the home page's Final CTA.

## 7. Iconography

- `lucide-react` only; ESLint blocks other icon libraries.
- Stroke width 1.75, set once on `svg.lucide` in `globals.css`.
- Sizes: 16px in buttons (18px in `lg`), 18px in sidebar items, 20-22px in tiles.
- Icons are `aria-hidden` by default; give icon-only buttons an `aria-label`.

### 7.1 Logo

- **Simple mark** (`layout/logo-mark.tsx`): a 28-unit lamp tile (3-unit radius) with four 10-unit panes in `--primary-hover`; the lower left pane is dark (`--background`). Used under 40px.
- **Full mark** (`docs/design/brand/logo/mark@2x.png`): the window with the curtain in `--curtain` and the figure. 40px and up.
- **Lockup** (`layout/brand.tsx`): the simple mark and the wordmark in uppercase Big Shoulders 900; the name's last word ("PEEPER") is lamp.
- **Favicon and app icons** (`src/app/favicon.ico`, `icon.png`, `apple-icon.png`): the exports in `docs/design/brand/icons/`.
- **Preview image** (`src/app/_lib/og-image.tsx`): the simple mark and the name, then the title and description, on the night canvas with a lamp glow.
- **Rules:** keep one pane of clear space around the mark; don't recolor the panes, rotate the mark, add glows or outlines, or set the wordmark in another font.

## 8. Motion

Transform and opacity only, 120-200ms; `.rec-blink` is the one loop. Every class below turns off under `prefers-reduced-motion`.

| Class | Motion |
|---|---|
| `.icon-nudge` | Arrow moves 3px right when its link or button is hovered |
| `.icon-turn` | Plus turns 45° inside an open `<details>` |
| `.icon-swap` | Cross-fade and scale between two icons |
| `.rec-blink` | The REC dot fades to 20% and back every 1.6s, like a recording camera |

Cards change only their border color on hover. Hover styles apply only on devices that hover (`@media (hover: hover)`).

## 9. Dashboard

### 9.1 Layout shell

```
┌──────── 248px ────────┬────────────────── fluid ──────────────────┐
│ Lockup                │ Crumb · title                 | status    │
│ CREATE  New video     │                                           │
│         My videos  12 │ Content (max 1240px, gap 28px)            │
│ ACCOUNT Billing …     │                                           │
│ Credits card · Buy    │                                           │
│ Avatar · email · ⇅    │                                           │
└───────────────────────┴───────────────────────────────────────────┘
```

- **Sidebar** (`dashboard/app-sidebar.tsx`, shadcn `Sidebar` with `collapsible="icon"`): 248px (`SIDEBAR_WIDTH` 15.5rem), `bg-card` with a right border, 288px as a sheet on phones. The rail toggles it; the `sidebar_state` cookie keeps it collapsed or open. The header has the lockup, which leads back to the home page, and the notification bell. Groups under mono labels: Create (New video, My videos with the video count) and Account (Billing, Profile, Feedback), then Admin (Users, Orders, Metrics, User feedback, Broadcasts) for admins. Every item has an icon; the current page and the pages under it are lamp-soft, and only the page itself is `aria-current`.
- **Nav item:** `rounded-sm px-2.5 py-[9px]`, 18px icon, 14px/500 muted. Active: `bg-primary-soft text-primary-text font-semibold`.
- **Credits card:** a `--background` well with "CREDITS", the balance in a 36px display number, "= N videos" and an outline Buy credits button.
- **User menu** (`dashboard/user-menu.tsx`): the trigger is a `--curtain` avatar, the email and a faint up-down chevron. The menu holds the profile row, the credits row, Profile, Language and Sign out.
- **Phone bar** (`dashboard/mobile-trigger.tsx`): the menu icon, the lockup (to the home page), the notification bell and a lamp pill with the balance that opens the buy-credits dialog.
- **Notification bell** (`notifications/notification-bell.tsx`): a 32px muted bell with a lamp count badge (99+ past 99). It opens a 320px menu: the title and "Mark all as read", the newest five (a lamp icon, or `text-destructive` for failures and refunds; bold and a lamp dot while unread), then "View all" to `/notifications`, which lists 20 a page with Previous and Next.
- **Loading** (`dashboard/shell-skeleton.tsx`): mirrors the shell with `Skeleton` blocks. "Loading…" is for screen readers only.

### 9.2 New video (`videos/effect-generator.tsx`)

A mono crumb and the display title, with a REC badge while videos render. Then, on large screens, three numbered cards on the left (Your photo; Scene as a 3×2 grid of 120px stills with a lamp check; Quality as two option rows with their price in mono credits) and a 340px summary on the right: the picked scene's still with "SCENE 01" and its caption, the length, format, quality, cost (lamp) and balance after, the lamp button ("Make my video · 10 cr", or Buy credits when the balance is short) and the refund note. On phones the summary is a bar fixed at the bottom. Under them, the four newest videos as tiles: a 54×96 poster with a spinner, a play icon or a `--rec` warning, the scene's name, the status (a lamp progress bar while rendering) and Download MP4 or Try again.

### 9.3 Components

**Page header** (`dashboard/page-header.tsx`): a display title and description on the left, an optional action on the right; it wraps on small screens.

**Pagination** (`dashboard/pagination.tsx`): "Page N of M" in muted tabular numbers, with previous and next buttons.
