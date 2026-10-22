import { eq } from "drizzle-orm";
import { getDb } from "@/server/db";
import { apikey } from "@/server/db/legacy-schema";
import { deleteUserFeedbackImages } from "@/server/feedback";
import { log } from "@/server/log";
import { assertNoLiveSubscription, LiveSubscriptionError } from "@/server/payment/subscriptions";
import { deletePrefix, storageConfigured } from "@/server/storage";
import { deleteUserVideos } from "@/server/videos";

export { LiveSubscriptionError };

// Account deletion, across the modules that hold a user's data. Rows
// cascade with the user; these cover what the database can't.

// Throws LiveSubscriptionError while the user has a live subscription: the
// provider would keep charging after the account is gone.
export async function beforeDeleteUser(userId: string): Promise<void> {
  await assertNoLiveSubscription(userId);
}

// Deletes the user's stored files, and the API keys and images the app
// made before it dropped those features (src/server/db/legacy-schema.ts).
// API keys name their owner without a foreign key, so they don't cascade.
// The account is already gone, so a storage failure can't undo it: it's
// logged for an operator to delete the files by hand.
export async function afterDeleteUser(userId: string): Promise<void> {
  await getDb().delete(apikey).where(eq(apikey.referenceId, userId));
  try {
    await Promise.all([deleteLegacyImages(userId), deleteUserVideos(userId), deleteUserFeedbackImages(userId)]);
  } catch (error) {
    log.error("storage.user_files_not_deleted", { userId, error });
  }
}

// Text-to-image stored each image as images/<userId>/<id>.png.
async function deleteLegacyImages(userId: string): Promise<void> {
  if (storageConfigured()) await deletePrefix(`images/${userId}/`);
}
