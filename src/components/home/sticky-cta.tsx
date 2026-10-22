"use client";

import { ArrowRight } from "lucide-react";
import { useEffect, useState } from "react";
import { buttonVariants } from "@/components/ui/button";

// On phones, once the generator has scrolled out of view above, a bar at the
// bottom of the screen leads back up to it. The page passes the copy in.
export function StickyCta({ title, body, button }: { title: string; body: string; button: string }) {
  const [shown, setShown] = useState(false);

  useEffect(() => {
    const generator = document.getElementById("generator");
    // Without IntersectionObserver the bar never shows.
    if (!generator || typeof IntersectionObserver === "undefined") return;
    const observer = new IntersectionObserver(([entry]) =>
      setShown(!entry.isIntersecting && entry.boundingClientRect.top < 0),
    );
    observer.observe(generator);
    return () => observer.disconnect();
  }, []);

  return (
    <div
      hidden={!shown}
      className="fixed inset-x-0 bottom-0 z-30 flex items-center justify-between gap-3 border-t border-border-strong bg-card/95 px-4 pt-3 pb-6 backdrop-blur-md md:hidden"
    >
      <div className="flex min-w-0 flex-col gap-0.5">
        <span className="truncate text-sm font-semibold">{title}</span>
        <span className="truncate text-xs text-muted-foreground">{body}</span>
      </div>
      {/* A plain anchor, as Link would add the locale. */}
      <a href="#generator" className={buttonVariants({ size: "lg", className: "h-11 shrink-0 px-[18px]" })}>
        {button}
        <ArrowRight />
      </a>
    </div>
  );
}
