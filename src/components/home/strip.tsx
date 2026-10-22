import { useTranslations } from "next-intl";

const ITEMS = ["1", "2", "3"] as const;

// A full-width row of short facts under the hero, split by dots.
export function Strip() {
  const t = useTranslations("Home.strip");

  return (
    <div className="-mx-5 border-y px-5 py-4 sm:-mx-8 sm:px-8">
      <ul
        aria-label={t("label")}
        className="flex flex-wrap items-center justify-center gap-x-4 gap-y-2 text-xs font-semibold tracking-[0.16em] text-muted-foreground uppercase"
      >
        {ITEMS.map((key, i) => (
          <li key={key} className="flex items-center gap-4">
            {i > 0 && <span aria-hidden className="size-1 rounded-full bg-primary-text" />}
            {t(`items.${key}`)}
          </li>
        ))}
      </ul>
    </div>
  );
}
