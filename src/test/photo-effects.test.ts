// @vitest-environment node
import { readFileSync } from "node:fs";
import { expect, test } from "vitest";
import { routing } from "@/i18n/routing";
import { PHOTO_EFFECT_KINDS, SCENES } from "@/lib/photo-effects";
import { PHOTO_EFFECTS } from "@/server/videos/photo-effects";
import { SCENES as SERVER_SCENES } from "@/server/videos/window-peeper";

// A photo effect lives in two lists: the server's definitions and the UI's
// kinds, which may not import the server. A new effect needs both, and its
// copy in every locale.

const messages = (locale: string) =>
  JSON.parse(readFileSync(new URL(`../../messages/${locale}.json`, import.meta.url), "utf8"));

test("the UI lists the server's photo effects, with the same photos, in the same order", () => {
  expect(Object.entries(PHOTO_EFFECT_KINDS)).toEqual(PHOTO_EFFECTS.map(({ kind, photos }) => [kind, { photos }]));
});

test.each(PHOTO_EFFECTS.map((effect) => [effect.kind, effect] as const))(
  "%s takes over /videos/<kind> and /api/videos/<kind> without hiding a page or a video",
  (kind) => {
    // Static folders under /videos and /api/videos win over the effect.
    expect(["library"]).not.toContain(kind);
    expect(kind).toMatch(/^[a-z][a-z0-9-]*$/);
    expect(kind).not.toMatch(/^[0-9a-f]{8}-/);
  },
);

test.each(routing.locales.flatMap((locale) => PHOTO_EFFECTS.map((effect) => [locale, effect.kind] as const)))(
  "%s has copy for %s's page and its photo",
  (locale, kind) => {
    const copy = messages(locale).PhotoEffects.kinds[kind];
    expect(Object.keys(copy).sort()).toEqual(["description", "disabled", "left", "photoHint", "title"]);
    expect(Object.keys(copy.left).sort()).toEqual(["photo", "preview"]);
  },
);

test("the UI lists the window peeper video's scenes, in the server's order", () => {
  expect(SCENES).toEqual(SERVER_SCENES.map(({ id }) => id));
});

test.each(routing.locales.flatMap((locale) => SCENES.map((scene) => [locale, scene] as const)))(
  "%s names the %s scene",
  (locale, scene) => {
    const copy = messages(locale).PhotoEffects.scenes[scene];
    expect(Object.keys(copy).sort()).toEqual(["name", "note", "short", "time"]);
  },
);
