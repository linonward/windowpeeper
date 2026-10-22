import { CREDIT_PACKS, DEFAULT_PACK_ID } from "@/server/payment/packs";
import { effectOptions } from "@/server/videos";
import { EFFECT_IMAGE_LIMITS, EFFECT_MAX_IMAGE_BYTES, EFFECT_MAX_PICK_BYTES } from "@/server/videos/config";

// The tip-toe dance's prices in credits, standard and Pro, for the pages
// that state them. It always sells Pro (src/server/videos/tiptoe.ts).
export function videoPrices(): { standard: number; pro: number } {
  const { credits, proCredits } = effectOptions("tiptoe");
  return { standard: credits, pro: proCredits as number };
}

// What the home page's tip-toe generator checks and its copy states, from
// the server config. The page is prerendered, so `enabled` reflects the
// environment at build time, as the copy's prices do.
export function homeFacts() {
  const { standard, pro } = videoPrices();
  return {
    enabled: effectOptions("tiptoe").enabled,
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

