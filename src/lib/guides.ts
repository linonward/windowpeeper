// The guides: public pages that each answer one search about the window
// peeper trend and lead to the generator on the home page. Each slug is its
// path under the locale (src/app/[locale]/(marketing)/<slug>/page.tsx) and
// its copy is Guides.pages.<slug> in messages/*.json. The sitemap, llms.txt,
// llms-full.txt, the footer and analytics read this list.
export const GUIDES = ["how-to-make-window-peeper-video", "window-peeper-trend", "window-peeper-capcut-template"] as const;

export type Guide = (typeof GUIDES)[number];

// When each guide was first published and last changed in substance, for
// its Article structured data. Update `modified` with the copy.
export const GUIDE_DATES: Record<Guide, { published: string; modified: string }> = {
  "how-to-make-window-peeper-video": { published: "2026-10-22", modified: "2026-10-23" },
  "window-peeper-trend": { published: "2026-10-23", modified: "2026-10-23" },
  "window-peeper-capcut-template": { published: "2026-10-23", modified: "2026-10-23" },
};
