import { getFormatter, getTranslations } from "next-intl/server";
import { connection } from "next/server";
import { projectConfig } from "project.config";
import { guideMarkdown } from "@/app/_lib/guide-markdown";
import { homeFacts } from "@/app/_lib/home-facts";
import { routing } from "@/i18n/routing";
import { GUIDES } from "@/lib/guides";
import messages from "../../../messages/en.json";

const keys = <T extends object>(items: T) => Object.keys(items) as (keyof T & string)[];

// Every guide's full text and the FAQ in one Markdown file, in the default
// locale, for language models (llmstxt.org's llms-full.txt). llms.txt links
// it. The text comes from messages/*.json, so it follows the pages.
export async function GET() {
  // Read BETTER_AUTH_URL per request, as the sitemap does.
  await connection();
  const url = (path: string) => new URL(path, process.env.BETTER_AUTH_URL).href;
  const locale = routing.defaultLocale;

  const meta = await getTranslations({ locale, namespace: "Metadata" });
  const home = await getTranslations({ locale, namespace: "Home" });
  const format = await getFormatter({ locale });
  const { packs, maxPickBytes } = homeFacts();
  const [smallest] = packs;
  const values = {
    price: format.number(smallest.amount / 100, { style: "currency", currency: smallest.currency.toUpperCase() }),
    size: maxPickBytes / 1024 / 1024,
    email: projectConfig.supportEmail,
  };
  const faq = keys(messages.Home.faq.items).map(
    (key) => `### ${home(`faq.items.${key}.title`)}\n\n${home(`faq.items.${key}.body`, values)}`,
  );

  const body = [
    `# ${projectConfig.name}`,
    `> ${meta("description")}`,
    `Source: ${url("/")}`,
    home("hero.body"),
    `## ${home("faq.title")}`,
    ...faq,
    ...(await Promise.all(GUIDES.map((guide) => guideMarkdown(guide, locale, url)))).map((text) => `---\n\n${text}`),
  ].join("\n\n");

  return new Response(`${body}\n`, { headers: { "content-type": "text/markdown; charset=utf-8" } });
}
