// The guides: public pages that each answer one search about the window
// peeper trend and lead to the generator on the home page. Each slug is its
// path under the locale (src/app/[locale]/(marketing)/<slug>/page.tsx) and
// its copy is Guides.pages.<slug> in messages/*.json. The sitemap, llms.txt,
// the footer and analytics read this list.
export const GUIDES = ["how-to-make-window-peeper-video"] as const;

export type Guide = (typeof GUIDES)[number];
