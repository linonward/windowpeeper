import { expect, test } from "vitest";
import { blogPosting, faqPage, howTo, jsonLd, languageAlternates, videoObject, website } from "./seo";

test("links every locale and defaults to English", () => {
  expect(languageAlternates("/blog")).toEqual({
    en: "/en/blog",
    zh: "/zh/blog",
    es: "/es/blog",
    de: "/de/blog",
    "x-default": "/en/blog",
  });
});

test("links only the locales that have the page", () => {
  expect(languageAlternates("/blog/a", ["zh"], "https://x.test")).toEqual({
    zh: "https://x.test/zh/blog/a",
    "x-default": "https://x.test/zh/blog/a",
  });
});

const post = { slug: "a", title: "A post", description: "What it says.", date: "2026-10-01", tags: ["guides", "news"] };

test("describes a post with what its page shows", () => {
  expect(blogPosting(post, "zh", "https://x.test")).toEqual({
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    headline: "A post",
    description: "What it says.",
    datePublished: "2026-10-01",
    keywords: ["guides", "news"],
    inLanguage: "zh",
    url: "https://x.test/zh/blog/a",
    mainEntityOfPage: "https://x.test/zh/blog/a",
    author: { "@type": "Organization", name: "WindowPeeper", url: "https://x.test/zh" },
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
  expect(website("zh", "What it does.", "https://x.test")).toEqual({
    "@context": "https://schema.org",
    "@graph": [
      { "@type": "Organization", "@id": "https://x.test/#organization", name: "WindowPeeper", url: "https://x.test/" },
      {
        "@type": "WebSite",
        "@id": "https://x.test/#website",
        name: "WindowPeeper",
        description: "What it does.",
        inLanguage: "zh",
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
      { "@type": "Organization", name: "WindowPeeper" },
      { "@type": "WebSite", name: "WindowPeeper", description: "What it does.", inLanguage: "en", publisher: { name: "WindowPeeper" } },
    ],
  });
});

test("lists a page's questions and plain-text answers", () => {
  expect(faqPage("zh", [{ question: "多少钱？", answer: "10 积分。" }])).toEqual({
    "@context": "https://schema.org",
    "@type": "FAQPage",
    inLanguage: "zh",
    mainEntity: [{ "@type": "Question", name: "多少钱？", acceptedAnswer: { "@type": "Answer", text: "10 积分。" } }],
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
  expect(howTo("zh", "三步", [{ name: "上传", text: "选照片。" }, { name: "下载", text: "保存 MP4。" }])).toEqual({
    "@context": "https://schema.org",
    "@type": "HowTo",
    name: "三步",
    inLanguage: "zh",
    step: [
      { "@type": "HowToStep", position: 1, name: "上传", text: "选照片。" },
      { "@type": "HowToStep", position: 2, name: "下载", text: "保存 MP4。" },
    ],
  });
});
