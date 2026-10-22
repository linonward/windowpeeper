import { getFormatter, getTranslations } from "next-intl/server";
import { homeFacts } from "@/app/_lib/home-facts";
import { type Locale, localePath } from "@/i18n/routing";
import type { Guide } from "@/lib/guides";

// A section of a guide's copy, as GuidePage renders it (src/components/guides).
type Section = {
  title: string;
  text?: Record<string, string>;
  list?: Record<string, string>;
  steps?: Record<string, { title: string; body: string }>;
  more?: Record<string, string>;
};

// Guides.pages.<guide> has the same shape for every guide but not the same
// section keys, so its keys are built at runtime, as in GuidePage.
type Translate = {
  (key: string, values?: Record<string, string | number>): string;
  markup: (key: string, values: Record<string, unknown>) => string;
  raw: (key: string) => unknown;
};

// The tags guide copy may use; as plain text a link keeps only its words.
const TAGS = ["generator", "howto", "terms", "privacy"];

// A guide's full text as Markdown, in the order the page shows it, with the
// prices and photo limits filled in. `url` turns a path into a full URL.
export async function guideMarkdown(guide: Guide, locale: Locale, url: (path: string) => string): Promise<string> {
  const t = (await getTranslations({ locale, namespace: "Guides" })) as unknown as Translate;
  const format = await getFormatter({ locale });
  const { credits, proCredits, packs, maxPickBytes, imageLimits } = homeFacts();
  const money = (pack: { amount: number; currency: string }) =>
    format.number(pack.amount / 100, { style: "currency", currency: pack.currency.toUpperCase() });
  const [cheapest] = [...packs].sort((a, b) => a.amount - b.amount);
  const values = {
    credits,
    proCredits,
    price: money(cheapest),
    packs: format.list(packs.map((pack) => t("pack", { credits: pack.credits, price: money(pack) }))),
    size: maxPickBytes / 1024 / 1024,
    min: imageLimits.minSide,
    maxSide: imageLimits.maxSide,
    ...Object.fromEntries(TAGS.map((tag) => [tag, (chunks: string) => chunks])),
  };
  const page = (key: string) => `pages.${guide}.${key}`;
  const plain = (key: string) => t.markup(page(key), values);

  const sections = t.raw(page("sections")) as Record<string, Section>;
  const blocks = Object.entries(sections).map(([key, section]) => {
    const at = (part: string) => `sections.${key}.${part}`;
    const lines = [
      ...Object.keys(section.text ?? {}).map((n) => plain(at(`text.${n}`))),
      ...(section.list ? [Object.keys(section.list).map((n) => `- ${plain(at(`list.${n}`))}`).join("\n")] : []),
      ...(section.steps
        ? [
            Object.keys(section.steps)
              .map((n, i) => `${i + 1}. **${t(page(at(`steps.${n}.title`)))}.** ${plain(at(`steps.${n}.body`))}`)
              .join("\n"),
          ]
        : []),
      ...Object.keys(section.more ?? {}).map((n) => plain(at(`more.${n}`))),
    ];
    return [`## ${t(page(at("title")))}`, ...lines].join("\n\n");
  });

  return [
    `# ${t(page("title"))}`,
    `Source: ${url(localePath(locale, `/${guide}`))}`,
    plain("lead"),
    ...blocks,
    t("note"),
  ].join("\n\n");
}
