/**
 * Read-only view of the scheduler's Instagram queue (`ig_queue`
 * collection, same Appwrite database). The portal never publishes —
 * the scheduler app owns the publishing workers.
 */

import { Client, Databases, Query } from "node-appwrite";
import { env } from "./env";

export const IG_QUEUE_COLLECTION = "ig_queue";

export type IgMediaType = "image" | "carousel" | "reel";

export type IgQueueItem = {
  $id: string;
  pageId: string;
  igUserId: string;
  igUsername?: string;
  caption: string;
  /** First media ref (kept for schema compat; see mediaRefs). */
  fbPhotoId: string;
  mediaType?: IgMediaType;
  /** JSON array of Appwrite file ids: photo(s) for image/carousel, video for reel. */
  mediaRefs?: string;
  /** Appwrite file id of a custom Reel cover image, if one was provided. */
  thumbRef?: string;
  scheduledAt: number; // unix seconds
  status: "pending" | "approved" | "publishing" | "published" | "failed";
  error?: string;
  igMediaId?: string;
};

let _db: Databases | null = null;

function db(): Databases {
  if (_db) return _db;
  const client = new Client()
    .setEndpoint(env.appwriteEndpoint())
    .setProject(env.appwriteProjectId())
    .setKey(env.appwriteApiKey());
  _db = new Databases(client);
  return _db;
}

/** Pending + failed items for one page, soonest first. */
export async function listIgQueue(pageId: string): Promise<IgQueueItem[]> {
  const res = await db().listDocuments(env.databaseId(), IG_QUEUE_COLLECTION, [
    Query.equal("pageId", pageId),
    Query.notEqual("status", "published"),
    Query.orderAsc("scheduledAt"),
    Query.limit(100),
  ]);
  return res.documents as unknown as IgQueueItem[];
}

/** Single queue item, scoped to `pageId` — null if missing or owned by another page. */
export async function getIgQueueItem(
  pageId: string,
  id: string
): Promise<IgQueueItem | null> {
  try {
    const doc = await db().getDocument(env.databaseId(), IG_QUEUE_COLLECTION, id);
    const item = doc as unknown as IgQueueItem;
    return item.pageId === pageId ? item : null;
  } catch {
    return null;
  }
}
