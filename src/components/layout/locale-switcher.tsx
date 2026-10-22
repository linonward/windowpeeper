"use client";

import { Check } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { DropdownMenuItem } from "@/components/ui/dropdown-menu";
import { Link, usePathname } from "@/i18n/navigation";
import { LOCALE_NAMES, routing } from "@/i18n/routing";

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
            <Link
              href={pathname}
              locale={other}
              lang={other}
              aria-current={other === locale ? "true" : undefined}
              className="aria-current:text-foreground [@media(hover:hover)]:hover:text-foreground"
            >
              {LOCALE_NAMES[other]}
            </Link>
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
        <Link
          href={pathname}
          locale={other}
          lang={other}
          aria-current={other === locale ? "true" : undefined}
        />
      }
      className="h-9 justify-between rounded-md px-2.5"
    >
      {LOCALE_NAMES[other]}
      {other === locale && <Check aria-hidden className="text-primary-text" />}
    </DropdownMenuItem>
  ));
}
