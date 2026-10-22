import { dashscopeConfigured, dashscopeVideoProvider, submitReferenceVideo } from "./dashscope";
import type { ReferenceVideoJob, VideoProvider } from "./types";

export * from "./types";

// The provider a video's row names, which polls its job. Only Bailian
// ("dashscope") is left; older rows may name a dropped provider (fal,
// seeapi), which gets null.
export function getVideoProvider(id: string): VideoProvider | null {
  return id === dashscopeVideoProvider.id ? dashscopeVideoProvider : null;
}

// Photo effects run on Bailian. Their jobs are polled through the
// "dashscope" provider. Null without a Bailian key.
export function getEffectVideoProvider(): {
  id: "dashscope";
  submit(job: ReferenceVideoJob): Promise<string>;
} | null {
  return dashscopeConfigured() ? { id: "dashscope", submit: submitReferenceVideo } : null;
}
