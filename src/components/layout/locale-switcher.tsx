"use client";

import { Check, Globe } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { usePathname } from "@/i18n/navigation";
import { type Locale, LOCALE_NAMES, localePath, routing } from "@/i18n/routing";

// The current page in another locale. A plain link, as next-intl's Link
// would send English through "/en", which only redirects: unprefixed paths
// are English (src/i18n/routing.ts).
const pageIn = (locale: Locale, pathname: string) => localePath(locale, pathname === "/" ? "" : pathname);

// The header's language menu: a globe and the current locale's code ("ES").
// A menu, so it fits any number of locales. Phones get LocaleLinks in the
// header's sheet instead: here the button would squeeze the lockup.
export function LocaleSwitcher() {
  const t = useTranslations("LocaleSwitcher");
  const locale = useLocale() as Locale;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label={t("current", { name: LOCALE_NAMES[locale] })}
        className="hidden h-9 items-center gap-1.5 rounded-lg border px-2.5 text-sm font-semibold outline-hidden focus-visible:ring-2 focus-visible:ring-ring data-popup-open:bg-accent md:flex [@media(hover:hover)]:hover:bg-accent"
      >
        <Globe aria-hidden className="size-4" />
        {locale.toUpperCase()}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" sideOffset={8} className="w-44 rounded-xl p-1.5">
        <LocaleItems />
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

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
