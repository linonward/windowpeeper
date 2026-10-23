"use client";

import { useEffect, useRef, useState } from "react";

// A box that plays its motion once, the first time it comes into view
// (docs/DESIGN.md, Motion). It names the motion in `data-motion` and sets
// `data-shown` when `threshold` of it is in view; globals.css does the rest.
// Browsers without IntersectionObserver also lack `@media (scripting)`, so
// globals.css never holds them back.
export function InView({
  motion,
  threshold,
  ...props
}: { motion: "windows" | "playhead" | "settle"; threshold: number } & React.ComponentProps<"div">) {
  const ref = useRef<HTMLDivElement>(null);
  const [shown, setShown] = useState(false);

  useEffect(() => {
    if (typeof IntersectionObserver === "undefined") return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return;
        setShown(true);
        observer.disconnect();
      },
      { threshold },
    );
    if (ref.current) observer.observe(ref.current);
    return () => observer.disconnect();
  }, [threshold]);

  return <div ref={ref} data-motion={motion} data-shown={shown ? "" : undefined} {...props} />;
}
