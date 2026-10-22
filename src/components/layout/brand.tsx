import { projectConfig } from "project.config";
import { Link } from "@/i18n/navigation";
import { LogoMark } from "./logo-mark";

// "WindowPeeper" → "Window" and "Peeper": the last capitalized word is lit.
const [, FIRST, SECOND] = /^(.+?)([A-Z][^A-Z]*)$/.exec(projectConfig.name) ?? [, projectConfig.name, ""];

// The lockup: the lit window, then the wordmark in uppercase Big Shoulders
// (docs/DESIGN.md, Logo).
export function Brand({ href = "/", className = "" }: { href?: string; className?: string }) {
  return (
    // min-w-0 and truncate keep a long name inside a narrow header.
    <Link
      href={href}
      className={`inline-flex min-w-0 items-center gap-2.5 font-display text-2xl leading-none font-black tracking-[0.02em] uppercase ${className}`}
    >
      <LogoMark />
      <span className="truncate">
        <span>{FIRST}</span>
        <span className="text-primary">{SECOND}</span>
      </span>
    </Link>
  );
}
