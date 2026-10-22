import { AppWindow, Download, Upload } from "lucide-react";
import { useTranslations } from "next-intl";

const STEPS = [
  { key: "1", icon: Upload },
  { key: "2", icon: AppWindow },
  { key: "3", icon: Download },
] as const;

// The title and a line on the left; three ruled rows on the right, each a
// big lamp number, a title and a body, and an icon.
export function HowItWorks() {
  const t = useTranslations("Home.steps");

  return (
    <section id="how-it-works" aria-labelledby="how-it-works-title" className="scroll-mt-16">
      <div className="mx-auto grid w-full max-w-6xl grid-cols-1 gap-10 px-5 py-20 sm:px-8 lg:grid-cols-[380px_minmax(0,1fr)] lg:gap-20 lg:py-28">
        <div className="flex flex-col gap-4">
          <p className="eyebrow">{t("eyebrow")}</p>
          <h2
            id="how-it-works-title"
            className="font-display text-[clamp(2.5rem,10vw,3.25rem)] leading-none font-extrabold text-balance"
          >
            {t("title")}
          </h2>
          <p className="leading-normal text-muted-foreground">{t("body")}</p>
        </div>
        <ol>
          {STEPS.map(({ key, icon: Icon }) => (
            <li key={key} className="flex gap-5 border-b py-7 last:border-b-0 sm:gap-7">
              <span aria-hidden className="font-display text-[3.5rem] leading-[0.9] font-black text-primary">
                {key.padStart(2, "0")}
              </span>
              <div className="flex min-w-0 flex-1 flex-col gap-2">
                <h3 className="text-[22px] font-semibold">{t(`items.${key}.title`)}</h3>
                <p className="leading-[1.55] text-pretty text-muted-foreground">{t(`items.${key}.body`)}</p>
              </div>
              <Icon aria-hidden className="hidden size-6 shrink-0 text-faint sm:block" />
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
