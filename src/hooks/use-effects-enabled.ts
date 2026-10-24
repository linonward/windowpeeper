import { useEffect, useState } from "react";
import type { ApiBody, EffectsEnabledResponse } from "@/lib/api";

// Whether the photo effects are set up, asked from the server in the
// browser. The pages that use it are prerendered, and the build doesn't see
// the Worker's secrets, so the build can't tell. It starts on; when the server
// can't be asked, it stays on, and a send reports the real error.
export function useEffectsEnabled() {
  const [enabled, setEnabled] = useState(true);
  useEffect(() => {
    let live = true;
    fetch("/api/videos/enabled")
      .then(async (response) => (response.ok ? ((await response.json()) as ApiBody<EffectsEnabledResponse>) : null))
      .then((body) => {
        if (live && body?.enabled === false) setEnabled(false);
      })
      .catch(() => {});
    return () => {
      live = false;
    };
  }, []);
  return enabled;
}
