import { expect, test } from "vitest";
import { localePath } from "./routing";

test("English paths have no prefix; the other locales do", () => {
  expect(localePath("en")).toBe("/");
  expect(localePath("en", "/pricing")).toBe("/pricing");
  expect(localePath("es")).toBe("/es");
  expect(localePath("de", "/blog/a")).toBe("/de/blog/a");
});
