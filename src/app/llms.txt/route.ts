import { getFormatter, getTranslations } from "next-intl/server";
import { connection } from "next/server";
import { projectConfig } from "project.config";
import { homeFacts } from "@/app/_lib/home-facts";
import { LOCALE_NAMES, type Locale, localePath, routing } from "@/i18n/routing";
import { LEGAL_DOCS, listPosts } from "@/lib/content";
import { GUIDES } from "@/lib/guides";
// Every locale has the same keys (a unit test checks), so en's list them all.
import messages from "../../../messages/en.json";

const keys = <T extends object>(items: T) => Object.keys(items) as (keyof T & string)[];

// A Markdown index of the site for language models (llmstxt.org): what it
// is and how it works, the guides with what each covers, the full text in
// llms-full.txt, the FAQ in the default locale, and links to the public
// pages in every locale. The text comes from messages/*.json, so it follows
// the pages.
export async function GET() {
  // Read BETTER_AUTH_URL per request, as the sitemap does.
  await connection();
  const url = (path: string) => new URL(path, process.env.BETTER_AUTH_URL).href;

  const t = await getTranslations({ locale: routing.defaultLocale, namespace: "Home" });
  const meta = await getTranslations({ locale: routing.defaultLocale, namespace: "Metadata" });
  // The values the home page's FAQ fills in, as plain text.
  const { packs, maxPickBytes, prices } = homeFacts();
  const format = await getFormatter({ locale: routing.defaultLocale });
  const [smallest] = packs;
  const values = {
    price: format.number(smallest.amount / 100, { style: "currency", currency: smallest.currency.toUpperCase() }),
    size: maxPickBytes / 1024 / 1024,
    email: projectConfig.supportEmail,
  };
  const steps = keys(messages.Home.steps.items).map(
    (key, i) => `${i + 1}. ${t(`steps.items.${key}.title`)}: ${t(`steps.items.${key}.body`)}`,
  );
  const guides = await getTranslations({ locale: routing.defaultLocale, namespace: "Guides" });
  const guideIndex = [
    ...GUIDES.map(
      (guide) =>
        `- [${guides(`pages.${guide}.metaTitle`)}](${url(localePath(routing.defaultLocale, `/${guide}`))}): ${guides(`pages.${guide}.metaDescription`)}`,
    ),
    `- [Full text of every guide](${url("/llms-full.txt")}): the guides and the FAQ above, as one Markdown file.`,
  ];
  const faq = keys(messages.Home.faq.items).map(
    (key) => `- ${t(`faq.items.${key}.title`)}: ${t(`faq.items.${key}.body`, values)}`,
  );

  const pages = async (locale: Locale) => {
    const home = await getTranslations({ locale, namespace: "Home" });
    const legal = await getTranslations({ locale, namespace: "Legal" });
    const pricing = await getTranslations({ locale, namespace: "Pricing" });
    const blog = await getTranslations({ locale, namespace: "Blog" });
    const guides = await getTranslations({ locale, namespace: "Guides" });
    return [
      `- [${projectConfig.name}](${url(localePath(locale))}): ${home("hero.title")}`,
      ...GUIDES.map(
        (guide) =>
          `- [${guides(`pages.${guide}.metaTitle`)}](${url(localePath(locale, `/${guide}`))}): ${guides(`pages.${guide}.metaDescription`)}`,
      ),
      ...LEGAL_DOCS.map((doc) => `- [${legal(doc)}](${url(localePath(locale, `/${doc}`))})`),
      `- [${pricing("title")}](${url(localePath(locale, "/pricing"))}): ${pricing("description", { standard: prices.standard, pro: prices.pro })}`,
      `- [${blog("title")}](${url(localePath(locale, "/blog"))}): ${blog("description")}`,
      ...(await listPosts(locale)).map(
        (post) => `- [${post.title}](${url(localePath(locale, `/blog/${post.slug}`))}): ${post.description}`,
      ),
    ];
  };

  // Each section is a heading and a list, as llmstxt.org lays them out.
  const section = (heading: string, lines: string[]) => `## ${heading}\n\n${lines.join("\n")}`;
  const body = [
    `# ${projectConfig.name}`,
    `> ${meta("description")}`,
    t("hero.body"),
    section(t("steps.title"), steps),
    section("Guides", guideIndex),
    section(t("faq.title"), faq),
    ...(await Promise.all(routing.locales.map(async (locale) => section(LOCALE_NAMES[locale], await pages(locale))))),
    section("Optional", [`- [Sitemap](${url("/sitemap.xml")})`]),
  ].join("\n\n");

  return new Response(`${body}\n`, { headers: { "content-type": "text/markdown; charset=utf-8" } });
}
