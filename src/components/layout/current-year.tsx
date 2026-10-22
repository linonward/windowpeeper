"use client";

import { useSyncExternalStore } from "react";

const subscribe = () => () => {};

// The year, for the footer's copyright. Read in the browser only, so the
// prerendered pages don't fix it at build time; the server renders nothing.
export function CurrentYear() {
  return useSyncExternalStore(subscribe, () => new Date().getFullYear(), () => null);
}
