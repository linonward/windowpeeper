import { expect, test } from "@playwright/test";
import { signIn } from "./support/auth";

// Search engines find the public pages in every locale, and nothing behind
// sign-in or the API.
test("the sitemap lists the public pages in every locale", async ({ request, baseURL }) => {
  const response = await request.get("/sitemap.xml");

  expect(response.status()).toBe(200);
  const xml = await response.text();
  const locs = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((match) => match[1]);
  const pages = [
    "",
    "/how-to-make-window-peeper-video",
    "/privacy",
    "/terms",
    "/refund",
    "/pricing",
  ];
  const posts = ["/blog/is-it-safe-to-upload-a-photo"];
  expect(locs.sort()).toEqual(
    [
      // English pages have no prefix.
      ...pages.flatMap((page) => [`${baseURL}${page || "/"}`, ...["es", "de"].map((locale) => `${baseURL}/${locale}${page}`)]),
      // Posts, and so blogs, exist in English only.
      ...["/blog", ...posts].map((page) => `${baseURL}${page}`),
    ].sort(),
  );
  expect(xml).toContain(`hreflang="es" href="${baseURL}/es/privacy"`);
  expect(xml).toContain(`hreflang="x-default" href="${baseURL}/privacy"`);
});

test("a blog without posts stays out of search; the others link only blogs with posts", async ({ page }) => {
  await page.goto("/es/blog");
  await expect(page.locator('head meta[name="robots"]')).toHaveAttribute("content", /noindex/);

  await page.goto("/blog");
  await expect(page.locator('head meta[name="robots"]')).toHaveCount(0);
  await expect(page.locator('head link[rel="alternate"][hreflang="en"]')).toHaveCount(1);
  await expect(page.locator('head link[rel="alternate"][hreflang="es"]')).toHaveCount(0);
});

test("robots.txt keeps crawlers out of the API and points to the sitemap", async ({ request, baseURL }) => {
  const response = await request.get("/robots.txt");

  expect(response.status()).toBe(200);
  const robots = await response.text();
  expect(robots).toContain("User-Agent: *");
  expect(robots).toContain("Allow: /");
  expect(robots).toContain("Disallow: /api/");
  expect(robots).toContain(`Sitemap: ${baseURL}/sitemap.xml`);
});

test("the home page names the site and its publisher", async ({ page, baseURL }) => {
  await page.goto("/es");

  // The FAQ has its own structured data.
  const scripts = await page.locator('script[type="application/ld+json"]').allTextContents();
  const data = scripts.map((text) => JSON.parse(text)).find((item) => item["@graph"]);
  expect(data["@graph"]).toEqual([
    expect.objectContaining({ "@type": "Organization", name: "WindowPeeper", url: `${baseURL}/` }),
    expect.objectContaining({
      "@type": "WebSite",
      name: "WindowPeeper",
      inLanguage: "es",
      url: `${baseURL}/`,
      description: await page.locator('head meta[name="description"]').getAttribute("content"),
    }),
  ]);
});

test("the blog index names its canonical URL and the locales with posts", async ({ page, baseURL }) => {
  await page.goto("/blog");

  const head = page.locator("head");
  await expect(head.locator('link[rel="canonical"]')).toHaveAttribute("href", `${baseURL}/blog`);
  await expect(head.locator('link[rel="alternate"][hreflang="en"]')).toHaveAttribute("href", `${baseURL}/blog`);
  await expect(head.locator('link[rel="alternate"][hreflang="x-default"]')).toHaveAttribute("href", `${baseURL}/blog`);
});

test("the home, guide and legal pages name their canonical URL and every locale", async ({ page, baseURL }) => {
  for (const path of [
    "",
    "/how-to-make-window-peeper-video",
    "/privacy",
    "/terms",
    "/refund",
  ]) {
    await page.goto(`/es${path}`);

    const head = page.locator("head");
    await expect(head.locator('link[rel="canonical"]')).toHaveAttribute("href", `${baseURL}/es${path}`);
    await expect(head.locator('link[rel="alternate"][hreflang="en"]')).toHaveAttribute("href", `${baseURL}${path}`);
    await expect(head.locator('link[rel="alternate"][hreflang="x-default"]')).toHaveAttribute("href", `${baseURL}${path}`);
  }
});

// Search titles lead with the keyword; the home title is the keyword alone.
test("marketing pages carry keyword-first titles", async ({ page }) => {
  const titles = {
    "/": "Window Peeper AI Video – Make the TikTok Trend From a Photo",
    "/es": "Window Peeper IA – El video de la tendencia con una foto",
    "/es/pricing": "Precios del video de window peeper | WindowPeeper",
    "/how-to-make-window-peeper-video": "How to Make the Window Peeper Video | WindowPeeper",
  };
  for (const [path, title] of Object.entries(titles)) {
    await page.goto(path);

    await expect(page, path).toHaveTitle(title);
  }
});

// The page's own hreflang links are the only ones. A Link header would also
// name translations that don't exist, such as a post's missing locale.
test("responses carry no hreflang Link header", async ({ request }) => {
  for (const path of ["/", "/pricing", "/blog"]) {
    const response = await request.get(path);

    expect(response.headers().link ?? "", path).not.toContain("hreflang");
  }
});

// Each page's own summary, not the site's: search results show it under the title.
test("the legal and sign-in pages describe themselves", async ({ page }) => {
  const descriptions = {
    "/privacy": "How WindowPeeper collects, uses, shares and protects your personal information.",
    "/es/terms": "Las condiciones para usar WindowPeeper: tu cuenta, el uso aceptable, tu contenido y los pagos.",
    "/refund": "When WindowPeeper refunds a purchase, and how to ask for a refund.",
    "/sign-in": "New here? Signing in creates your account. No password needed.",
  };
  for (const [path, description] of Object.entries(descriptions)) {
    await page.goto(path);

    await expect(page.locator('head meta[name="description"]'), path).toHaveAttribute("content", description);
  }
});

test("the sign-in page stays out of search results", async ({ page }) => {
  await page.goto("/sign-in?next=%2Fdashboard");

  await expect(page.locator('head meta[name="robots"]')).toHaveAttribute("content", "noindex");
  await expect(page.locator('head link[rel="canonical"]')).toHaveAttribute("href", /\/sign-in$/);
});

// Signed-out crawlers get redirected to sign-in, but a signed-in page still
// says noindex in case that redirect ever fails.
test("signed-in pages stay out of search results", async ({ page }) => {
  await signIn(page);

  for (const path of ["/videos/library", "/billing"]) {
    await page.goto(path);

    await expect(page.locator('head meta[name="robots"]'), path).toHaveAttribute("content", "noindex");
  }
});

// A crawler's first request decides the status. Next.js caches the 404
// afterwards, so each run asks for paths no earlier request has seen.
test("an unknown post or tag answers 404 on the first request", async ({ request }) => {
  const unseen = `unseen-${Date.now()}`;
  for (const path of [`/blog/${unseen}`, `/blog/tags/${unseen}`]) {
    const response = await request.get(path);

    expect(response.status(), path).toBe(404);
  }
});

test("llms.txt describes the product and links the public pages", async ({ request, baseURL }) => {
  const response = await request.get("/llms.txt");

  expect(response.status()).toBe(200);
  expect(response.headers()["content-type"]).toBe("text/markdown; charset=utf-8");
  const text = await response.text();
  const lines = text.split("\n");
  expect(lines[0]).toBe("# WindowPeeper");
  expect(lines[2]).toBe(
    "> Make the window peeper trend video from one photo: caught mid-bite in a lit window, a long stare, then the curtain. Six scenes, no CapCut template.",
  );
  expect(text).toContain("- Can I see the video before I pay?: No. Each video costs credits, from $9.90 for one.");
  // The largest photo a visitor may pick; the browser shrinks it to upload.
  expect(text).toContain("JPG, PNG or WebP, up to 10 MB.");
  expect(text).toContain(`- [Privacy Policy](${baseURL}/privacy)`);
  expect(text).toContain(`- [Política de privacidad](${baseURL}/es/privacy)`);
  expect(text).toContain(`- [Pay for the videos you make](${baseURL}/pricing): One Standard video costs 10 credits.`);
  expect(text).toContain(`- [Blog](${baseURL}/blog): `);
  expect(text).toContain(`- [How to Make the Window Peeper Video](${baseURL}/how-to-make-window-peeper-video): `);
  expect(text).toContain(`(${baseURL}/es/how-to-make-window-peeper-video): `);
  expect(text).toContain(
    `- [Is it safe to upload your photo to an AI video generator?](${baseURL}/blog/is-it-safe-to-upload-a-photo): `,
  );
  expect(text).toContain(`- [Sitemap](${baseURL}/sitemap.xml)`);
  // No ICU or markup left over.
  expect(text).not.toMatch(/[{}]|<\/?\w/);
});

test("every public page shares a preview image", async ({ page, request }) => {
  for (const path of ["/", "/es/pricing", "/blog", "/es/how-to-make-window-peeper-video"]) {
    await page.goto(path);

    const head = page.locator("head");
    await expect(head.locator('meta[property="og:image:width"]')).toHaveAttribute("content", "1200");
    await expect(head.locator('meta[property="og:image:height"]')).toHaveAttribute("content", "630");
    const image = await head.locator('meta[property="og:image"]').getAttribute("content");
    const response = await request.get(image!);
    expect(response.status(), image!).toBe(200);
    expect(response.headers()["content-type"]).toBe("image/png");
  }
});

// Search engines read the FAQ the page shows, as plain text.
test("the home page's FAQ is structured data", async ({ page }) => {
  await page.goto("/");

  const scripts = await page.locator('script[type="application/ld+json"]').allTextContents();
  const faq = scripts.map((text) => JSON.parse(text)).find((data) => data["@type"] === "FAQPage");
  expect(faq.mainEntity).toHaveLength(9);
  expect(faq.mainEntity[1]).toEqual({
    "@type": "Question",
    name: "Can I see the video before I pay?",
    acceptedAnswer: { "@type": "Answer", text: expect.stringMatching(/^No\. Each video costs credits, from \$9\.90 for one\./) },
  });
});

test("a guide shares its own title in social metadata", async ({ page, baseURL }) => {
  await page.goto("/how-to-make-window-peeper-video");

  await expect(page.locator('meta[property="og:title"]')).toHaveAttribute("content", "How to Make the Window Peeper Video");
  await expect(page.locator('meta[property="og:url"]')).toHaveAttribute(
    "content",
    `${baseURL}/how-to-make-window-peeper-video`,
  );
});

test("home pages identify the same site in social metadata", async ({ page, baseURL }) => {
  for (const path of ["", "/es"]) {
    await page.goto(path || "/");
    await expect(page.locator('meta[property="og:site_name"]')).toHaveAttribute("content", "WindowPeeper");
    await expect(page.locator('meta[property="og:url"]')).toHaveAttribute("content", `${baseURL}${path}`);
    await expect(page.locator('meta[property="og:title"]')).toHaveAttribute("content", await page.title());
  }
});
