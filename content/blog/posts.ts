import type { Locale } from "@/i18n/routing";

// The posts in content/blog/<locale>/, by file name without .mdx. The site
// runs in a Cloudflare Worker, which can't list a directory, so add each
// new post here too; src/lib/content.test.ts checks that the two match.
export const POSTS: Partial<Record<Locale, readonly string[]>> = {
  en: ["is-it-safe-to-upload-a-photo"],
};
