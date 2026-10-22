"use client";

import { ArrowRight, Ban, Download, ImagePlus, LoaderCircle, LockKeyhole, Share2, ShieldCheck } from "lucide-react";
import Image from "next/image";
import { useLocale, useTranslations } from "next-intl";
import { useEffect, useRef, useState } from "react";
import { cn } from "cn";
import { LoginForm } from "@/components/auth/login-form";
import { type Pack, PackBenefits, PackOptions, useMoney, type VideoPrices } from "@/components/billing/packs";
import { redirectFrom } from "@/components/billing/redirect";
import { Button, buttonVariants } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useEffectMessages } from "@/components/videos/effect-messages";
import { playerFrame } from "@/components/videos/player-frame";
import { usePhotoPicks } from "@/components/videos/use-photo-picks";
import { usePendingPoll } from "@/hooks/use-pending-poll";
import { track } from "@/lib/analytics";
import type { ApiBody, ApiErrorCode, GeneratedVideo, Serialized, VideoResponse } from "@/lib/api";
import { authClient } from "@/lib/auth-client";
import { type ImageLimits, limitValues } from "@/lib/image-limits";
import { clearPhotoDraft, loadPhotoDraft, type PhotoDraft, savePhotoDraft } from "@/lib/photo-draft";
import { type Scene, sceneImage, SCENES } from "@/lib/photo-effects";
import { SCENE_EVENT } from "./scene-event";
import { localePath, type Locale } from "@/i18n/routing";

// The photo types the server takes; a drop of another type is refused here.
const PHOTO_TYPES = ["image/jpeg", "image/png", "image/webp"];

export type WindowPeeperTryoutProps = {
  // The fixed price of one video, standard and Pro. The home page sells
  // Standard; Pro is on the dashboard.
  credits: number;
  proCredits: number;
  // The largest photo a visitor may pick, which the copy states, and the
  // largest the server takes, which the browser shrinks it to fit.
  maxPickBytes: number;
  maxUploadBytes: number;
  imageLimits: ImageLimits;
  // False without Bailian or storage.
  enabled: boolean;
  // The credit packs on sale, smallest first, offered when credits run short,
  // and the one recommended to start with.
  packs: readonly Pack[];
  featured: string;
};

const ENDPOINT = "/api/videos/windowpeeper";
const DRAFT_KEY = "home:windowpeeper";
// Sign-in and checkout return with it, so the page sends the saved photo.
const RESUME = "try";
// Checkout adds it: success or cancel (src/app/api/payment/checkout/route.ts).
const CHECKOUT = "checkout";
// The draft fields that record the consent, the scene and the format.
const CONSENT = "consent";
const SCENE = "scene";
const RATIO = "ratio";
const sceneOf = (value: string | undefined): Scene => SCENES.find((each) => each === value) ?? SCENES[0];
// Every video is vertical (9:16), the shape of TikTok, Reels and Shorts, where
// the meme lives. A draft saved when the form offered widescreen keeps it.
const VERTICAL = "9:16";
const ratioOf = (value: string | undefined) => (value === "16:9" ? "16:9" : VERTICAL);
// As EffectGenerator polls.
const POLL_MS = 5000;
// The webhook credits a payment within a minute or so; until then a send
// answers 402. After a payment, send every 3 s for 90 s.
const RETRY_MS = 3000;
const TRIES = 30;

const ERRORS = {
  INVALID_REQUEST: "errors.invalid",
  INVALID_IMAGE_SIZE: "errors.imageSize",
  CONTENT_BLOCKED: "errors.blocked",
  MODERATION_UNAVAILABLE: "errors.moderation",
  VIDEOS_DISABLED: "disabled",
} as const satisfies Partial<Record<ApiErrorCode, string>>;

const parse = (video: Serialized<GeneratedVideo>): GeneratedVideo => ({
  ...video,
  createdAt: new Date(video.createdAt),
});

// The window peeper video on the home page, from photo to finished video, in
// the boards' two steps: the photo, then the scene (the Scenes section below
// picks one too, through SCENE_EVENT), a consent checkbox and one button.
// It makes a Standard video.
// A signed-out visitor signs in from a dialog; the photo and the choice wait
// in the browser and go out when sign-in brings them back here. Without enough credits, it offers the packs
// and goes to checkout the same way; back from a payment, it sends once the
// credits arrive. The video then renders in place: progress, then a player
// with download and share. Each step the visitor takes is a funnel event
// (src/lib/analytics.ts), sent from its handler so it counts once.
export function WindowPeeperTryout(props: WindowPeeperTryoutProps) {
  const t = useEffectMessages("windowpeeper");
  const tt = useTranslations("HomeTryout");
  const tb = useTranslations("Billing");
  const locale = useLocale();
  const session = authClient.useSession();
  const [scene, setScene] = useState<Scene>(SCENES[0]);
  const [consent, setConsent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Packs on offer: credits ran short, or checkout was canceled.
  const [offer, setOffer] = useState<"short" | "canceled" | null>(null);
  // The pack picked; null picks the smallest that pays for the video.
  const [packId, setPackId] = useState<string | null>(null);
  const [buying, setBuying] = useState(false);
  const [buyError, setBuyError] = useState<string | null>(null);
  // Back from a payment: waiting for the credits, or given up on them.
  const [paid, setPaid] = useState<"waiting" | "late" | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [signIn, setSignIn] = useState<string | null>(null);
  const [video, setVideo] = useState<GeneratedVideo | null>(null);
  const [copied, setCopied] = useState(false);
  // The draft restored after sign-in or a payment, sent once the session is known.
  const [resume, setResume] = useState<{ draft: PhotoDraft; paid: boolean } | null>(null);
  const resumed = useRef(false);
  // One send at a time, so a video is never made twice.
  const sending = useRef(false);
  // Stops the retries after a payment when the page goes.
  const mounted = useRef(true);

  const money = useMoney();
  const size = Math.round(props.maxPickBytes / 1024 / 1024);
  const { min, max: maxSide, ratio } = limitValues(props.imageLimits);
  const messageValues = { size, min, maxSide, ratio };
  const { photos, previews, pick } = usePhotoPicks({
    maxPickBytes: props.maxPickBytes,
    maxUploadBytes: props.maxUploadBytes,
    imageLimits: props.imageLimits,
    onError: (key) => {
      setOffer(null);
      setError(key && t(`errors.${key}`, messageValues));
    },
  });
  const photo = photos.left;
  const ready = props.enabled && photo !== null && consent;
  // A Standard video's price, in the 402 message.
  const credits = props.credits;
  const prices: VideoPrices = { standard: props.credits, pro: props.proCredits };
  const pack =
    props.packs.find((each) => each.id === packId) ??
    props.packs.find((each) => each.id === props.featured) ??
    props.packs.at(-1);
  const smallest = props.packs[0];

  usePendingPoll({
    ids: video?.status === "pending" ? [video.id] : [],
    intervalMs: POLL_MS,
    url: (id) => `/api/videos/${id}`,
    onBody: (_, body) => {
      const { video: polled } = body as ApiBody<VideoResponse>;
      if (polled && polled.status !== "pending") setVideo(parse(polled));
    },
  });

  // "Use this scene" in the Scenes section.
  useEffect(() => {
    const onScene = (event: Event) => setScene(sceneOf((event as CustomEvent<string>).detail));
    window.addEventListener(SCENE_EVENT, onScene);
    return () => window.removeEventListener(SCENE_EVENT, onScene);
  }, []);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  // Returns "short" on a 402, for the caller to offer packs or wait for
  // paid credits.
  async function send(draft: PhotoDraft): Promise<"short" | undefined> {
    if (sending.current) return;
    sending.current = true;
    setSubmitting(true);
    setError(null);
    setOffer(null);
    const form = new FormData();
    form.set("image1", draft.photos[0]);
    form.set("quality", "standard");
    form.set("scene", sceneOf(draft.fields[SCENE]));
    form.set("ratio", ratioOf(draft.fields[RATIO]));
    // The server refuses a photo without it, and records when it was given.
    form.set("consent", draft.fields[CONSENT] ?? "");
    const response = await fetch(ENDPOINT, { method: "POST", body: form }).catch(() => null);
    const body: ApiBody<VideoResponse> = response ? await response.json().catch(() => ({})) : {};
    sending.current = false;
    setSubmitting(false);

    if (response?.ok && body.video) {
      await clearPhotoDraft(DRAFT_KEY);
      setCopied(false);
      setVideo(parse(body.video));
      return;
    }
    if (response?.status === 401) {
      await askToSignIn(draft);
      return;
    }
    if (body.error === "INSUFFICIENT_CREDITS") return "short";
    setError(t(ERRORS[body.error as keyof typeof ERRORS] ?? "errors.failed", messageValues));
  }

  function offerPacks(reason: "short" | "canceled") {
    setPackId(null);
    setBuyError(null);
    setOffer(reason);
  }

  // The packs, after a send the visitor started answered 402. The retries
  // after a payment wait instead, and record nothing.
  function paywall() {
    track("paywall_viewed", { quality: "standard", credits_needed: credits });
    offerPacks("short");
  }

  // A 402 makes no video, so sending until one gets through makes one.
  async function sendPaid(draft: PhotoDraft) {
    let outcome = await send(draft);
    for (let tries = 1; outcome === "short" && tries < TRIES && mounted.current; tries++) {
      await new Promise((resolve) => setTimeout(resolve, RETRY_MS));
      if (mounted.current) outcome = await send(draft);
    }
    setPaid(outcome === "short" ? "late" : null);
  }

  // A payment that comes back without a session keeps its place, so
  // sign-in returns to the wait for credits.
  async function askToSignIn(draft: PhotoDraft, afterPayment = false) {
    await savePhotoDraft(DRAFT_KEY, draft);
    setPaid(null);
    const url = new URL(window.location.href);
    url.searchParams.set(RESUME, "1");
    if (afterPayment) url.searchParams.set(CHECKOUT, "success");
    setSignIn(url.pathname + url.search);
  }

  // Checkout leaves the page, so the draft is saved first; checkout returns
  // to ?try=1 and the page sends it.
  async function buy() {
    if (!ready || !photo || !pack) return;
    const draft = { photos: [photo], fields: { [CONSENT]: "yes", [SCENE]: scene, [RATIO]: VERTICAL } };
    track("checkout_clicked", { pack_id: pack.id, quality: "standard" });
    setBuying(true);
    setBuyError(null);
    await savePhotoDraft(DRAFT_KEY, draft);
    const code = await redirectFrom("/api/payment/checkout", { packId: pack.id, locale, returnTo: "home" });
    if (code === null) return;
    setBuying(false);
    if (code === "UNAUTHORIZED") return askToSignIn(draft);
    setBuyError(tb(code === "PAYMENTS_DISABLED" ? "disabled" : "checkoutError"));
  }

  useEffect(() => {
    const url = new URL(window.location.href);
    if (!url.searchParams.has(RESUME)) return;
    const checkout = url.searchParams.get(CHECKOUT);
    url.searchParams.delete(RESUME);
    url.searchParams.delete(CHECKOUT);
    window.history.replaceState(null, "", url);
    void loadPhotoDraft(DRAFT_KEY).then((draft) => {
      if (draft?.photos.length !== 1) return;
      pick("left", draft.photos[0]);
      const agreed = draft.fields[CONSENT] === "yes";
      setConsent(agreed);
      setScene(sceneOf(draft.fields[SCENE]));
      // A canceled payment offers the packs again and sends nothing.
      if (checkout === "cancel") return offerPacks("canceled");
      // A draft from before the consent note waits for the button, which confirms it.
      if (!agreed) return;
      if (checkout === "success" && props.enabled) setPaid("waiting");
      setResume({ draft, paid: checkout === "success" });
    });
    // Once, on the page sign-in or checkout returned to.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!resume || !props.enabled || resumed.current || session.isPending) return;
    resumed.current = true;
    if (!session.data) void askToSignIn(resume.draft, resume.paid);
    // Sending starts here, as the plain send below does.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    else if (resume.paid) void sendPaid(resume.draft);
    else void send(resume.draft).then((outcome) => outcome && paywall());
    // send reads only props, refs and stable setters.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resume, props.enabled, session.isPending, session.data]);

  function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!ready || !photo) return;
    const draft = { photos: [photo], fields: { [CONSENT]: "yes", [SCENE]: scene, [RATIO]: VERTICAL } };
    track("generate_clicked", { quality: "standard", ratio: VERTICAL });
    setPaid(null);
    // A session still loading goes out too; a 401 asks to sign in.
    if (!session.data && !session.isPending) void askToSignIn(draft);
    else void send(draft).then((outcome) => outcome && paywall());
  }

  async function share() {
    const url = `${window.location.origin}${localePath(locale as Locale)}`;
    if (navigator.share) {
      // Closing the share sheet rejects; there is nothing to report.
      await navigator.share({ title: tt("share.title"), text: tt("share.text"), url }).then(
        () => track("video_shared", { method: "native" }),
        () => {},
      );
      return;
    }
    await navigator.clipboard?.writeText(url).then(
      () => {
        setCopied(true);
        track("video_shared", { method: "copy" });
      },
      () => {},
    );
  }

  return (
    <section
      id="generator"
      aria-label={tt("label")}
      className="flex min-w-0 scroll-mt-24 flex-col gap-4 rounded-xl border bg-card p-4 sm:p-[22px]"
    >
      {video && <Result video={video} copied={copied} onShare={share} onReset={() => setVideo(null)} />}

      {/* Hidden, not unmounted, while a video shows: the picked file stays in its input. */}
      <form onSubmit={submit} hidden={video !== null} className="flex flex-col gap-4">
        {!props.enabled && <p className="text-sm text-muted-foreground">{t("disabled")}</p>}
        <fieldset disabled={!props.enabled} className="flex min-w-0 flex-col gap-4">
          <Step number="01" id="tryout-photo-label">
            {tt("photo.step")}
          </Step>
          {/* Hidden behind the zone below, which is its label: the zone
              takes clicks and drops, and shows focus for the keyboard. */}
          <input
            id="tryout-photo"
            type="file"
            accept={PHOTO_TYPES.join(",")}
            onChange={(event) => {
              const file = event.target.files?.[0] ?? null;
              if (file) track("photo_selected");
              pick("left", file);
            }}
            aria-labelledby="tryout-photo-label"
            aria-describedby="tryout-hint"
            className="peer sr-only"
          />
          <label
            htmlFor="tryout-photo"
            onDragOver={(event) => event.preventDefault()}
            onDrop={(event) => {
              event.preventDefault();
              const file = event.dataTransfer.files[0];
              if (!props.enabled || !file) return;
              if (!PHOTO_TYPES.includes(file.type)) {
                setOffer(null);
                setError(t("errors.invalid", messageValues));
                return;
              }
              track("photo_selected");
              pick("left", file);
            }}
            className="-mt-1.5 flex min-w-0 cursor-pointer items-center gap-4 rounded-lg border border-border-strong bg-background px-4 py-4 transition-colors peer-focus-visible:border-ring peer-focus-visible:ring-3 peer-focus-visible:ring-ring/50 peer-disabled:cursor-not-allowed peer-disabled:opacity-50 sm:px-5 sm:py-[18px] [@media(hover:hover)]:hover:border-primary/60"
          >
            {previews.left ? (
              // A local object URL, which next/image can't optimize.
              // eslint-disable-next-line @next/next/no-img-element
              <img src={previews.left} alt={t("left.preview")} className="size-12 shrink-0 rounded-sm object-cover" />
            ) : (
              <span aria-hidden className="flex size-12 shrink-0 items-center justify-center rounded-sm bg-primary-soft">
                <ImagePlus className="size-[22px] text-primary-text" />
              </span>
            )}
            <span className="flex min-w-0 flex-col gap-0.5">
              <span className="truncate text-sm font-semibold">{photo ? photo.name : tt("photo.choose")}</span>
              <span id="tryout-hint" className="text-xs text-faint">
                {photo
                  ? tt("photo.size", { size: (photo.size / 1024 / 1024).toFixed(1) })
                  : tt("photo.hint", { size })}
              </span>
            </span>
          </label>
          <ul className="flex flex-wrap gap-x-4 gap-y-1.5 text-xs text-muted-foreground">
            <li className="flex items-center gap-1.5">
              <ShieldCheck aria-hidden className="size-3.5 text-ok" />
              {tt("privacy.deleted")}
            </li>
            <li className="flex items-center gap-1.5">
              <Ban aria-hidden className="size-3.5 text-ok" />
              {tt("privacy.training")}
            </li>
          </ul>
          <Step number="02" id="tryout-scene">
            {tt("scene")}
          </Step>
          <ScenePicker value={scene} onChange={setScene} />
          <label className="flex items-start gap-2.5 text-[13px] leading-[1.4] text-pretty text-muted-foreground">
            <input
              type="checkbox"
              checked={consent}
              onChange={(event) => setConsent(event.target.checked)}
              required
              className="mt-px size-[18px] shrink-0 cursor-pointer rounded-[4px] accent-primary"
            />
            {t("consent", { photos: 1 })}
          </label>
          <Button
            type="submit"
            size="lg"
            variant={offer ? "outline" : "default"}
            className="mt-1 h-[52px] w-full"
            disabled={!ready || submitting || paid === "waiting"}
          >
            {submitting ? t("generating") : tt("submit")}
            {!submitting && <ArrowRight className="icon-nudge" />}
          </Button>
          <p className="text-xs text-pretty text-faint">
            {tt("finePrint", { price: smallest ? money(smallest.amount, smallest.currency) : "" })}
          </p>
        </fieldset>
        {paid && (
          <p role="status" className="flex items-start gap-2 rounded-lg border bg-background px-4 py-3 text-sm text-pretty">
            {paid === "waiting" && (
              <LoaderCircle className="mt-0.5 shrink-0 animate-spin text-primary-text motion-reduce:animate-none" />
            )}
            {tt(`paid.${paid}`)}
          </p>
        )}
        {error && (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}
        {offer && pack && (
          <PackOffer
            packs={props.packs}
            prices={prices}
            featured={props.featured}
            picked={pack.id}
            onPick={setPackId}
            onPay={buy}
            buying={buying}
            disabled={!ready || buying}
            error={buyError}
          >
            {offer === "short" ? (
              <p role="alert" className="text-sm text-destructive">
                {tt("credits", { credits })}
              </p>
            ) : (
              <p role="status" className="text-sm font-medium">
                {tt("packs.canceled")}
              </p>
            )}
          </PackOffer>
        )}
      </form>

      <Dialog open={signIn !== null} onOpenChange={(open) => !open && setSignIn(null)}>
        <DialogContent closeLabel={tt("close")}>
          <DialogHeader>
            <DialogTitle>{tt("signIn.title")}</DialogTitle>
            <DialogDescription>{tt("signIn.body")}</DialogDescription>
          </DialogHeader>
          {signIn && (
            <LoginForm returnTo={signIn} turnstileSiteKey={process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY} />
          )}
        </DialogContent>
      </Dialog>
    </section>
  );
}

// A step's mono number in lamp and its label.
function Step({ number, id, children }: { number: string; id: string; children: React.ReactNode }) {
  return (
    <p className="flex items-center gap-2.5">
      <span aria-hidden className="font-mono text-xs text-primary-text">
        {number}
      </span>
      <span id={id} className="text-sm font-semibold">
        {children}
      </span>
    </p>
  );
}

// The six scenes as image radios: a still and a short name; the picked one
// has a lamp outline. On phones the row scrolls sideways.
function ScenePicker({ value, onChange }: { value: Scene; onChange: (scene: Scene) => void }) {
  const ts = useTranslations("PhotoEffects.scenes");
  return (
    <div
      role="radiogroup"
      aria-labelledby="tryout-scene"
      className="-mx-4 -mt-1.5 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:grid sm:grid-cols-6 sm:overflow-visible sm:px-0 sm:pb-0"
    >
      {SCENES.map((each) => (
        <label key={each} className="group flex w-[4.5rem] shrink-0 cursor-pointer flex-col gap-1.5 sm:w-auto">
          <input
            type="radio"
            name="tryout-scene"
            value={each}
            checked={value === each}
            onChange={() => onChange(each)}
            className="peer sr-only"
          />
          <span className="relative block h-16 overflow-hidden rounded-sm border peer-checked:border-2 peer-checked:border-primary peer-focus-visible:ring-3 peer-focus-visible:ring-ring/50">
            <Image src={sceneImage(each)} alt="" fill sizes="96px" className="object-cover" />
          </span>
          <span className="truncate text-xs text-muted-foreground peer-checked:font-semibold peer-checked:text-foreground">
            {ts(`${each}.short`)}
          </span>
        </label>
      ))}
    </div>
  );
}

// The packs on offer when credits run short, as the buy-credits dialog shows
// them, with one pay button. Checkout is the provider's page.
function PackOffer({
  packs,
  prices,
  featured,
  picked,
  onPick,
  onPay,
  buying,
  disabled,
  error,
  children,
}: {
  packs: readonly Pack[];
  prices: VideoPrices;
  featured: string;
  picked: string;
  onPick: (id: string) => void;
  onPay: () => void;
  buying: boolean;
  disabled: boolean;
  error: string | null;
  // Why the packs show: the 402 message or the canceled checkout.
  children: React.ReactNode;
}) {
  const tt = useTranslations("HomeTryout");
  const tb = useTranslations("Billing");
  const money = useMoney();
  const chosen = packs.find((pack) => pack.id === picked) ?? packs[0];

  return (
    <div className="flex flex-col gap-4 rounded-xl border border-border-strong bg-background p-4">
      <div className="flex flex-col gap-1">
        {children}
        <p id="tryout-packs" className="text-sm text-pretty text-muted-foreground">
          {tt("packs.body")}
        </p>
      </div>
      <PackOptions
        packs={packs}
        prices={prices}
        featured={featured}
        picked={chosen.id}
        onPick={onPick}
        name="tryout-pack"
        labelledBy="tryout-packs"
      />
      <Button type="button" size="lg" className="h-[52px] w-full" disabled={disabled} onClick={onPay}>
        {buying ? tb("paying") : tt("packs.pay", { price: money(chosen.amount, chosen.currency) })}
        {!buying && <LockKeyhole />}
      </Button>
      <PackBenefits size="sm" />
      <p className="text-xs text-pretty text-faint">{tb("secure")}</p>
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}

// The sent video: progress while it renders, then the player with download
// and share, or the refund once it failed.
function Result({
  video,
  copied,
  onShare,
  onReset,
}: {
  video: GeneratedVideo;
  copied: boolean;
  onShare: () => void;
  onReset: () => void;
}) {
  const tt = useTranslations("HomeTryout");

  if (video.status === "failed") {
    return (
      <div className="flex flex-col items-start gap-4">
        <p role="alert" className="text-sm text-destructive">
          {tt("failed", { credits: video.credits })}
        </p>
        <Button type="button" variant="outline" onClick={onReset}>
          {tt("tryAgain")}
        </Button>
      </div>
    );
  }

  if (!video.url) {
    return (
      <div role="status" className="flex flex-col items-center gap-3 rounded-lg border bg-background px-5 py-10 text-center">
        <LoaderCircle aria-hidden className="size-6 animate-spin text-primary-text motion-reduce:animate-none" />
        <p className="font-display font-semibold">{tt("pending.title")}</p>
        <p className="max-w-[40ch] text-sm text-pretty text-muted-foreground">{tt("pending.body")}</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <p className="font-display font-semibold">{tt("ready")}</p>
      <video
        src={video.url}
        poster={video.posterUrl ?? video.imageUrl ?? undefined}
        aria-label={tt("video")}
        controls
        playsInline
        preload="metadata"
        className={cn("rounded-lg border bg-muted", playerFrame(video.ratio))}
      />
      <div className="flex flex-wrap items-center gap-3">
        {/* The route answers with a file, so the browser stays on this page. */}
        <a
          href={`/api/videos/${video.id}/download`}
          download
          onClick={() => track("video_downloaded")}
          className={buttonVariants()}
        >
          <Download />
          {tt("download")}
        </a>
        <Button type="button" variant="outline" onClick={onShare}>
          <Share2 />
          {tt("share.button")}
        </Button>
        <Button type="button" variant="ghost" onClick={onReset}>
          {tt("another")}
        </Button>
        {copied && (
          <span role="status" className="text-sm text-primary-text">
            {tt("share.copied")}
          </span>
        )}
      </div>
    </div>
  );
}
