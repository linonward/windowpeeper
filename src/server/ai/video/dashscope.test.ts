import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { dashscopeVideoProvider, submitReferenceVideo } from "./dashscope";
import { type ReferenceVideoJob, VideoGenerationError } from "./types";

const fetchMock = vi.fn<typeof fetch>();

beforeEach(() => {
  vi.stubEnv("DASHSCOPE_API_KEY", "sk-test");
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  fetchMock.mockReset();
});

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

const task = (output: object) => json({ request_id: "req-1", output: { task_id: "task-1", ...output } });

const job: ReferenceVideoJob = {
  image: { bytes: new Uint8Array([1, 2, 3]), mime: "image/jpeg", url: "https://storage.test/me.jpg?signed" },
  prompt: "Image 1 stares out of a lit window.",
  resolution: "720P",
  ratio: "16:9",
  watermark: false,
  duration: 12,
};

test("uses the configured base URL", async () => {
  vi.stubEnv("DASHSCOPE_BASE_URL", "https://ws-1.cn-beijing.maas.aliyuncs.com/");
  fetchMock.mockResolvedValueOnce(task({ task_status: "PENDING" })).mockResolvedValueOnce(
    task({ task_status: "RUNNING" }),
  );

  await submitReferenceVideo(job);
  await dashscopeVideoProvider.result("task-1");

  expect(fetchMock.mock.calls[0][0]).toBe(
    "https://ws-1.cn-beijing.maas.aliyuncs.com/api/v1/services/aigc/video-generation/video-synthesis",
  );
  expect(fetchMock.mock.calls[1][0]).toBe("https://ws-1.cn-beijing.maas.aliyuncs.com/api/v1/tasks/task-1");
});

test.each(["PENDING", "RUNNING"])("is pending while %s", async (status) => {
  fetchMock.mockResolvedValueOnce(task({ task_status: status }));

  expect(await dashscopeVideoProvider.result("task-1")).toEqual({ status: "pending" });
  expect(fetchMock.mock.calls[0][0]).toBe("https://dashscope.aliyuncs.com/api/v1/tasks/task-1");
});

test("returns the video URL once succeeded", async () => {
  fetchMock.mockResolvedValueOnce(
    task({ task_status: "SUCCEEDED", video_url: "https://dashscope-result.test/out.mp4" }),
  );

  expect(await dashscopeVideoProvider.result("task-1")).toEqual({
    status: "succeeded",
    url: "https://dashscope-result.test/out.mp4",
  });
});

test("returns the nested video URL from an older motion task", async () => {
  fetchMock.mockResolvedValueOnce(
    task({ task_status: "SUCCEEDED", results: { video_url: "https://dashscope-result.test/motion.mp4" } }),
  );

  expect(await dashscopeVideoProvider.result("task-1")).toEqual({
    status: "succeeded",
    url: "https://dashscope-result.test/motion.mp4",
  });
});

test("rejects a succeeded task without a video URL", async () => {
  fetchMock.mockResolvedValueOnce(task({ task_status: "SUCCEEDED", results: {} }));

  expect(await dashscopeVideoProvider.result("task-1")).toMatchObject({ status: "failed" });
});

test("reports a failed task with its code", async () => {
  fetchMock.mockResolvedValueOnce(
    task({ task_status: "FAILED", code: "DataInspectionFailed", message: "Output data may contain inappropriate content." }),
  );

  expect(await dashscopeVideoProvider.result("task-1")).toEqual({
    status: "failed",
    code: "DataInspectionFailed",
    error: expect.stringContaining("inappropriate content"),
  });
});

test.each(["CANCELED", "UNKNOWN"])("treats %s as failed", async (status) => {
  fetchMock.mockResolvedValueOnce(task({ task_status: status }));

  expect(await dashscopeVideoProvider.result("task-1")).toMatchObject({ status: "failed" });
});

test("throws when Bailian can't be reached, so the caller retries later", async () => {
  fetchMock.mockResolvedValueOnce(json({ code: "InternalError", message: "busy" }, 500));

  await expect(dashscopeVideoProvider.result("task-1")).rejects.toThrow(VideoGenerationError);
});

test("creates a wan2.7-r2v task that puts the photo's subject in the prompt's story", async () => {
  fetchMock.mockResolvedValueOnce(task({ task_status: "PENDING" }));

  expect(await submitReferenceVideo(job)).toBe("task-1");

  const [endpoint, init] = fetchMock.mock.calls[0];
  expect(endpoint).toBe("https://dashscope.aliyuncs.com/api/v1/services/aigc/video-generation/video-synthesis");
  const headers = new Headers(init?.headers);
  expect(headers.get("authorization")).toBe("Bearer sk-test");
  expect(headers.get("x-dashscope-async")).toBe("enable");
  expect(JSON.parse(init?.body as string)).toEqual({
    model: "wan2.7-r2v",
    input: { prompt: job.prompt, media: [{ type: "reference_image", url: job.image.url }] },
    parameters: { resolution: "720P", ratio: "16:9", duration: 12, prompt_extend: true, watermark: false },
  });
});

test("sends the ratio as asked: 9:16 for a vertical video", async () => {
  fetchMock.mockResolvedValueOnce(task({ task_status: "PENDING" }));

  await submitReferenceVideo({ ...job, ratio: "9:16" });

  expect(JSON.parse(fetchMock.mock.calls[0][1]?.body as string).parameters).toMatchObject({ ratio: "9:16" });
});

test("marks a free preview with Bailian's watermark", async () => {
  fetchMock.mockResolvedValueOnce(task({ task_status: "PENDING" }));

  await submitReferenceVideo({ ...job, watermark: true, duration: 5 });

  expect(JSON.parse(fetchMock.mock.calls[0][1]?.body as string).parameters).toMatchObject({ watermark: true, duration: 5 });
});

test("sends the resolution as asked", async () => {
  fetchMock.mockResolvedValueOnce(task({ task_status: "PENDING" }));

  await submitReferenceVideo({ ...job, resolution: "1080P" });

  expect(JSON.parse(fetchMock.mock.calls[0][1]?.body as string).parameters.resolution).toBe("1080P");
});

test("reports Bailian's error code when a task is rejected", async () => {
  fetchMock.mockResolvedValueOnce(json({ request_id: "req-4", code: "InvalidParameter", message: "url error" }, 400));

  const error = await submitReferenceVideo(job).catch((e) => e);

  expect(error).toBeInstanceOf(VideoGenerationError);
  expect(error.code).toBe("InvalidParameter");
});
