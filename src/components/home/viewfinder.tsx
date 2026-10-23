import Image from "next/image";
import { cn } from "cn";
import { RecBadge } from "./rec-badge";

// A video frame seen through a camera: the still, or a clip that plays
// muted in a loop over its poster, a shade at the bottom, four corner marks,
// the REC stamp at the top and a mono caption at the bottom (docs/DESIGN.md,
// Viewfinder). With reduced motion the clip hides and the poster stays. The
// parent sets the size; its `focus-in` class focuses the camera on load.
export function Viewfinder({
  src,
  video,
  alt,
  rec,
  caption,
  sizes,
  priority = false,
  className,
}: {
  // The still, or the clip's poster.
  src: string;
  video?: string;
  alt: string;
  rec?: React.ReactNode;
  caption?: string;
  sizes: string;
  priority?: boolean;
  className?: string;
}) {
  return (
    <figure className={cn("relative isolate overflow-hidden rounded-xl border bg-muted", className)}>
      <Image src={src} alt={video ? "" : alt} fill sizes={sizes} priority={priority} className="-z-10 object-cover" />
      {video && (
        <video
          src={video}
          poster={src}
          aria-label={alt}
          autoPlay
          muted
          loop
          playsInline
          className="absolute inset-0 -z-10 size-full object-cover motion-reduce:hidden"
        />
      )}
      <div aria-hidden className="absolute inset-x-0 bottom-0 -z-10 h-[38%] bg-linear-to-b from-transparent to-background/90" />
      <Corners className="inset-3" />
      {rec && <RecBadge className="absolute top-5 left-5">{rec}</RecBadge>}
      {caption && (
        <figcaption className="absolute bottom-5 left-5 font-mono text-[11px] tracking-[0.11em] text-muted-foreground uppercase">
          {caption}
        </figcaption>
      )}
    </figure>
  );
}

// Four 18px corner marks, inset by the parent's `inset-*` class. --x and --y
// point each one outward, for the motion that closes them in.
export function Corners({ className }: { className?: string }) {
  const corner = "corner absolute size-[18px] border-foreground/80";
  return (
    <div aria-hidden className={cn("pointer-events-none absolute", className)}>
      <span className={cn(corner, "top-0 left-0 border-t-2 border-l-2 [--x:-1] [--y:-1]")} />
      <span className={cn(corner, "top-0 right-0 border-t-2 border-r-2 [--x:1] [--y:-1]")} />
      <span className={cn(corner, "bottom-0 left-0 border-b-2 border-l-2 [--x:-1] [--y:1]")} />
      <span className={cn(corner, "right-0 bottom-0 border-r-2 border-b-2 [--x:1] [--y:1]")} />
    </div>
  );
}
