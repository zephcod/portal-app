/**
 * Read-only access to the Social Platform Manager's shared Appwrite
 * Storage bucket where scheduled Facebook/Instagram media is staged
 * (see that app's lib/storage.ts). Scheduling now runs through Appwrite
 * queues (lib/fbqueue.ts, lib/igqueue.ts) instead of Facebook's own
 * scheduler, so thumbnails for pending items come from here, not Graph.
 * The portal never uploads or deletes — only needs the public view URL.
 */
import { env } from "./env";

/** Shared bucket ("profile") the scheduler stages FB/IG queue media in. */
export const MEDIA_BUCKET = "658477e7eef2f71d1693";

/** Public URL for a file in the shared media bucket (public read). */
export function mediaUrl(fileId: string): string {
  return `${env.appwriteEndpoint()}/storage/buckets/${MEDIA_BUCKET}/files/${fileId}/view?project=${env.appwriteProjectId()}`;
}
