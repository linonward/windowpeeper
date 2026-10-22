import { projectConfig } from "project.config";
import { type Locale, localePath, routing } from "@/i18n/routing";
import type { Post } from "./content";

// hreflang links for a page that exists in `locales`, keyed by locale plus
// x-default (the default locale's version, else the first one). `path` has
// no locale prefix; `base` is empty for metadata (metadataBase resolves it)
// or the site URL for the sitemap.
export function languageAlternates(
  path: string,
  locales: readonly Locale[] = routing.locales,
  base = "",
): Record<string, string> {
  const url = (locale: Locale) => `${base}${localePath(locale, path)}`;
  const fallback = locales.includes(routing.defaultLocale) ? routing.defaultLocale : locales[0];
  return {
    ...Object.fromEntries(locales.map((locale) => [locale, url(locale)])),
    "x-default": url(fallback),
  };
}

// schema.org BlogPosting for a post's page, from what the page shows: the
// title, description, date and tags, by the site. `base` is the site URL;
// without it the URLs are left out, as JSON-LD has no metadataBase.
export function blogPosting(
  post: Pick<Post, "slug" | "title" | "description" | "date" | "tags">,
  locale: Locale,
  base?: string,
) {
  const url = (path: string) => (base ? new URL(path, base).href : undefined);
  const page = url(localePath(locale, `/blog/${post.slug}`));
  const home = url(localePath(locale));
  return {
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    headline: post.title,
    description: post.description,
    datePublished: post.date,
    ...(post.tags.length > 0 && { keywords: post.tags }),
    inLanguage: locale,
    ...(page && { url: page, mainEntityOfPage: page }),
    author: { "@type": "Organization", name: projectConfig.name, ...(home && { url: home }) },
  };
}

// schema.org WebSite and its publisher for the home page, so search engines
// show the site's name. `base` is the site URL; without it the URLs and IDs
// are left out. `alternateNames` are other names people search for it by.
export function website(locale: Locale, description: string, base?: string, alternateNames: readonly string[] = []) {
  const name = projectConfig.name;
  const url = (path: string) => (base ? new URL(path, base).href : undefined);
  const id = (fragment: string) => url(`/#${fragment}`);
  const organization = id("organization");
  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Organization",
        ...(organization && { "@id": organization }),
        name,
        ...(base && { url: url("/") }),
        contactPoint: { "@type": "ContactPoint", contactType: "customer support", email: projectConfig.supportEmail },
      },
      {
        "@type": "WebSite",
        ...(base && { "@id": id("website") }),
        name,
        ...(alternateNames.length > 0 && { alternateName: alternateNames }),
        description,
        inLanguage: locale,
        // One WebSite identity for all languages, at the domain root.
        ...(base && { url: url("/") }),
        publisher: organization ? { "@id": organization } : { name },
      },
    ],
  };
}

// schema.org FAQPage for a page's FAQ, from the questions and answers it
// shows, as plain text.
export function faqPage(locale: Locale, items: readonly { question: string; answer: string }[]) {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    inLanguage: locale,
    mainEntity: items.map(({ question, answer }) => ({
      "@type": "Question",
      name: question,
      acceptedAnswer: { "@type": "Answer", text: answer },
    })),
  };
}

// schema.org VideoObject for a clip the page plays. The paths are under
// public/; `base` is the site URL, without which the URLs are left out.
export function videoObject(
  clip: {
    name: string;
    description: string;
    contentPath: string;
    thumbnailPath: string;
    uploadDate: string;
    seconds: number;
  },
  locale: Locale,
  base?: string,
) {
  return {
    "@context": "https://schema.org",
    "@type": "VideoObject",
    name: clip.name,
    description: clip.description,
    uploadDate: clip.uploadDate,
    duration: `PT${clip.seconds}S`,
    inLanguage: locale,
    ...(base && {
      contentUrl: new URL(clip.contentPath, base).href,
      thumbnailUrl: new URL(clip.thumbnailPath, base).href,
    }),
  };
}

// schema.org Article for a guide, from what the page shows: its title,
// description and dates, by the site. `path` is the page's path in its
// locale; `base` is the site URL, without which the URLs are left out.
export function article(
  page: { title: string; description: string; published: string; modified: string; path: string },
  locale: Locale,
  base?: string,
) {
  const url = base ? new URL(page.path, base).href : undefined;
  const organization = { "@type": "Organization", name: projectConfig.name, ...(base && { url: new URL("/", base).href }) };
  return {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: page.title,
    description: page.description,
    datePublished: page.published,
    dateModified: page.modified,
    inLanguage: locale,
    ...(url && { url, mainEntityOfPage: url }),
    author: organization,
    publisher: organization,
  };
}

// schema.org HowTo for numbered steps a page shows, as plain text.
export function howTo(locale: Locale, name: string, steps: readonly { name: string; text: string }[]) {
  return {
    "@context": "https://schema.org",
    "@type": "HowTo",
    name,
    inLanguage: locale,
    step: steps.map((step, i) => ({ "@type": "HowToStep", position: i + 1, ...step })),
  };
}

// JSON for a <script type="application/ld+json">. "<" becomes \u003c, so a
// string can't close the script tag.
export function jsonLd(data: object): string {
  return JSON.stringify(data).replace(/</g, "\\u003c");
}
