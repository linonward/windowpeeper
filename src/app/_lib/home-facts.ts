import { CREDIT_PACKS, DEFAULT_PACK_ID } from "@/server/payment/packs";
import { effectOptions } from "@/server/videos";
import { EFFECT_IMAGE_LIMITS, EFFECT_MAX_IMAGE_BYTES, EFFECT_MAX_PICK_BYTES } from "@/server/videos/config";

// The window peeper video's prices in credits, standard and Pro, for the pages
// that state them. It always sells Pro (src/server/videos/window-peeper.ts).
export function videoPrices(): { standard: number; pro: number } {
  const { credits, proCredits } = effectOptions("windowpeeper");
  return { standard: credits, pro: proCredits as number };
}

// What the home page's window peeper generator checks and its copy states, from
// the server config. The page is prerendered, so these come from the code, not
// the environment: the build doesn't see the Worker's secrets. The generator
// asks the server whether the effect is on (useEffectsEnabled).
export function homeFacts() {
  const { standard, pro } = videoPrices();
  return {
    credits: standard,
    proCredits: pro,
    // The copy states the pick limit; the upload limit is what the browser
    // shrinks the photo to.
    maxPickBytes: EFFECT_MAX_PICK_BYTES,
    maxUploadBytes: EFFECT_MAX_IMAGE_BYTES,
    imageLimits: EFFECT_IMAGE_LIMITS,
    // The FAQ states each pack's credits and price; the pricing section
    // sells them, featuring the one to start with.
    packs: CREDIT_PACKS,
    featured: DEFAULT_PACK_ID,
    prices: { standard, pro },
  };
}

