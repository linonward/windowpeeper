import { useTranslations } from "next-intl";
import { PHOTO_EFFECT_KINDS, type PhotoEffectKind } from "@/lib/photo-effects";

type Translate = (key: string, values?: Record<string, string | number>) => string;

// A video form's messages by kind. A photo effect reads its own copy from
// PhotoEffects.kinds.<kind> (title, photo labels, hint) and the rest from
// PhotoEffects, which gets `photos` to choose "the photo" or "a photo".
export function useEffectMessages(kind: PhotoEffectKind): Translate {
  // A literal name, so the client messages test can check that the browser
  // gets it.
  const effects = useTranslations("PhotoEffects") as unknown as Translate & { has: (key: string) => boolean };
  const { photos } = PHOTO_EFFECT_KINDS[kind];
  return (key, values) =>
    effects.has(`kinds.${kind}.${key}`) ? effects(`kinds.${kind}.${key}`, values) : effects(key, { photos, ...values });
}
