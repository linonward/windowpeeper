# DESIGN.md

What the code ships: tokens in `src/app/globals.css`, fonts in `src/app/[locale]/layout.tsx`, components in `src/components/`. The look started from SeeAPI's dark design system (seeapi.com, October 2026), with the template's own pine as the primary instead of SeeAPI's lime.

Change a value here and in the code together. When they disagree, the code wins and this file is the bug. `pnpm test` fails if this file names a token `globals.css` doesn't declare, or leaves out a theme token (`src/app/design-tokens.test.ts`).

## 1. Visual Identity

**Keywords:** dark only · pine accent · monospace headlines · developer-tool feel

Near-black canvas with one accent, pine (2.2). Mono titles, sans sentences (3). An example clip behind the hero, once there is one; a pine glow behind the final CTA (5). The site is dark only: there is no light theme and no theme choice.

## 2. Color Tokens

Tokens are plain CSS colors (hex or `oklch()`) with shadcn names, declared once in `:root`. `<html>` keeps the `dark` class so shadcn's `dark:` variants apply. `@theme inline` maps each one to a Tailwind color, so `--card` is `bg-card` and `--primary-text` is `text-primary-text`. Use the utilities; don't wrap the tokens in `hsl()`.

### 2.1 Neutrals

| Token | Value | Use |
|---|---|---|
| `--background` | `#0D0D0D` | Page background, dashboard content |
| `--foreground` | `#F3F4EB` | Primary text (warm off-white) |
| `--card` | `#171717` | Cards, panels. Also `bg-surface` |
| `--popover` | `#10110E` | Menus, popovers |
| `--secondary` / `--muted` | `#212121` | Secondary buttons, quiet fills, skeletons |
| `--accent` | `#2B2B2B` | Hover and selected fills in menus |
| `--muted-foreground` | `#A4A69B` | Secondary text |
| `--border` / `--input` | `#2E2E2E` | Borders, input borders |
| `--destructive` | `#DF4949` | Errors, delete actions |

Each `*-foreground` pair (`--card-foreground`, `--popover-foreground`, `--secondary-foreground`, `--accent-foreground`) equals `--foreground`.

A bordered card on hover mixes its border toward the text color instead of using a separate token: `hover:border-[color-mix(in_oklch,var(--border),var(--foreground)_20%)]`.

### 2.2 Brand / primary

Pine on near-black has a contrast of 2.9:1, so on dark surfaces it is a fill only. Text, icons and focus rings use `--primary-text`, which keeps the hue and reaches 8.7:1.

| Token | Value | Notes |
|---|---|---|
| `--primary` | `#1F634A` (oklch 0.45 0.08 165) | Fills: primary buttons, the avatar |
| `--primary-hover` | `#358264` (oklch 0.55 0.09 165) | Lighter than `--primary` |
| `--primary-foreground` | `#F7FBF9` (oklch 0.985 0.006 165) | Text on pine (6.8:1) |
| `--primary-text` | `#62B995` (oklch 0.72 0.1 165) | Pine text, icons, links, eyebrows, active nav |
| `--primary-soft` | `#0D2D21` (oklch 0.27 0.045 165) | Solid pine-tinted background |
| `--ring` | `#62B995` | Focus ring. Equals `--primary-text` |

For a pine tint, use `--primary-text` at low alpha (`bg-primary-text/10`); pine itself at low alpha disappears on near-black.

| Token | Value | Notes |
|---|---|---|
| `--film` | `#F0B04A` | Film amber, the projector light. Brand only: the logo's viewfinder and the preview image. Not for UI text or buttons |

### 2.3 Signal colors

Icon tiles and status accents use Tailwind's palette with a fixed recipe: background `<color>-400/12`, icon `<color>-300`. Pine tiles use `bg-primary-text/12 text-primary-text`. Lists take the colors in this order:

| Order | Signal | Also means |
|---|---|---|
| 1 | Pine | Success |
| 2 | Amber | Warning |
| 3 | Cyan | |
| 4 | Violet | |
| 5 | Pink | Negative |

The chart tokens hold the same five as chart series. No chart uses them yet.

| Token | Value |
|---|---|
| `--chart-1` (pine) | `#62B995` |
| `--chart-2` (cyan) | `#67E8F9` |
| `--chart-3` (violet) | `#C4B5FD` |
| `--chart-4` (amber) | `#FCD34D` |
| `--chart-5` (pink) | `#F65A96` |

### 2.4 Sidebar

| Token | Value |
|---|---|
| `--sidebar` | `#080908` |
| `--sidebar-foreground` | `#F3F4EB` |
| `--sidebar-accent` | `#1F1F1F` |
| `--sidebar-accent-foreground` | `#F3F4EB` |
| `--sidebar-border` | `rgb(255 255 255 / 0.08)` |
| `--sidebar-primary` | pine |
| `--sidebar-primary-foreground` | `#F7FBF9` |
| `--sidebar-ring` | `#62B995` |

## 3. Typography

Fonts load with `next/font/google` in `src/app/[locale]/layout.tsx`.

| Variable | Font | Use |
|---|---|---|
| `--font-sans` (`font-sans`, also `--font-heading`) | Geist | Body, UI, dashboard page titles |
| `--font-display` (`font-display`) | Martian Mono, then `"PingFang SC"`, `"Noto Sans SC"`, `ui-monospace` | Titles, labels, numbers. Chinese falls back to the system sans |
| `--font-mono` (`font-mono`) | Geist Mono | Code |

Pairing rule: **mono for anything that is a title, label or number; sans for sentences.**

| Role | Classes | Where |
|---|---|---|
| Hero H1 | `font-display font-bold display-tight break-keep`, centered over the hero video. The query: `text-[clamp(1.75rem,8.2vw,4.5rem)] leading-[1.05] lg:text-[4.75rem] lg:max-w-[20ch]` with a `--background` text shadow, so long words fit on one line on phones and the query takes two lines on large screens. Then the tagline: `text-[clamp(1.125rem,4.4vw,2rem)] text-primary-text`. A visually hidden " — " (`sr-only`) sits between them, so search engines and screen readers read one line with a break; the guides' h1 has the same. Both h1s hyphenate (`hyphens-auto`, then `overflow-wrap: break-word`), so a long German or Spanish word fits a 320px phone. Chinese breaks only after punctuation | `home/hero.tsx` |
| Section H2 | `font-display font-bold text-3xl sm:text-4xl leading-tight display-tight`. The FAQ title is `text-[clamp(1.5rem,8.2vw,1.875rem)]` on phones and `lg:text-[1.75rem]` in its narrow column, and the About title takes the same phone size, for the same reason | `home/section-heading.tsx` |
| Card title | `font-display text-lg font-semibold` | Home steps |
| FAQ question | `font-display font-bold text-base sm:text-lg` | `home/faq.tsx` |
| Lead | `text-lg sm:text-xl leading-8 text-muted-foreground` | Hero |
| Body | 16px Geist; `text-muted-foreground` for secondary text | Everywhere |
| Eyebrow | `.eyebrow`: 12px, 800, uppercase, `0.14em` tracking (`0.08em` in Chinese), `--primary-text` | Above section titles, footer column titles |
| Dashboard page title | `text-3xl sm:text-4xl font-black tracking-[-0.025em]` (Geist) | `dashboard/page-header.tsx` |
| Page description | `text-sm leading-6 text-muted-foreground` | Page header |
| Stat label | `text-[10px] font-bold uppercase tracking-[0.13em] text-muted-foreground` | `admin/metrics-view.tsx` |
| Small caps label | `text-xs font-semibold uppercase tracking-[0.08em]` | Badges, step numbers, footer bar |

`.display-tight` tightens Latin display text (`-0.022em`) and leaves Chinese at normal spacing. `.legal-prose` sets legal text to line-height 1.75 (1.85 in Chinese).

## 4. Spacing, Layout & Radius

- **Containers:** marketing pages, header and footer use `max-w-6xl` (1152px) with `px-5 sm:px-8`. Dashboard content uses `max-w-7xl` (1280px) with `px-5 py-8 sm:px-8 sm:py-10` and `gap-8` between blocks.
- **Sections:** home sections are `py-20` with a top border.
- **Header:** 64px (`h-16`) sticky nav.
- **Base radius:** `--radius: 0.75rem` (12px). The scale adds whole pixels to it, so every step is a whole number: `rounded-sm` 8px, `rounded-md` 10px, `rounded-lg` 12px, `rounded-xl` 16px, `rounded-2xl` 20px, `rounded-3xl` 24px, `rounded-4xl` 28px (`globals.css`, `@theme inline`).

| Element | Radius |
|---|---|
| Buttons, inputs, sidebar sub-items | `rounded-lg` 12px. Small buttons 10px |
| Cards, panels, sidebar items, icon tiles | `rounded-xl` 16px |
| Large panels (final CTA, user menu) | `rounded-2xl` 20px |
| Pills, badges, avatars | `rounded-full` |
| Skeleton blocks | `rounded-md` 10px |

Nest at least one step smaller than the container.

## 5. Effects

| Effect | Classes |
|---|---|
| Sticky nav | `border-b bg-background/65 backdrop-blur-xl backdrop-saturate-150` |
| Hero badge | `rounded-full border border-primary-text/60 bg-background/55 backdrop-blur-md`, with a `--primary-text` dot |
| Glow | `Glow` in `home/section-heading.tsx`: `radial-gradient(closest-side, var(--primary-text), transparent)`, `opacity-15 blur-2xl`. Behind the final CTA |

## 6. Components

### Buttons (`ui/button.tsx`)

| Variant | Look |
|---|---|
| `default` | `bg-primary text-primary-foreground`, hover `bg-primary-hover` |
| `outline` | Border, `bg-background` (dark: `bg-input/30`), hover `bg-muted` |
| `secondary` | `bg-secondary`, hover mixes in 5% foreground |
| `ghost` | Transparent, hover `bg-muted` |
| `destructive` | `bg-destructive/10 text-destructive` |
| `link` | `text-primary-text`, underline on hover |

Sizes: `default` 40px (`h-10 px-4`), `lg` 44px (`h-11 px-5 text-base`), `sm` 28px, `xs` 24px, icon sizes 24-36px. Text is 14px/500. Buttons move down 1px while pressed.

A `lg` primary button link with a trailing arrow uses `buttonVariants({ size: "lg" })`; a right arrow nudges on hover (`.icon-nudge`).

### Inputs (`ui/input.tsx`)

40px high, `rounded-lg`, `px-3`, `--input` border.

### Cards

Base card: `rounded-xl border bg-card p-5`. Empty states use `rounded-xl border border-dashed` with muted, centered text.

### Site header and footer (`layout/`)

- Header: `Brand` (the logo mark (7.1) and the project name in `font-display font-semibold`), then a `nav` of links to the home page's sections (How it works, Pricing and FAQ, as `/#how-it-works`, `/#pricing` and `/#faq`) and the Blog, the language menu and an account button: Sign in for visitors, Dashboard once signed in. Links are `text-sm font-semibold` and underline on hover; the account button is a primary button, `h-9 px-2.5` below `sm`. Below `md` every link but Pricing hides; below `sm` the language menu shows only its icon and the gaps shrink from 24px to 8px, so the header fits a 320px phone.
- Footer: brand and blurb, then link columns (Product, Guides, Support with the "Report abuse" link, Legal) with `.eyebrow` titles; a bottom bar with the copyright in `text-xs uppercase tracking-[0.08em]`.

### Home (`home/`)

1. **Hero:** a full-width band under the glass header (`-mt-16`), `min-h-[min(72svh,46rem)]`: an example clip, if any, plays muted in a loop behind it (`object-cover`, `aria-hidden`; its poster stays with reduced motion) under a gradient from `--background` at 45% to solid at the bottom. On it, centered: the badge, the H1, the lead in `text-foreground/80`, a `lg` primary link down to the generator ("Start with your photo", down arrow) and an outline link to `#pricing` on a glass fill (both `h-12`, stacked full width on phones), and two check items. Under the band, two columns on large screens: the generator card, then the example card; without a clip, the generator card alone, centered (`max-w-2xl`). On a laptop's first screen the generator's top shows under the band.
2. **Generator** (`window-peeper-tryout.tsx`): a `rounded-2xl` card (`id="generator"`) with a card title and short body, the photo zone (a `rounded-xl border-2 border-dashed` label for a hidden file input that takes clicks and drops: a `size-12` primary circle with a plus, "Choose a photo" and a muted hint; once picked, a `size-16` thumbnail, the file name and "Change photo"; hover tints it `--primary-text`, keyboard focus rings it), a quality radio group (`rounded-xl border p-3` option cards: Free preview across the row, then Standard and Pro side by side, each with its name in `font-display`, its price and a one-line description; the checked one gets `border-primary-text bg-primary-text/5`, native radios in `accent-primary`), a format radio group in the same cards (Widescreen 16:9 and Vertical 9:16, same price), a consent checkbox (native, `accent-primary`, the label wraps it) and a full-width `lg` primary button that shows the price picked. Errors are `text-destructive` under the button. Without enough credits, the button turns `outline` and a `rounded-xl border bg-muted/40 p-4` panel below it offers the packs: the 402 message (or a "Payment canceled" note), a radio list of `rounded-lg border bg-card p-3` rows (credits in `font-display`, what the pack buys, the price on the right; checked as the quality cards), a full-width `lg` primary pay button with the price and a `text-xs` secure-checkout note. Back from a payment, a `role="status"` row with a spinning `LoaderCircle` waits for the credits. Once a video is sent the form hides and the card shows, in place: a centered progress panel (`rounded-xl border bg-muted/40`, a spinning `LoaderCircle` in `--primary-text`), then a `<video controls>` in the video's ratio (`playerFrame`, `videos/player-frame.ts`: full-width 16:9, or a centered 9:16 frame up to `75svh`) with Download (primary), Share (outline) and Make another (ghost); or the refund message and Try again. Sign-in opens in a `Dialog` over the page.
3. **Example** (`example.tsx`): a `rounded-2xl` card beside the generator with an `.eyebrow`, a card title, the example clip from `public/landing/<name>/` (9:16, at most 36rem tall, muted autoplay loop with controls) and a `text-sm` note. It renders nothing until a clip is passed.
   Under the hero, a strip (`strip.tsx`): a `border-y` row of three uppercase `text-xs` facts split by `--primary-text` dots.
4. **Steps** (`how-it-works.tsx`): three columns under a 2px top rule, with a large mono number. The first step's rule and number are `--primary-text`.
   **About** (`about.tsx`): a section heading, then one topic per row, as on the guides: an h3 (`font-display text-lg sm:text-xl font-semibold`) in the left third on large screens and two `max-w-[65ch]` muted paragraphs with `--primary-text` underlined links to the guides, the pricing page and the generator. Rows after the first have a top border.
   **Pricing** (`pricing.tsx`, `#pricing`): a section heading and lead, the pricing page's pack cards (`pricing/pack-cards.tsx`), then the packs note and a `--primary-text` link to `/pricing`.
5. **FAQ accordion:** `<details>` rows. When a row is open, its number circle and plus button fill with `--foreground`, and the plus turns 45° (`.icon-turn`).
6. **Final CTA:** a `rounded-2xl` card with a glow, a badge, a title, a `lg` primary link back up to the generator (`#generator`, up arrow) and three `--primary-text` check items.

### Guides (`guides/guide-page.tsx`)

Header: `.eyebrow`, an h1 styled as the hero's (query, then the tagline in `text-muted-foreground`), a lead, a `lg` primary link to the home generator with a nudging right arrow and a `text-sm` price note, over a glow. Each section is a `border-t py-12` row: an h2 (`font-display text-2xl sm:text-3xl font-bold`) in the left third on large screens, then `max-w-[65ch]` muted paragraphs, a pine-marker list, or numbered steps (a 2px top rule and a mono number, pine on the first, with an h3 card title). Then a `rounded-xl border bg-card p-5` note, the other guides as base cards, and the home page's Final CTA linking to the generator.

### Blog (`blog/`)

Posts list as base cards: date, a card title (3) that links the whole card, description, tags. Tags are `rounded-full border px-2.5 py-0.5 text-xs font-semibold` links with the hover border mix. A post page shows the date, a `text-3xl sm:text-4xl` display title, the description and the tags, then the body in `.legal-prose`.

### Icon tiles

`flex size-10 items-center justify-center rounded-xl` with a signal tint (2.3) and a 20px icon.

## 7. Iconography

- `lucide-react` only; ESLint blocks other icon libraries.
- Stroke width 1.75, set once on `svg.lucide` in `globals.css`.
- Sizes: 16px in buttons (the button default), 18px in sidebar items, 20px in tiles.
- Icons are `aria-hidden` by default; give icon-only buttons an `aria-label`.

### 7.1 Logo

- **Mark** (`layout/logo-mark.tsx`): four rounded viewfinder corners in `--film` around the brand dot in `--primary-text`, which leaves a short `--primary-text/35` trail to its left: a frame, and a picture that moves. 32-unit grid, 3-unit strokes. Shown at 24px (`size-6`) next to the name.
- **Favicon** (`src/app/icon.svg`, `favicon.ico`, `apple-icon.png`): the mark on a `#0D0D0D` tile with a 7-unit radius, so it reads on light and dark browser tabs.
- **Preview image** (`src/app/_lib/og-image.tsx`): film strip perforations along the top and bottom edges, lit in `--film`; the mark and the name, then the title and description, on the dark canvas.

## 8. Motion

Transform and opacity only, 120-200ms. Every class below turns off under `prefers-reduced-motion`.

| Class | Motion |
|---|---|
| `.icon-nudge` | Arrow moves 3px right when its link or button is hovered |
| `.icon-turn` | Plus turns 45° inside an open `<details>` |
| `.icon-swap` | Cross-fade and scale between two icons |

Cards change only their border color on hover. Hover styles apply only on devices that hover (`@media (hover: hover)`).

## 9. Dashboard

### 9.1 Layout shell

```
┌──────── 256px ────────┬────────────────── fluid ──────────────────┐
│ Brand · ‹             │ Page header: title + description | action │
│                       │                                           │
│ Nav items             │ Content (max-w-7xl, gap 32px)             │
│                       │                                           │
│ User menu (avatar)    │                                           │
└───────────────────────┴───────────────────────────────────────────┘
```

- **Sidebar** (`dashboard/app-sidebar.tsx`, shadcn `Sidebar` with `variant="inset"` and `collapsible="icon"`): 256px (`SIDEBAR_WIDTH` 16rem), 48px collapsed, 288px as a sheet on phones. Background `--sidebar`. The `sidebar_state` cookie keeps it collapsed or open. Links sit in groups: "Create" (the video generator, which opens the first photo effect, then each photo effect and the video library) and "Account" (credits and billing) under a `SidebarGroupLabel`, then Admin for admins. Labels hide when the sidebar is collapsed.
- **Nav item:** `h-10 rounded-xl px-3`, 18px icon. Active: `bg-primary-text/10 text-primary-text`. Sub-items: `h-8 rounded-lg`; active changes only the text color and weight.
- **Content panel:** `bg-background`; on desktop it sits on the sidebar color, inset with `m-2 rounded-xl shadow-sm`.
- **Phone bar** (`dashboard/mobile-trigger.tsx`): a 36px menu button and the brand.
- **Loading** (`dashboard/shell-skeleton.tsx`): mirrors the shell with `Skeleton` blocks (`animate-pulse rounded-md bg-muted`). Inside a page, `dashboard/page-skeleton.tsx` outlines the content (and the page header with `header`), and `admin/list-skeleton.tsx` outlines admin lists. "Loading…" is for screen readers only.

### 9.2 Components

**Page header** (`dashboard/page-header.tsx`): title and description on the left, an optional action on the right; it wraps on small screens.

**User menu** (`dashboard/user-menu.tsx`): the trigger is the avatar, name and email at the bottom of the sidebar. The menu is `w-80 rounded-2xl p-3` and holds, in order:

1. Profile row: avatar, name, email.
2. Credits row: balance in `font-display text-lg font-bold`, linking to `/billing`.
3. Profile item.
4. Language.
5. Sign out.

It shows no plan and no upgrade: subscriptions aren't sold. Subscribers manage theirs on `/billing`.

**Pagination** (`dashboard/pagination.tsx`): "Page N of M" in muted tabular numbers, with previous and next buttons.
