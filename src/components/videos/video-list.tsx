import { Clapperboard, Download } from "lucide-react";
import { useFormatter, useTranslations } from "next-intl";
import { firstFrame } from "@/components/videos/player-frame";
import { Link } from "@/i18n/navigation";
import type { GeneratedVideo } from "@/lib/api";
import { cn } from "@/lib/utils";

// A card's media box: tall for a 9:16 video, so it isn't a strip between
// wide bars. Cards top-align, as an older 16:9 card is shorter.
function cardFrame(ratio: string): string {
  return ratio === "9:16" ? "aspect-[9/16]" : "aspect-video";
}

// The prompt links to the video's page and stretches over the card; the
// player and the download link sit above it.
export function VideoList({
  videos,
  ...props
}: { videos: GeneratedVideo[] } & Pick<React.ComponentProps<"ul">, "aria-label" | "aria-labelledby">) {
  const t = useTranslations("Videos");
  const format = useFormatter();

  return (
    <ul {...props} className="grid items-start gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {videos.map((video) => (
        <li
          key={video.id}
          className="relative flex flex-col overflow-hidden rounded-xl border bg-card has-focus-visible:outline-2 has-focus-visible:outline-ring"
        >
          {video.url ? (
            <video
              src={firstFrame(video.url)}
              poster={video.posterUrl ?? undefined}
              aria-label={video.prompt}
              controls
              playsInline
              preload="metadata"
              className={cn("relative z-10 w-full bg-muted object-contain", cardFrame(video.ratio))}
            />
          ) : (
            <div
              className={cn(
                "flex w-full items-center justify-center gap-2 bg-muted bg-cover bg-center p-6 text-center text-sm text-muted-foreground",
                cardFrame(video.ratio),
              )}
              style={video.imageUrl ? { backgroundImage: `url(${video.imageUrl})` } : undefined}
            >
              <span className="flex items-center gap-2 rounded-lg bg-background/90 px-3 py-1.5">
                <Clapperboard className="size-4 shrink-0" />
                {t(video.status === "failed" ? "failed" : "pending")}
              </span>
            </div>
          )}
          <div className="flex items-start gap-3 p-4">
            <div className="flex min-w-0 flex-1 flex-col gap-1">
              <Link
                href={`/videos/${video.id}`}
                className="line-clamp-2 text-sm text-pretty outline-none after:absolute after:inset-0"
              >
                {video.prompt}
              </Link>
              <p className="text-xs text-muted-foreground">
                {t("seconds", { count: video.duration })} · {video.resolution} · {video.ratio} ·{" "}
                {format.dateTime(video.createdAt, { dateStyle: "medium", timeStyle: "short" })}
              </p>
            </div>
            {video.url && (
              <a
                href={`/api/videos/${video.id}/download`}
                download
                aria-label={t("download")}
                title={t("download")}
                className="relative flex size-9 shrink-0 items-center justify-center rounded-lg text-muted-foreground transition-[background-color,color] duration-150 focus-visible:outline-2 focus-visible:outline-ring [@media(hover:hover)]:hover:bg-muted [@media(hover:hover)]:hover:text-foreground"
              >
                <Download className="size-4" />
              </a>
            )}
          </div>
        </li>
      ))}
    </ul>
  );
}
