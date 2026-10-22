import { expect, test } from "vitest";
import { blogPosting, faqPage, howTo, jsonLd, languageAlternates, videoObject, website } from "./seo";

test("links every locale and defaults to English", () => {
  expect(languageAlternates("/blog")).toEqual({
    en: "/blog",
    es: "/es/blog",
    de: "/de/blog",
    "x-default": "/blog",
  });
});

test("links only the locales that have the page", () => {
  expect(languageAlternates("/blog/a", ["es"], "https://x.test")).toEqual({
    es: "https://x.test/es/blog/a",
    "x-default": "https://x.test/es/blog/a",
  });
});

const post = { slug: "a", title: "A post", description: "What it says.", date: "2026-10-01", tags: ["guides", "news"] };

test("describes a post with what its page shows", () => {
  expect(blogPosting(post, "es", "https://x.test")).toEqual({
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    headline: "A post",
    description: "What it says.",
    datePublished: "2026-10-01",
    keywords: ["guides", "news"],
    inLanguage: "es",
    url: "https://x.test/es/blog/a",
    mainEntityOfPage: "https://x.test/es/blog/a",
    author: { "@type": "Organization", name: "WindowPeeper", url: "https://x.test/es" },
  });
});

test("leaves out the URLs without a base URL", () => {
  const data = blogPosting({ ...post, tags: [] }, "en");
  expect(data).not.toHaveProperty("url");
  expect(data).not.toHaveProperty("mainEntityOfPage");
  expect(data).not.toHaveProperty("keywords");
  expect(data.author).toEqual({ "@type": "Organization", name: "WindowPeeper" });
});

test("escapes < so a title can't close the script tag", () => {
  expect(jsonLd({ headline: "</script><script>alert(1)</script>" })).toBe(
    '{"headline":"\\u003c/script>\\u003cscript>alert(1)\\u003c/script>"}',
  );
});

test("names the site and its publisher for the home page", () => {
  expect(website("es", "What it does.", "https://x.test")).toEqual({
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Organization",
        "@id": "https://x.test/#organization",
        name: "WindowPeeper",
        url: "https://x.test/",
        contactPoint: { "@type": "ContactPoint", contactType: "customer support", email: "support@windowpeeper.org" },
      },
      {
        "@type": "WebSite",
        "@id": "https://x.test/#website",
        name: "WindowPeeper",
        description: "What it does.",
        inLanguage: "es",
        url: "https://x.test/",
        publisher: { "@id": "https://x.test/#organization" },
      },
    ],
  });
});

test("gives the site the other names people search for it by", () => {
  const [, site] = website("en", "What it does.", undefined, ["Window Peeper AI Video Generator"])["@graph"];
  expect(site).toMatchObject({ "@type": "WebSite", name: "WindowPeeper", alternateName: ["Window Peeper AI Video Generator"] });
});

test("leaves the site's URLs out without a base URL", () => {
  expect(website("en", "What it does.")).toEqual({
    "@context": "https://schema.org",
    "@graph": [
      { "@type": "Organization", name: "WindowPeeper", contactPoint: { "@type": "ContactPoint", contactType: "customer support", email: "support@windowpeeper.org" } },
      { "@type": "WebSite", name: "WindowPeeper", description: "What it does.", inLanguage: "en", publisher: { name: "WindowPeeper" } },
    ],
  });
});

test("lists a page's questions and plain-text answers", () => {
  expect(faqPage("es", [{ question: "¿Cuánto cuesta?", answer: "10 créditos." }])).toEqual({
    "@context": "https://schema.org",
    "@type": "FAQPage",
    inLanguage: "es",
    mainEntity: [{ "@type": "Question", name: "¿Cuánto cuesta?", acceptedAnswer: { "@type": "Answer", text: "10 créditos." } }],
  });
});

const clip = {
  name: "The window peeper scene",
  description: "A 9-second example.",
  contentPath: "/landing/windowpeeper/sample.mp4",
  thumbnailPath: "/landing/windowpeeper/poster.jpg",
  uploadDate: "2026-10-17",
  seconds: 12,
};

test("describes the example clip with absolute URLs", () => {
  expect(videoObject(clip, "en", "https://x.test")).toEqual({
    "@context": "https://schema.org",
    "@type": "VideoObject",
    name: "The window peeper scene",
    description: "A 9-second example.",
    uploadDate: "2026-10-17",
    duration: "PT12S",
    inLanguage: "en",
    contentUrl: "https://x.test/landing/windowpeeper/sample.mp4",
    thumbnailUrl: "https://x.test/landing/windowpeeper/poster.jpg",
  });
});

test("leaves the clip's URLs out without a base URL", () => {
  const data = videoObject(clip, "en");
  expect(data).not.toHaveProperty("contentUrl");
  expect(data).not.toHaveProperty("thumbnailUrl");
});

test("lists the steps of a how-to in order", () => {
  expect(howTo("es", "Tres pasos", [{ name: "Subir", text: "Elige una foto." }, { name: "Descargar", text: "Guarda el MP4." }])).toEqual({
    "@context": "https://schema.org",
    "@type": "HowTo",
    name: "Tres pasos",
    inLanguage: "es",
    step: [
      { "@type": "HowToStep", position: 1, name: "Subir", text: "Elige una foto." },
      { "@type": "HowToStep", position: 2, name: "Descargar", text: "Guarda el MP4." },
    ],
  });
});
