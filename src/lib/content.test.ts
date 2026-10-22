import { readdirSync } from "node:fs";
import { join } from "node:path";
import { expect, test } from "vitest";
import { routing } from "@/i18n/routing";
import { POSTS } from "@content/blog/posts";

// A Worker can't list a directory, so the posts are listed by hand.
test("content/blog/posts.ts lists exactly the posts in content/blog/<locale>/", () => {
  for (const locale of routing.locales) {
    const files = (() => {
      try {
        return readdirSync(join(process.cwd(), "content/blog", locale));
      } catch {
        return [];
      }
    })();
    const slugs = files.filter((file) => file.endsWith(".mdx")).map((file) => file.slice(0, -4));
    expect([...(POSTS[locale] ?? [])].sort(), locale).toEqual(slugs.sort());
  }
});
