import { getFormatter, getTranslations } from "next-intl/server";
import { connection } from "next/server";
import { projectConfig } from "project.config";
import { homeFacts } from "@/app/_lib/home-facts";
import { LOCALE_NAMES, type Locale, routing } from "@/i18n/routing";
import { LEGAL_DOCS, listPosts } from "@/lib/content";
import { GUIDES } from "@/lib/guides";
// Every locale has the same keys (a unit test checks), so en's list them all.
import messages from "../../../messages/en.json";

const keys = <T extends object>(items: T) => Object.keys(items) as (keyof T & string)[];

// A Markdown summary of the product for language models (llmstxt.org): what
// it is, its FAQ in the default locale, and links to the
// public pages, guides included, in every locale. The text comes from messages/*.json, so it
// follows the landing page.
export async function GET() {
  // Read BETTER_AUTH_URL per request, as the sitemap does.
  await connection();
  const url = (path: string) => new URL(path, process.env.BETTER_AUTH_URL).href;

  const t = await getTranslations({ locale: routing.defaultLocale, namespace: "Home" });
  const meta = await getTranslations({ locale: routing.defaultLocale, namespace: "Metadata" });
  // The values the home page's FAQ fills in, as plain text.
  const { credits, proCredits, packs, maxPickBytes } = homeFacts();
  const format = await getFormatter({ locale: routing.defaultLocale });
  const values = {
    email: () => projectConfig.supportEmail,
    pricing: (chunks: string) => chunks,
    credits,
    proCredits,
    packs: format.list(
      packs.map((pack) =>
        t("faq.pack", {
          credits: pack.credits,
          price: format.number(pack.amount / 100, { style: "currency", currency: pack.currency.toUpperCase() }),
        }),
      ),
    ),
    size: maxPickBytes / 1024 / 1024,
  };
  const faq = keys(messages.Home.faq.items).map(
    (key) => `- ${t(`faq.items.${key}.title`)}: ${t.markup(`faq.items.${key}.body`, values)}`,
  );

  const pages = async (locale: Locale) => {
    const home = await getTranslations({ locale, namespace: "Home" });
    const legal = await getTranslations({ locale, namespace: "Legal" });
    const pricing = await getTranslations({ locale, namespace: "Pricing" });
    const blog = await getTranslations({ locale, namespace: "Blog" });
    const guides = await getTranslations({ locale, namespace: "Guides" });
    // The pricing page's h1 and intro name the cheapest pack's price.
    const [cheapest] = [...packs].sort((one, other) => one.amount - other.amount);
    const price = (await getFormatter({ locale })).number(cheapest.amount / 100, {
      style: "currency",
      currency: cheapest.currency.toUpperCase(),
    });
    return [
      `- [${projectConfig.name}](${url(`/${locale}`)}): ${home("hero.title")}`,
      ...GUIDES.map(
        (guide) =>
          `- [${guides(`pages.${guide}.metaTitle`)}](${url(`/${locale}/${guide}`)}): ${guides(`pages.${guide}.metaDescription`)}`,
      ),
      ...LEGAL_DOCS.map((doc) => `- [${legal(doc)}](${url(`/${locale}/${doc}`)})`),
      `- [${pricing("title", { price })}](${url(`/${locale}/pricing`)}): ${pricing("description", { price })}`,
      `- [${blog("title")}](${url(`/${locale}/blog`)}): ${blog("description")}`,
      ...(await listPosts(locale)).map(
        (post) => `- [${post.title}](${url(`/${locale}/blog/${post.slug}`)}): ${post.description}`,
      ),
    ];
  };

  // Each section is a heading and a list, as llmstxt.org lays them out.
  const section = (heading: string, lines: string[]) => `## ${heading}\n\n${lines.join("\n")}`;
  const body = [
    `# ${projectConfig.name}`,
    `> ${meta("description")}`,
    t("hero.body"),
    section(t("faq.title"), faq),
    ...(await Promise.all(routing.locales.map(async (locale) => section(LOCALE_NAMES[locale], await pages(locale))))),
    section("Optional", [`- [Sitemap](${url("/sitemap.xml")})`]),
  ].join("\n\n");

  return new Response(`${body}\n`, { headers: { "content-type": "text/markdown; charset=utf-8" } });
}
