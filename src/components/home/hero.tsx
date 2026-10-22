import { useTranslations } from "next-intl";
import { projectConfig } from "project.config";
import { Example, type HomeExample } from "./example";
import { TiptoeTryout, type TiptoeTryoutProps } from "./tiptoe-tryout";

// The first screen: the tip-toe dance plays full width behind the headline,
// then the generator and the example sit side by side on large screens.
// Nothing stands between the headline and the generator, so the photo zone
// shows in the first screen on phones and laptops alike.
// The band slides under the glass header (-mt-16).
export function Hero({ tryout, example }: { tryout: TiptoeTryoutProps; example?: HomeExample }) {
  const t = useTranslations("Home.hero");

  return (
    <section className="relative isolate -mt-16 flex flex-col gap-4 pb-20 lg:gap-6">
      <div className="relative isolate flex items-center overflow-hidden pt-16">
        {example && <Backdrop example={example} />}
        <div className="mx-auto flex w-full max-w-6xl flex-col items-center gap-4 px-5 pt-6 pb-2 text-center sm:px-8 lg:gap-5 lg:py-10">
          <p className="inline-flex items-center gap-2 rounded-full border border-primary-text/60 bg-background/55 px-3 py-1 text-sm backdrop-blur-md">
            <span aria-hidden className="size-1.5 rounded-full bg-primary-text" />
            {/* On phones the badge keeps to one line: the trend, not the name the header shows. */}
            <span className="font-medium max-sm:hidden">{projectConfig.name}</span>{" "}
            <span className="text-muted-foreground">{t("eyebrow")}</span>
          </p>
          {/* The h1 leads with the query the page targets, then the tagline.
              "Rumpelstiltskin" can't wrap, so the size follows the width. */}
          <h1 className="display-tight flex flex-col items-center gap-3 hyphens-auto [overflow-wrap:break-word] font-display font-bold text-balance break-keep">
            <span className="block text-[clamp(1.75rem,8.2vw,4.5rem)] leading-[1.05] lg:max-w-[20ch] lg:text-[4.75rem] [text-shadow:0_2px_24px_var(--background)]">
              {t("heading")}
            </span>
            {/* Search engines and screen readers read the h1 as one line; the
                dash keeps the query apart from the tagline. */}
            {" "}
            <span className="sr-only">—</span>{" "}
            <span className="block text-[clamp(1.125rem,4.4vw,2rem)] leading-tight text-primary-text">
              {t("title")}
            </span>
          </h1>
          <p className="max-w-[52ch] text-base leading-7 text-pretty text-foreground/80 sm:text-xl sm:leading-8">{t("body")}</p>
        </div>
      </div>
      <div className="mx-auto grid w-full max-w-6xl grid-cols-1 items-start gap-6 px-5 sm:px-8 lg:grid-cols-2">
        <TiptoeTryout {...tryout} />
        <Example example={example} />
      </div>
    </section>
  );
}

// The dance behind the headline, faded into the page at the bottom. With
// reduced motion the video hides and its poster stays.
function Backdrop({ example }: { example: HomeExample }) {
  return (
    <div aria-hidden className="absolute inset-0 -z-10">
      <div className="absolute inset-0 bg-cover bg-center" style={{ backgroundImage: `url(${example.poster})` }} />
      <video
        src={example.sample}
        poster={example.poster}
        aria-hidden="true"
        tabIndex={-1}
        autoPlay
        muted
        loop
        playsInline
        className="absolute inset-0 size-full object-cover motion-reduce:hidden"
      />
      <div className="absolute inset-0 bg-[linear-gradient(to_bottom,color-mix(in_oklab,var(--background)_45%,transparent),color-mix(in_oklab,var(--background)_70%,transparent)_55%,var(--background))]" />
    </div>
  );
}
