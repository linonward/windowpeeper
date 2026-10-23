import { cn } from "cn";

// A section's mono eyebrow and Big Shoulders title, with an optional aside
// that sits at the bottom right on large screens (docs/DESIGN.md, Typography).
// Inside a settling section, its text settles in (globals.css, Home motion).
export function SectionHeading({
  eyebrow,
  id,
  aside,
  className,
  children,
}: {
  eyebrow: string;
  id: string;
  aside?: React.ReactNode;
  // Extra classes for the title.
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between lg:gap-12">
      <div className="flex min-w-0 flex-col gap-3">
        <p className="eyebrow settle-text">{eyebrow}</p>
        <h2
          id={id}
          className={cn(
            "settle-text scroll-mt-24 font-display text-[clamp(2.5rem,10vw,3.5rem)] leading-none font-extrabold text-balance",
            className,
          )}
        >
          {children}
        </h2>
      </div>
      {aside && <p className="settle-text max-w-[22rem] shrink-0 text-[15px] leading-normal text-pretty text-muted-foreground">{aside}</p>}
    </div>
  );
}

// Soft radial lamp glow behind a heading. The parent needs `relative isolate`.
export function Glow({ className }: { className?: string }) {
  return (
    <div
      aria-hidden
      className={cn(
        "pointer-events-none absolute left-1/2 -z-10 h-72 w-[min(44rem,100%)] -translate-x-1/2 rounded-full bg-[radial-gradient(closest-side,var(--primary),transparent)] opacity-15 blur-2xl",
        className,
      )}
    />
  );
}
