import { useTranslations } from "next-intl";

// The tip-toe dance a video follows, from public/: its MP4 and a poster
// frame. The copy describes that clip as the dance, not as a result.
export type HomeExample = { sample: string; poster: string };

// "See the dance": a card beside the generator. Nothing shows without a clip.
export function Example({ example }: { example?: HomeExample }) {
  const t = useTranslations("Home.example");
  if (!example) return null;

  return (
    <section aria-labelledby="example" className="flex min-w-0 flex-col gap-5 rounded-2xl border bg-card p-5 sm:p-6">
      <div className="flex flex-col gap-1">
        <p className="eyebrow">{t("eyebrow")}</p>
        <h2 id="example" className="font-display text-lg font-semibold">
          {t("title")}
        </h2>
      </div>
      <video
        src={example.sample}
        poster={example.poster}
        aria-label={t("video")}
        autoPlay
        muted
        loop
        playsInline
        controls
        preload="metadata"
        className="aspect-video w-full rounded-xl border bg-muted"
      />
      <p className="text-sm text-muted-foreground">{t("note")}</p>
    </section>
  );
}
