// The image check (image.ts) flagged a photo, or the provider's own
// moderation refused it.
export class ContentBlockedError extends Error {}

// No safe verdict is available. Generation must stop before spending credits.
export class ModerationUnavailableError extends Error {}
