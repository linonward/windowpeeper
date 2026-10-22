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
  // The price of one video, Standard and Pro.
  credits: number;
  proCredits: number;
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

// The dashboard's video form (docs/DESIGN.md, New video): two choices side
// by side (the photo, the window) and one action row (the consent box, the
// quality and the button, with the price); then the newest videos. On
// phones the action row is a bar at the bottom. Without enough credits the
// button opens the buy-credits dialog.
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
      size="lg"
      aria-label={!submitting && canAfford ? tg("submitLong", { count: cost }) : undefined}
      className="h-12 min-w-0 flex-1 lg:h-[46px] lg:w-[260px] lg:flex-none"
      disabled={canAfford ? !ready || submitting : !buyCredits}
    >
      {submitting ? (
        t("generating")
      ) : canAfford ? (
        <>
          <span className="lg:hidden">{tg("submit", { count: cost })}</span>
          <span className="max-lg:hidden">{tg("submitLong", { count: cost })}</span>
        </>
      ) : (
        tg("buy")
      )}
      {!submitting && <ArrowRight className="icon-nudge" />}
    </Button>
  );

  return (
    <>
      <header className="flex flex-wrap items-end justify-between gap-4">
        <h1 className="font-display text-[clamp(1.875rem,8vw,2.5rem)] leading-tight font-extrabold text-balance">
          {tg("title")}
        </h1>
        {pendingIds.length > 0 && (
          <RecBadge className="border bg-card">{tg("rendering", { count: pendingIds.length })}</RecBadge>
        )}
      </header>

      <form id="new-video" onSubmit={submit} className="flex flex-col gap-4">
        {!props.enabled && <p className="text-muted-foreground">{t("disabled")}</p>}
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-[320px_minmax(0,1fr)]">
          <Card title={tg("photo.title")} id="new-photo">
            <input
              id="new-photo-input"
              type="file"
              accept="image/jpeg,image/png,image/webp"
              onChange={(event) => pick("left", event.target.files?.[0] ?? null)}
              aria-labelledby="new-photo"
              className="peer sr-only"
            />
            {photo && previews.left ? (
              <div className="flex items-center gap-4 lg:flex-1 lg:flex-col lg:items-stretch lg:gap-3">
                <div className="relative shrink-0 lg:min-h-[240px] lg:flex-1">
                  {/* A local object URL, which next/image can't optimize. */}
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={previews.left}
                    alt={t("left.preview")}
                    className="h-[110px] w-[88px] rounded-sm border border-border-strong object-cover lg:absolute lg:inset-0 lg:size-full lg:rounded-lg"
                  />
                  <span className="absolute bottom-2.5 left-2.5 flex items-center gap-1.5 rounded-sm bg-background/80 px-2 py-1 text-xs font-medium text-ok max-lg:hidden">
                    <CircleCheck aria-hidden className="size-3.5" />
                    {tg("photo.ready", { size: megabytes(photo.size) })}
                  </span>
                </div>
                <div className="flex min-w-0 flex-1 flex-col gap-1 lg:hidden">
                  <span className="truncate text-sm font-semibold">{photo.name}</span>
                  <span className="flex items-center gap-1.5 text-xs text-ok">
                    <CircleCheck aria-hidden className="size-3.5" />
                    {tg("photo.ready", { size: megabytes(photo.size) })}
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  <p className="flex-1 text-xs leading-[1.4] text-faint max-lg:hidden">{tg("photo.tip")}</p>
                  <label
                    htmlFor="new-photo-input"
                    className={cn(buttonVariants({ variant: "outline" }), "h-9 cursor-pointer px-3.5 peer-focus-visible:ring-3")}
                  >
                    {tg("photo.replace")}
                  </label>
                </div>
              </div>
            ) : (
              <label
                htmlFor="new-photo-input"
                className="flex cursor-pointer items-center gap-4 rounded-lg border border-border-strong bg-background px-5 py-[18px] peer-focus-visible:border-ring peer-focus-visible:ring-3 peer-focus-visible:ring-ring/50 peer-disabled:cursor-not-allowed peer-disabled:opacity-50 lg:flex-1 lg:flex-col lg:justify-center lg:border-dashed lg:text-center [@media(hover:hover)]:hover:border-primary/60"
              >
                <span aria-hidden className="flex size-12 shrink-0 items-center justify-center rounded-sm bg-primary-soft">
                  <ImagePlus className="size-[22px] text-primary-text" />
                </span>
                <span className="flex min-w-0 flex-col gap-0.5 lg:gap-1.5">
                  <span className="text-sm font-semibold">{tg("photo.choose")}</span>
                  <span className="text-xs text-faint">{t("photoHint", { size })}</span>
                </span>
              </label>
            )}
          </Card>

          <Card title={tg("scene.title")} id="new-scene">
            <div role="radiogroup" aria-labelledby="new-scene" className="grid grid-cols-3 gap-2.5 sm:gap-3">
              {SCENES.map((each) => (
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
                  <span className="truncate px-1 pb-0.5 text-[13px] font-medium text-muted-foreground group-has-checked:font-semibold group-has-checked:text-foreground">
                    <span className="sm:hidden">{ts(`${each}.short`)}</span>
                    <span className="max-sm:hidden">{ts(`${each}.name`)}</span>
                  </span>
                </label>
              ))}
            </div>
          </Card>
        </div>

        {error && (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}

        {/* The consent box, the quality and the button, together: a card on
            large screens, a bar fixed at the bottom on phones. */}
        <section
          aria-label={tg("action")}
          className="flex flex-col gap-2.5 bg-card max-lg:fixed max-lg:inset-x-0 max-lg:bottom-0 max-lg:z-30 max-lg:border-t max-lg:border-border-strong max-lg:px-4 max-lg:pt-3.5 max-lg:pb-6 lg:flex-row lg:items-center lg:gap-6 lg:rounded-xl lg:border lg:px-6 lg:py-5"
        >
          <div className="flex min-w-0 flex-col gap-2 lg:flex-1">
            <label className="flex items-start gap-2.5 text-xs leading-[1.4] text-pretty text-muted-foreground lg:items-center lg:text-[13px]">
              <input
                type="checkbox"
                checked={consent}
                onChange={(event) => setConsent(event.target.checked)}
                className="size-[18px] shrink-0 cursor-pointer accent-primary"
              />
              {t("consent")}
            </label>
            <p className="text-xs text-pretty text-faint max-lg:hidden">
              {tg(`quality.${quality}.time`)} {tg("note", { count: cost })}
            </p>
          </div>
          <div className="flex items-center gap-2 lg:gap-3">
            <div
              role="radiogroup"
              aria-label={tg("quality.title")}
              className="flex h-12 shrink-0 gap-1 rounded-lg border bg-background p-1 lg:h-[46px]"
            >
              {QUALITIES.map((each) => (
                <label
                  key={each}
                  className="group flex cursor-pointer items-center gap-1.5 rounded-sm border border-transparent px-2.5 has-checked:border-primary has-checked:bg-primary-soft has-focus-visible:ring-3 has-focus-visible:ring-ring/50 lg:px-3.5"
                >
                  <input
                    type="radio"
                    name="new-quality"
                    value={each}
                    checked={quality === each}
                    onChange={() => setQuality(each)}
                    className="sr-only"
                  />
                  <span className="text-[13px] font-semibold text-muted-foreground group-has-checked:text-foreground max-lg:hidden">
                    {tg(`quality.${each}.name`)}
                  </span>{" "}
                  <span className="font-mono text-xs text-faint group-has-checked:text-primary-text max-lg:text-[13px] max-lg:font-semibold max-lg:text-muted-foreground max-lg:group-has-checked:text-foreground">
                    {tg(`quality.${each}.resolution`)}
                  </span>
                </label>
              ))}
            </div>
            {submitButton}
          </div>
        </section>
      </form>

      <Recent videos={videos} />

      {/* Phones: room for the bar fixed at the bottom. */}
      <div aria-hidden className="h-24 lg:hidden" />
    </>
  );
}

const megabytes = (bytes: number) => (bytes / 1024 / 1024).toFixed(1);

// A card with a title.
function Card({ title, id, children }: { title: string; id: string; children: React.ReactNode }) {
  return (
    <section aria-labelledby={id} className="flex min-w-0 flex-col gap-4 rounded-xl border bg-card p-4 sm:p-6">
      <h2 id={id} className="text-base font-semibold">
        {title}
      </h2>
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
