"use client";

import { Menu } from "lucide-react";
import { useState } from "react";
import { buttonVariants } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/utils";
import { LocaleLinks } from "./locale-switcher";

// The header's links and languages on phones, in a sheet from the right. The header, a
// server component, passes the copy in.
export function MobileMenu({
  links,
  cta,
  label,
  menu,
}: {
  links: { href: string; label: string }[];
  cta: string;
  // The nav's name and the button's.
  label: string;
  menu: string;
}) {
  const [open, setOpen] = useState(false);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger
        aria-label={menu}
        className="-mr-2 flex size-9 items-center justify-center rounded-lg outline-hidden focus-visible:ring-2 focus-visible:ring-ring md:hidden"
      >
        <Menu className="size-[22px]" />
      </SheetTrigger>
      <SheetContent side="right" className="w-72 gap-0 p-5 pt-14">
        <SheetTitle className="sr-only">{label}</SheetTitle>
        <nav aria-label={label} className="flex flex-col">
          {links.map(({ href, label }) => (
            <Link key={href} href={href} onClick={() => setOpen(false)} className="border-b py-3.5 text-base font-medium">
              {label}
            </Link>
          ))}
        </nav>
        <Link
          href="/#generator"
          onClick={() => setOpen(false)}
          className={cn(buttonVariants({ size: "lg" }), "mt-6 w-full")}
        >
          {cta}
        </Link>
        <LocaleLinks className="mt-6 text-sm text-muted-foreground" />
      </SheetContent>
    </Sheet>
  );
}
