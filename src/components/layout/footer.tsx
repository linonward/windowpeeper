import { useTranslations } from "next-intl";
import { projectConfig } from "project.config";
import { Link } from "@/i18n/navigation";
import { GUIDES } from "@/lib/guides";
import { Brand } from "./brand";
import { CurrentYear } from "./current-year";
import { LocaleLinks } from "./locale-switcher";

const LINK = "text-sm text-muted-foreground [@media(hover:hover)]:hover:text-foreground";

// The brand and the independence note, then three link columns under mono
// titles; a bottom bar with the copyright, the support email and the
// languages (docs/DESIGN.md, Site header and footer).
export function Footer() {
  const t = useTranslations("Footer");
  const pricing = useTranslations("Pricing");
  const blog = useTranslations("Blog");

  const columns = [
    {
      id: "footer-product",
      title: t("product"),
      links: [
        { href: "/#generator", label: t("makeVideo") },
        { href: "/#scenes", label: t("scenes") },
        { href: "/pricing", label: pricing("nav") },
      ],
    },
    {
      id: "footer-learn",
      title: t("learn"),
      links: [
        { href: "/#faq", label: t("trend") },
        { href: `/${GUIDES[0]}`, label: t("howTo") },
        { href: "/#faq", label: t("filter") },
        { href: "/blog", label: blog("title") },
      ],
    },
    {
      id: "footer-legal",
      title: t("legal"),
      links: [
        { href: "/terms", label: t("terms") },
        { href: "/privacy", label: t("privacy") },
        { href: "/refund", label: t("refunds") },
        { href: "/terms", label: t("acceptableUse") },
      ],
    },
  ];

  return (
    <footer className="border-t">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-8 px-5 pt-14 pb-10 sm:px-8">
        <div className="flex flex-col gap-10 lg:flex-row lg:justify-between">
          <div className="flex max-w-[320px] flex-col gap-3">
            <Brand />
            <p className="text-[13px] leading-normal text-pretty text-faint">{t("blurb")}</p>
          </div>
          <div className="grid grid-cols-2 gap-8 sm:grid-cols-3 lg:flex lg:gap-0">
            {columns.map(({ id, title, links }) => (
              <nav key={id} aria-labelledby={id} className="flex flex-col gap-3 lg:w-40">
                <p id={id} className="font-mono text-[11px] tracking-[0.14em] text-faint uppercase">
                  {title}
                </p>
                <ul className="flex flex-col gap-3">
                  {links.map(({ href, label }) => (
                    <li key={label}>
                      <Link href={href} className={LINK}>
                        {label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </nav>
            ))}
          </div>
        </div>
        <div className="flex flex-col gap-3 border-t pt-6 text-[13px] text-faint sm:flex-row sm:justify-between">
          <p>
            {t.rich("rights", { year: () => <CurrentYear />, name: projectConfig.name })} ·{" "}
            <a href={`mailto:${projectConfig.supportEmail}`} className="break-all [@media(hover:hover)]:hover:text-foreground">
              {projectConfig.supportEmail}
            </a>
          </p>
          <LocaleLinks />
        </div>
      </div>
    </footer>
  );
}
