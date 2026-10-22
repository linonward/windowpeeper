import { cn } from "cn";

// The REC stamp: a red dot and a mono timecode on a dark glass tile
// (docs/DESIGN.md, REC badge). Timecodes frame every video; red marks the
// recording state only, and the dot blinks.
export function RecBadge({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex w-fit items-center gap-2 rounded-[4px] bg-background/70 px-2.5 py-1.5 font-mono text-[11px] leading-none font-medium tracking-[0.11em] whitespace-nowrap text-foreground uppercase",
        className,
      )}
    >
      <span aria-hidden className="rec-blink size-2 shrink-0 rounded-full bg-rec" />
      {children}
    </span>
  );
}
