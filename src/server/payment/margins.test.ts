import { expect, test } from "vitest";
import { REFERENCE_COST_PER_SECOND } from "@/server/videos/config";
import { PHOTO_EFFECTS, type PhotoEffect } from "@/server/videos/photo-effects";
import { CREDIT_PACKS } from "./packs";

// Every offer must sell a second of video for at least this many times
// what the provider charges for it.
const MIN_MARGIN = 1.5;
// Room for floating-point error, so exactly 1.5 times passes.
const EPSILON = 1e-9;

// Dollars per credit for each offer. Only packs are on sale: offeredPlans()
// offers no subscription plan.
const offers = CREDIT_PACKS.map((pack) => ({ id: pack.id, perCredit: pack.amount / 100 / pack.credits }));

// Each photo effect's qualities: standard at the effect's price, Pro at its own.
const qualities = (PHOTO_EFFECTS as readonly PhotoEffect[]).flatMap(({ kind, duration, credits, resolution, pro }) => [
  { kind, duration, resolution, credits },
  ...(pro ? [{ kind, duration, ...pro }] : []),
]);

test("the tip-toe dance sells in both qualities", () => {
  expect(qualities.map(({ kind, resolution }) => `${kind} ${resolution}`)).toEqual(["tiptoe 720P", "tiptoe 1080P"]);
});

test.each(offers)("$id sells every photo effect quality for at least 1.5 times its cost", ({ perCredit }) => {
  for (const { kind, duration, resolution, credits } of qualities) {
    const cost = duration * REFERENCE_COST_PER_SECOND[resolution];
    expect(cost, `${kind} ${resolution} has no cost`).toBeGreaterThan(0);
    expect(credits * perCredit, `${kind} ${resolution}`).toBeGreaterThanOrEqual(cost * MIN_MARGIN - EPSILON);
  }
});
