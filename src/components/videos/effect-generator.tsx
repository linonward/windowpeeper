"use client";

import { AlertTriangle, ArrowRight, Check, CircleCheck, ImagePlus, LoaderCircle, Play } from "lucide-react";
import Image from "next/image";
import { useFormatter, useNow, useTranslations } from "next-intl";
import { useState } from "react";
import { useBuyCredits } from "@/components/billing/buy-credits";
import { useCreditBalance } from "@/components/dashboard/credits";
import { RecBadge } from "@/components/home/rec-badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { usePendingPoll } from "@/hooks/use-pending-poll";
import { Link } from "@/i18n/navigation";
import type { ApiBody, ApiErrorCode, GeneratedVideo, Serialized, VideoResponse } from "@/lib/api";
import { type ImageLimits, limitValues } from "@/lib/image-limits";
import { type PhotoEffectKind, type Scene, sceneImage, SCENES } from "@/lib/photo-effects";
import { cn } from "@/lib/utils";
import { useEffectMessages } from "./effect-messages";
import { usePhotoPicks } from "./use-photo-picks";

type Video = GeneratedVideo;

export type EffectGeneratorProps = {
  kind: PhotoEffectKind;
  balance: number;
  // The price of one video, Standard and Pro, and its length in seconds.
  credits: number;
  proCredits: number;
  duration: number;
  // The largest photo a visitor may pick, which the copy states, and the
  // largest the server takes, which the browser shrinks it to fit.
  maxPickBytes: number;
  maxUploadBytes: number;
  // The pixel sizes Bailian accepts.
  imageLimits: ImageLimits;
  // False without Bailian or storage.
  enabled: boolean;
  videos: Video[];
};

const QUALITIES = ["standard", "pro"] as const;
type Quality = (typeof QUALITIES)[number];
// Every video is vertical, the shape of TikTok, Reels and Shorts.
const RATIO = "9:16";
const POLL_MS = 5000;
// The newest videos the page shows.
const RECENT = 4;

const ERRORS = {
  INSUFFICIENT_CREDITS: "errors.credits",
  INVALID_REQUEST: "errors.invalid",
  INVALID_IMAGE_SIZE: "errors.imageSize",
  CONTENT_BLOCKED: "errors.blocked",
  MODERATION_UNAVAILABLE: "errors.moderation",
  VIDEOS_DISABLED: "disabled",
} as const satisfies Partial<Record<ApiErrorCode, string>>;

const parse = (video: Serialized<Video>): Video => ({ ...video, createdAt: new Date(video.createdAt) });
const sceneOf = (value: string | null): Scene => SCENES.find((each) => each === value) ?? SCENES[0];

// The dashboard's video form (docs/DESIGN.md, New video): three numbered
// cards (the photo, the scene, the quality) and a summary with the scene's
// preview, what the video will be and costs, and the button; then the
// newest videos. On phones the summary is a bar at the bottom. Without
// enough credits the button opens the buy-credits dialog.
export function EffectGenerator(props: EffectGeneratorProps) {
  const endpoint = `/api/videos/${props.kind}`;
  const t = useEffectMessages(props.kind);
  const tg = useTranslations("Generator");
  const ts = useTranslations("PhotoEffects.scenes");
  const buyCredits = useBuyCredits();
  const { balance, adjust: adjustCredits } = useCreditBalance(props.balance);
  const [videos, setVideos] = useState(props.videos);
  const [scene, setScene] = useState<Scene>(SCENES[0]);
  const [quality, setQuality] = useState<Quality>("standard");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // The server requires it (consent=yes) and records when it was given.
  const [consent, setConsent] = useState(false);

  const cost = quality === "pro" ? props.proCredits : props.credits;
  const canAfford = balance >= cost;
  const size = Math.round(props.maxPickBytes / 1024 / 1024);
  const { min, max: maxSide, ratio } = limitValues(props.imageLimits);
  const messageValues = { size, min, maxSide, ratio };
  const { photos, previews, pick } = usePhotoPicks({
    maxPickBytes: props.maxPickBytes,
    maxUploadBytes: props.maxUploadBytes,
    imageLimits: props.imageLimits,
    onError: (key) => setError(key && t(`errors.${key}`, messageValues)),
  });
  const photo = photos.left;
  const ready = props.enabled && photo !== null && consent;
  const pendingIds = videos.filter((video) => video.status === "pending").map((video) => video.id);
  const sceneName = ts(`${scene}.name`);
  const qualityName = tg(`quality.${quality}.name`);

  // A failure was refunded on the server, so the balance gets the credits back.
  usePendingPoll({
    ids: pendingIds,
    intervalMs: POLL_MS,
    url: (id) => `/api/videos/${id}`,
    onBody: (id, body) => {
      const { video } = body as ApiBody<VideoResponse>;
      if (!video || video.status === "pending") return;
      const updated = parse(video);
      setVideos((current) => current.map((item) => (item.id === id ? updated : item)));
      if (updated.status === "failed") adjustCredits(updated.credits, `video-refund:${id}`);
    },
  });

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!canAfford) {
      buyCredits?.open();
      return;
    }
    if (!ready || !photo) return;
    setSubmitting(true);
    setError(null);
    const form = new FormData();
    form.set("image1", photo);
    form.set("scene", scene);
    form.set("quality", quality);
    form.set("ratio", RATIO);
    form.set("consent", "yes");
    const response = await fetch(endpoint, { method: "POST", body: form }).catch(() => null);
    const body: ApiBody<VideoResponse> = response ? await response.json().catch(() => ({})) : {};
    setSubmitting(false);

    const { video } = body;
    if (response?.ok && video) {
      setVideos((current) => [parse(video), ...current]);
      adjustCredits(-video.credits, `video:${video.id}`);
      return;
    }
    if (body.error === "INSUFFICIENT_CREDITS") buyCredits?.open();
    setError(t(ERRORS[body.error as keyof typeof ERRORS] ?? "errors.failed", messageValues));
  }

  const submitButton = (
    <Button
      type="submit"
      form="new-video"
      size="lg"
      className="h-[52px] w-full"
      disabled={canAfford ? !ready || submitting : !buyCredits}
    >
      {submitting ? t("generating") : canAfford ? tg("submit", { count: cost }) : tg("buy")}
      {!submitting && <ArrowRight className="icon-nudge" />}
    </Button>
  );

  return (
    <>
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex min-w-0 flex-col gap-1.5">
          <p className="font-mono text-[11px] tracking-[0.15em] text-faint uppercase max-md:hidden">{tg("crumb")}</p>
          <h1 className="font-display text-[clamp(1.875rem,8vw,2.5rem)] leading-tight font-extrabold text-balance">
            {tg("title")}
          </h1>
        </div>
        {pendingIds.length > 0 && (
          <RecBadge className="border bg-card">{tg("rendering", { count: pendingIds.length })}</RecBadge>
        )}
      </header>

      <div className="grid grid-cols-1 items-start gap-7 lg:grid-cols-[minmax(0,1fr)_340px]">
        <form id="new-video" onSubmit={submit} className="flex min-w-0 flex-col gap-4">
          {!props.enabled && <p className="text-muted-foreground">{t("disabled")}</p>}
          <Card number="01" title={tg("photo.title")} hint={tg("photo.hint")} id="new-photo">
            <input
              id="new-photo-input"
              type="file"
              accept="image/jpeg,image/png,image/webp"
              onChange={(event) => pick("left", event.target.files?.[0] ?? null)}
              aria-labelledby="new-photo"
              className="peer sr-only"
            />
            {photo && previews.left ? (
              <div className="flex items-center gap-4">
                {/* A local object URL, which next/image can't optimize. */}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={previews.left}
                  alt={t("left.preview")}
                  className="h-[110px] w-[88px] shrink-0 rounded-sm border border-border-strong object-cover"
                />
                <div className="flex min-w-0 flex-1 flex-col gap-1">
                  <span className="truncate text-sm font-semibold">{photo.name}</span>
                  <span className="flex items-center gap-1.5 text-xs text-ok">
                    <CircleCheck aria-hidden className="size-3.5" />
                    {tg("photo.ready", { size: (photo.size / 1024 / 1024).toFixed(1) })}
                  </span>
                </div>
                <label
                  htmlFor="new-photo-input"
                  className={cn(buttonVariants({ variant: "outline" }), "h-9 cursor-pointer px-3.5 peer-focus-visible:ring-3")}
                >
                  {tg("photo.replace")}
                </label>
              </div>
            ) : (
              <label
                htmlFor="new-photo-input"
                className="flex cursor-pointer items-center gap-4 rounded-lg border border-border-strong bg-background px-5 py-[18px] peer-focus-visible:border-ring peer-focus-visible:ring-3 peer-focus-visible:ring-ring/50 peer-disabled:cursor-not-allowed peer-disabled:opacity-50 [@media(hover:hover)]:hover:border-primary/60"
              >
                <span aria-hidden className="flex size-12 shrink-0 items-center justify-center rounded-sm bg-primary-soft">
                  <ImagePlus className="size-[22px] text-primary-text" />
                </span>
                <span className="flex min-w-0 flex-col gap-0.5">
                  <span className="text-sm font-semibold">{tg("photo.choose")}</span>
                  <span className="text-xs text-faint">{t("photoHint", { size })}</span>
                </span>
              </label>
            )}
          </Card>

          <Card number="02" title={tg("scene.title")} hint={tg("scene.hint", { count: SCENES.length })} id="new-scene">
            <div role="radiogroup" aria-labelledby="new-scene" className="grid grid-cols-3 gap-2.5 sm:gap-3">
              {SCENES.map((each, index) => (
                <label
                  key={each}
                  className="group flex cursor-pointer flex-col gap-2 rounded-lg border p-1.5 has-checked:border-2 has-checked:border-primary has-checked:bg-primary-soft has-checked:p-[5px] has-focus-visible:ring-3 has-focus-visible:ring-ring/50"
                >
                  <input
                    type="radio"
                    name="new-scene"
                    value={each}
                    checked={scene === each}
                    onChange={() => setScene(each)}
                    className="peer sr-only"
                  />
                  <span className="relative block h-20 overflow-hidden rounded-sm sm:h-[120px]">
                    <Image src={sceneImage(each)} alt="" fill sizes="(min-width: 640px) 220px, 30vw" className="object-cover" />
                    {scene === each && (
                      <span aria-hidden className="absolute top-2 left-2 flex size-[22px] items-center justify-center rounded-full bg-primary">
                        <Check className="size-3.5 text-primary-foreground" />
                      </span>
                    )}
                  </span>
                  <span className="flex items-baseline justify-between gap-2 px-1 pb-0.5">
                    <span className="truncate text-[13px] font-medium text-muted-foreground group-has-checked:font-semibold group-has-checked:text-foreground">
                      <span className="sm:hidden">{ts(`${each}.short`)}</span>
                      <span className="max-sm:hidden">{ts(`${each}.name`)}</span>
                    </span>
                    {index === 0 && (
                      <span className="font-mono text-[10px] tracking-[0.1em] text-primary-text uppercase max-sm:hidden">
                        {tg("scene.original")}
                      </span>
                    )}
                  </span>
                </label>
              ))}
            </div>
          </Card>

          <Card number="03" title={tg("quality.title")} id="new-quality">
            <div role="radiogroup" aria-labelledby="new-quality" className="grid gap-3 sm:grid-cols-2">
              {QUALITIES.map((each) => (
                <label
                  key={each}
                  className="flex cursor-pointer items-center gap-3 rounded-lg border bg-background p-4 has-checked:border-2 has-checked:border-primary has-checked:bg-primary-soft has-checked:p-[15px]"
                >
                  <input
                    type="radio"
                    name="new-quality"
                    value={each}
                    checked={quality === each}
                    onChange={() => setQuality(each)}
                    className="size-4 shrink-0 cursor-pointer appearance-none rounded-full border-[1.5px] border-border-strong checked:border-primary checked:bg-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                  />
                  <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                    <span className="text-[15px] font-semibold">{tg(`quality.${each}.name`)}</span>
                    <span className="text-xs text-muted-foreground">{tg(`quality.${each}.description`)}</span>
                  </span>
                  <span
                    className={cn(
                      "font-mono text-[13px] font-semibold",
                      quality === each ? "text-primary-text" : "text-muted-foreground",
                    )}
                  >
                    {tg("cr", { count: each === "pro" ? props.proCredits : props.credits })}
                  </span>
                </label>
              ))}
            </div>
          </Card>

          <label className="flex items-start gap-2.5 px-1 text-[13px] leading-[1.4] text-pretty text-muted-foreground">
            <input
              type="checkbox"
              checked={consent}
              onChange={(event) => setConsent(event.target.checked)}
              className="mt-px size-[18px] shrink-0 cursor-pointer accent-primary"
            />
            {t("consent")}
          </label>
          {error && (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}
        </form>

        <aside
          aria-label={tg("summary.label")}
          className="flex flex-col gap-4 rounded-xl border bg-card p-5 max-lg:hidden lg:sticky lg:top-8"
        >
          <p className="font-mono text-[11px] tracking-[0.15em] text-faint uppercase">{tg("summary.label")}</p>
          <div className="relative isolate flex h-[300px] flex-col justify-between overflow-hidden rounded-lg p-3">
            <Image src={sceneImage(scene)} alt="" fill sizes="300px" className="-z-10 object-cover" />
            <div aria-hidden className="absolute inset-x-0 bottom-0 -z-10 h-1/3 bg-linear-to-b from-transparent to-background/90" />
            <RecBadge>{tg("summary.scene", { number: String(SCENES.indexOf(scene) + 1).padStart(2, "0") })}</RecBadge>
            <span className="font-mono text-[11px] tracking-[0.09em]">
              {tg("summary.caption", { scene: sceneName, seconds: props.duration })}
            </span>
          </div>
          <dl className="flex flex-col">
            {[
              [tg("summary.length"), tg("summary.lengthValue", { seconds: props.duration })],
              [tg("summary.format"), tg("summary.formatValue")],
              [tg("summary.quality"), tg(`quality.${quality}.summary`)],
              [tg("summary.cost"), tg("summary.costValue", { count: cost })],
              [tg("summary.after"), tg("summary.costValue", { count: Math.max(balance - cost, 0) })],
            ].map(([key, value], index) => (
              <div key={key} className="flex justify-between gap-3 border-b py-[9px] text-[13px] last:border-b-0">
                <dt className="text-muted-foreground">{key}</dt>
                <dd className={index === 3 ? "font-semibold text-primary-text" : "font-medium"}>{value}</dd>
              </div>
            ))}
          </dl>
          {submitButton}
          <p className="text-xs text-pretty text-faint">{tg("summary.note", { count: cost })}</p>
        </aside>
      </div>

      <Recent videos={videos} />

      {/* Phones: room for the bar below, then the bar: what the video is and
          costs, and the button. */}
      <div aria-hidden className="h-16 lg:hidden" />
      <div className="fixed inset-x-0 bottom-0 z-30 flex flex-col gap-2.5 border-t border-border-strong bg-card px-4 pt-3.5 pb-6 lg:hidden">
        <p className="flex justify-between gap-3 text-[13px]">
          <span className="truncate text-muted-foreground">{tg("bar.line", { scene: sceneName, quality: qualityName })}</span>
          <span className="shrink-0 font-semibold text-primary-text">
            {tg("bar.cost", { count: cost, left: Math.max(balance - cost, 0) })}
          </span>
        </p>
        {submitButton}
      </div>
    </>
  );
}

// A numbered card with a title and a hint on the right.
function Card({
  number,
  title,
  hint,
  id,
  children,
}: {
  number: string;
  title: string;
  hint?: string;
  id: string;
  children: React.ReactNode;
}) {
  return (
    <section aria-labelledby={id} className="flex flex-col gap-4 rounded-xl border bg-card p-4 sm:p-6">
      <div className="flex items-center gap-2.5">
        <span aria-hidden className="font-mono text-xs text-primary-text">
          {number}
        </span>
        <h2 id={id} className="flex-1 text-base font-semibold">
          {title}
        </h2>
        {hint && <span className="text-xs text-faint max-sm:hidden">{hint}</span>}
      </div>
      {children}
    </section>
  );
}

// The newest videos: a poster, the scene, the status and what to do next.
function Recent({ videos }: { videos: Video[] }) {
  const tg = useTranslations("Generator");
  const ts = useTranslations("PhotoEffects.scenes");
  const format = useFormatter();
  // "Ready · 5 minutes ago" counts from this, and moves on each minute.
  const now = useNow({ updateInterval: 60_000 });
  const recent = videos.slice(0, RECENT);

  return (
    <section aria-labelledby="recent-videos" className="flex flex-col gap-3.5">
      <div className="flex items-center justify-between gap-4">
        <h2 id="recent-videos" className="text-base font-semibold">
          {tg("recent.title")}
        </h2>
        {videos.length > 0 && (
          <Link href="/videos/library" className="text-[13px] font-medium text-primary-text">
            {tg("recent.all")} →
          </Link>
        )}
      </div>
      {recent.length === 0 ? (
        <p className="text-sm text-muted-foreground">{tg("recent.empty")}</p>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {recent.map((video) => {
            const scene = sceneOf(video.scene);
            return (
              <li
                key={video.id}
                className={cn(
                  "relative flex items-center gap-3 rounded-lg border bg-card p-2.5",
                  video.status === "pending" && "border-primary",
                )}
              >
                <span className="relative flex h-24 w-[54px] shrink-0 items-center justify-center overflow-hidden rounded-sm bg-muted">
                  <Image
                    src={video.posterUrl ?? video.imageUrl ?? sceneImage(scene)}
                    alt=""
                    fill
                    sizes="54px"
                    unoptimized={Boolean(video.posterUrl ?? video.imageUrl)}
                    className="object-cover opacity-60"
                  />
                  {video.status === "pending" ? (
                    <LoaderCircle aria-hidden className="relative size-[18px] animate-spin motion-reduce:animate-none" />
                  ) : video.status === "failed" ? (
                    <AlertTriangle aria-hidden className="relative size-[18px] text-rec" />
                  ) : (
                    <Play aria-hidden className="relative size-[18px]" />
                  )}
                </span>
                <span className="flex min-w-0 flex-1 flex-col gap-1.5">
                  <Link
                    href={`/videos/${video.id}`}
                    className="truncate text-sm font-semibold outline-none after:absolute after:inset-0 focus-visible:underline"
                  >
                    {video.scene ? ts(`${scene}.name`) : video.prompt}
                  </Link>
                  {video.status === "pending" ? (
                    <>
                      <span className="text-xs text-primary-text">{tg("recent.rendering")}</span>
                      <span aria-hidden className="h-1 overflow-hidden rounded-sm bg-border">
                        <span className="block h-full w-1/3 animate-pulse rounded-sm bg-primary" />
                      </span>
                    </>
                  ) : video.status === "failed" ? (
                    <>
                      <span className="text-xs text-rec">{tg("recent.failed", { count: video.credits })}</span>
                      <a href="#new-video" className="relative w-fit text-xs font-semibold">
                        {tg("recent.retry")}
                      </a>
                    </>
                  ) : (
                    <>
                      <span className="text-xs text-muted-foreground">
                        {tg("recent.ready", { time: format.relativeTime(video.createdAt, now) })}
                      </span>
                      {video.url && (
                        <a
                          href={`/api/videos/${video.id}/download`}
                          download
                          className="relative w-fit text-xs font-semibold text-primary-text"
                        >
                          {tg("recent.download")}
                        </a>
                      )}
                    </>
                  )}
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
