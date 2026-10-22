import { cn } from "cn";

// The lit window: a lamp tile with four panes, the lower left one dark
// (docs/DESIGN.md, Logo). The simple mark, for sizes under 40px; the full
// mark with the curtain and the figure is in docs/design/brand/.
export const PANES = [
  { x: 3, y: 3, lit: true },
  { x: 15, y: 3, lit: true },
  { x: 3, y: 15, lit: false },
  { x: 15, y: 15, lit: true },
] as const;

export function LogoMark({ className }: { className?: string }) {
  return (
    <svg aria-hidden viewBox="0 0 28 28" className={cn("size-7 shrink-0", className)}>
      <rect width={28} height={28} rx={3} className="fill-primary" />
      {PANES.map(({ x, y, lit }) => (
        <rect
          key={`${x}-${y}`}
          x={x}
          y={y}
          width={10}
          height={10}
          rx={1}
          className={lit ? "fill-primary-hover" : "fill-background"}
        />
      ))}
    </svg>
  );
}
