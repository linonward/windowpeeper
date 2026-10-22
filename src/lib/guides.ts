// The guides: public pages that each answer one search about the tip-toe
// dance and lead to the generator on the home page. Each slug is its path
// under the locale (src/app/[locale]/(marketing)/<slug>/page.tsx) and its
// copy is Guides.pages.<slug> in messages/*.json. The sitemap, llms.txt, the
// footer and analytics read this list.
export const GUIDES = [
  "tip-toe-in-my-jordans",
  "rumpelstiltskin-meme",
  "how-to-make-rumpelstiltskin-video",
  "who-is-rumpelstiltskin",
  "rumpelstiltskin-movie",
  "rumpelstiltskin-1987-movie",
  "rumpelstiltskin-dance-scene",
] as const;

export type Guide = (typeof GUIDES)[number];
