import { projectConfig } from "project.config";
import { Link } from "@/i18n/navigation";
import { LogoMark } from "./logo-mark";

export function Brand({ href = "/", className = "" }: { href?: string; className?: string }) {
  return (
    // min-w-0 and truncate keep a long name inside a narrow header.
    <Link href={href} className={`inline-flex min-w-0 items-center gap-2 font-display font-semibold ${className}`}>
      <LogoMark />
      <span className="truncate">{projectConfig.name}</span>
    </Link>
  );
}
