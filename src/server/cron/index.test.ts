import { beforeEach, expect, test, vi } from "vitest";
import { checkFailureRate } from "@/server/alerts";
import { log } from "@/server/log";
import { grantYearlyMonths } from "@/server/payment/subscriptions";
import { expireUploads, sweepStaleVideos } from "@/server/videos";
import { isCronRequest, sweepPending } from "./index";

vi.mock("@/server/videos", () => ({ sweepStaleVideos: vi.fn(), expireUploads: vi.fn() }));
vi.mock("@/server/payment/subscriptions", () => ({ grantYearlyMonths: vi.fn() }));
vi.mock("@/server/log", () => ({ log: { error: vi.fn() } }));
vi.mock("@/server/alerts", () => ({ checkFailureRate: vi.fn() }));

const tasks = {
  videos: vi.mocked(sweepStaleVideos),
  subscriptionMonths: vi.mocked(grantYearlyMonths),
  uploads: vi.mocked(expireUploads),
};

beforeEach(() => {
  vi.resetAllMocks();
  tasks.videos.mockResolvedValue({ failed: 3, checked: 4 });
  tasks.subscriptionMonths.mockResolvedValue(5);
  tasks.uploads.mockResolvedValue(6);
  vi.mocked(checkFailureRate).mockResolvedValue({ finished: 10, failed: 1, alerted: false });
});

const secret = "s".repeat(32);
const headers = (authorization?: string) =>
  new Headers(authorization ? { authorization } : {});

test("accepts the bearer CRON_SECRET", () => {
  expect(isCronRequest(headers(`Bearer ${secret}`), secret)).toBe(true);
});

test("rejects a wrong, missing or partial secret", () => {
  expect(isCronRequest(headers(`Bearer ${"x".repeat(32)}`), secret)).toBe(false);
  expect(isCronRequest(headers(`Bearer ${secret.slice(1)}`), secret)).toBe(false);
  expect(isCronRequest(headers(secret), secret)).toBe(false);
  expect(isCronRequest(headers(), secret)).toBe(false);
});

test("rejects everything while CRON_SECRET is unset", () => {
  expect(isCronRequest(headers("Bearer "), undefined)).toBe(false);
  expect(isCronRequest(headers("Bearer "), "")).toBe(false);
});

test.each(["videos", "subscriptionMonths", "uploads"] as const)(
  "runs every task and reports the failure when %s fails",
  async (task) => {
    const error = new Error(`${task} unavailable`);
    tasks[task].mockRejectedValueOnce(error);

    const failure = await sweepPending().catch((error: unknown) => error);

    for (const run of Object.values(tasks)) expect(run).toHaveBeenCalledTimes(1);
    // The alert check runs whatever failed.
    expect(checkFailureRate).toHaveBeenCalledTimes(1);
    expect(failure).toMatchObject({ errors: [error] });
    expect(log.error).toHaveBeenCalledExactlyOnceWith("cron.task_failed", { task, error });
  },
);

test("returns each task's counts when all succeed", async () => {
  await expect(sweepPending()).resolves.toEqual({
    videos: { failed: 3, checked: 4 },
    subscriptionMonths: 5,
    uploads: 6,
    failureRate: { finished: 10, failed: 1, alerted: false },
  });
  expect(log.error).not.toHaveBeenCalled();
});

test("waits for unfinished tasks and reports every failure", async () => {
  const videoError = new Error("videos unavailable");
  const uploadError = new Error("storage unavailable");
  const months = Promise.withResolvers<number>();
  tasks.videos.mockRejectedValueOnce(videoError);
  tasks.uploads.mockRejectedValueOnce(uploadError);
  tasks.subscriptionMonths.mockReturnValueOnce(months.promise);
  const settled = vi.fn();
  const result = sweepPending().catch((error: unknown) => {
    settled();
    return error;
  });

  await vi.waitFor(() => expect(tasks.subscriptionMonths).toHaveBeenCalledTimes(1));
  expect(settled).not.toHaveBeenCalled();
  months.resolve(5);

  expect(await result).toMatchObject({ errors: [videoError, uploadError] });
  expect(log.error).toHaveBeenCalledTimes(2);
  expect(log.error).toHaveBeenCalledWith("cron.task_failed", { task: "videos", error: videoError });
  expect(log.error).toHaveBeenCalledWith("cron.task_failed", { task: "uploads", error: uploadError });
});
