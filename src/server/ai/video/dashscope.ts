import { type ReferenceVideoJob, VideoGenerationError, type VideoProvider, type VideoResult } from "./types";

// Alibaba Cloud Model Studio (Bailian / DashScope) reference-to-video with
// wan2.7-r2v, as an async task. The photo goes as a signed URL, so
// submission stays small even for multi-megabyte photos. Bailian checks the inputs only once the task runs, so a bad input
// shows up as a FAILED task, not a rejected submission. Bailian keeps
// results for 24 hours, so callers copy them.

const DEFAULT_BASE_URL = "https://dashscope.aliyuncs.com";
const REFERENCE_MODEL = "wan2.7-r2v";
const VIDEO_PATH = "/api/v1/services/aigc/video-generation/video-synthesis";
const FAILED = new Set(["FAILED", "CANCELED", "UNKNOWN"]);

export function dashscopeConfigured() {
  return Boolean(process.env.DASHSCOPE_API_KEY);
}

// The API host for the key's region.
function dashscopeBaseUrl() {
  return (process.env.DASHSCOPE_BASE_URL || DEFAULT_BASE_URL).replace(/\/+$/, "");
}

export const dashscopeVideoProvider: VideoProvider = {
  id: "dashscope",
  result,
};

type Response = {
  code?: string;
  message?: string;
  request_id?: string;
  output?: {
    task_id?: string;
    task_status?: string;
    video_url?: string;
    results?: { video_url?: string };
    code?: string;
    message?: string;
  };
};

async function call(path: string, init: RequestInit & { headers?: Record<string, string> } = {}) {
  const apiKey = process.env.DASHSCOPE_API_KEY;
  if (!apiKey) throw new VideoGenerationError("DASHSCOPE_API_KEY is not set");
  const response = await fetch(`${dashscopeBaseUrl()}${path}`, {
    ...init,
    headers: { "content-type": "application/json", authorization: `Bearer ${apiKey}`, ...init.headers },
    signal: AbortSignal.timeout(30_000),
  });
  const body = (await response.json().catch(() => ({}))) as Response;
  return { response, body };
}

// Queues a wan2.7-r2v video: the prompt's story, starring the photo's
// subject ("Image 1"), in the job's ratio, with generated sound. prompt_extend lets Bailian
// rewrite the prompt into shots; tests showed it keeps every shot.
export function submitReferenceVideo(job: ReferenceVideoJob): Promise<string> {
  return createTask({
    model: REFERENCE_MODEL,
    input: { prompt: job.prompt, media: [{ type: "reference_image", url: job.image.url }] },
    parameters: {
      resolution: job.resolution,
      ratio: job.ratio,
      duration: job.duration,
      prompt_extend: true,
      watermark: job.watermark,
    },
  });
}

async function createTask(body: object): Promise<string> {
  const { response, body: reply } = await call(VIDEO_PATH, {
    method: "POST",
    // The video API is async only.
    headers: { "x-dashscope-async": "enable" },
    body: JSON.stringify(body),
  });
  const taskId = reply.output?.task_id;
  if (!response.ok || reply.code || !taskId) {
    throw new VideoGenerationError(
      `Bailian ${response.status} ${reply.code ?? ""}: ${reply.message ?? ""} (request ${reply.request_id ?? "?"})`,
      reply.code,
    );
  }
  return taskId;
}

async function result(taskId: string): Promise<VideoResult> {
  const { response, body } = await call(`/api/v1/tasks/${encodeURIComponent(taskId)}`);
  const output = body.output;
  if (!response.ok || !output?.task_status) {
    throw new VideoGenerationError(
      `Bailian task ${response.status} ${body.code ?? ""}: ${body.message ?? ""} (request ${body.request_id ?? "?"})`,
      body.code,
    );
  }
  // Reference-to-video and older image-to-video tasks put the URL at the
  // top level; motion transfer nested it.
  const url = output.video_url || output.results?.video_url;
  if (output.task_status === "SUCCEEDED" && url) {
    return { status: "succeeded", url };
  }
  // UNKNOWN: the task is gone, as after 24 hours.
  if (output.task_status === "SUCCEEDED" || FAILED.has(output.task_status)) {
    return {
      status: "failed",
      code: output.code ?? output.task_status,
      error: `Bailian task ${taskId} ${output.task_status} ${output.code ?? ""}: ${output.message ?? ""}`,
    };
  }
  return { status: "pending" };
}
