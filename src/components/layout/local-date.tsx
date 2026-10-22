"use client";

import { type DateTimeFormatOptions, useFormatter } from "next-intl";

// A date in the reader's time zone, for server components. They format in
// UTC (src/i18n/request.ts); a client component sits under LocalTimeZone,
// which switches to the browser's zone after hydration.
export function LocalDate({
  value,
  className,
  ...options
}: { value: Date; className?: string } & DateTimeFormatOptions) {
  const format = useFormatter();
  return (
    <time dateTime={value.toISOString()} className={className}>
      {format.dateTime(value, options)}
    </time>
  );
}
