"use client";

import { Check } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { DropdownMenuItem } from "@/components/ui/dropdown-menu";
import { usePathname } from "@/i18n/navigation";
import { type Locale, LOCALE_NAMES, localePath, routing } from "@/i18n/routing";

// The current page in another locale. A plain link, as next-intl's Link
// would send English through "/en", which only redirects: unprefixed paths
// are English (src/i18n/routing.ts).
const pageIn = (locale: Locale, pathname: string) => localePath(locale, pathname === "/" ? "" : pathname);

// One link per locale to the current page, in a row split by dots: the
// footer's language list.
export function LocaleLinks({ className }: { className?: string }) {
  const t = useTranslations("LocaleSwitcher");
  const locale = useLocale();
  const pathname = usePathname();

  return (
    <nav aria-label={t("label")} className={className}>
      <ul className="flex flex-wrap items-center gap-x-1.5">
        {routing.locales.map((other, index) => (
          <li key={other} className="flex items-center gap-x-1.5">
            {index > 0 && <span aria-hidden>·</span>}
            <a
              href={pageIn(other, pathname)}
              lang={other}
              aria-current={other === locale ? "true" : undefined}
              className="aria-current:text-foreground [@media(hover:hover)]:hover:text-foreground"
            >
              {LOCALE_NAMES[other]}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
}

// One link per locale to the current page; also used in the account menu.
export function LocaleItems() {
  const locale = useLocale();
  const pathname = usePathname();

  return routing.locales.map((other) => (
    <DropdownMenuItem
      key={other}
      render={
        <a href={pageIn(other, pathname)} lang={other} aria-current={other === locale ? "true" : undefined} />
      }
      className="h-9 justify-between rounded-md px-2.5"
    >
      {LOCALE_NAMES[other]}
      {other === locale && <Check aria-hidden className="text-primary-text" />}
    </DropdownMenuItem>
  ));
}
