"use client";

import { useEffect, useState } from "react";

// A REC timecode that counts up a second at a time from `start`, such as
// "REC 01:28:00 AM", like a camera that is recording. It holds still for
// reduced motion. The text around the hh:mm:ss stays as it is.
export function Timecode({ start }: { start: string }) {
  const [seconds, setSeconds] = useState(0);

  useEffect(() => {
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;
    const timer = setInterval(() => setSeconds((value) => value + 1), 1000);
    return () => clearInterval(timer);
  }, []);

  return start.replace(/(\d{2}):(\d{2}):(\d{2})/, (_, h, m, s) => {
    const total = Number(h) * 3600 + Number(m) * 60 + Number(s) + seconds;
    const pad = (value: number) => String(value).padStart(2, "0");
    return `${pad(Math.floor(total / 3600) % 24)}:${pad(Math.floor(total / 60) % 60)}:${pad(total % 60)}`;
  });
}
