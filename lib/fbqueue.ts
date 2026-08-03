/**
 * Read-only view of the Social Platform Manager's Facebook scheduling
 * queue (`fb_queue` collection, same Appwrite database). Facebook posts
 * no longer use Facebook's own `scheduled_publish_time` — that path
 * silently throttled once a Page had ~30 pending scheduled posts. Every
 * scheduled Facebook post now lives here as "pending" until the
 * scheduler publishes it directly to Graph at the due time. Media is
 * staged in Appwrite (lib/storage.ts) at compose time, so thumbnails
 * come from there, not from Facebook.
 */

import { Client, Databases, Query } from "node-appwrite";
import { env } from "./env";

export const FB_QUEUE_COLLECTION = "fb_queue";

export type FbMediaType = "text" | "image" | "multiImage" | "video";

export type FbQueueItem = {
  $id: string;
  pageId: string;
  caption: string;
  /** Only meaningful for mediaType "text" — Facebook's link preview card. */
  link?: string;
  mediaType: FbMediaType;
  /** JSON array of Appwrite file ids staged via the scheduler's uploadFbMedia. */
  mediaRefs?: string;
  scheduledAt: number; // unix seconds
  status: "pending" | "approved" | "publishing" | "published" | "failed";
  error?: string;
  fbPostId?: string;
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
export async function listFbQueue(pageId: string): Promise<FbQueueItem[]> {
  const res = await db().listDocuments(env.databaseId(), FB_QUEUE_COLLECTION, [
    Query.equal("pageId", pageId),
    Query.notEqual("status", "published"),
    Query.orderAsc("scheduledAt"),
    Query.limit(100),
  ]);
  return res.documents as unknown as FbQueueItem[];
}

/** Single queue item, scoped to `pageId` — null if missing or owned by another page. */
export async function getFbQueueItem(
  pageId: string,
  id: string
): Promise<FbQueueItem | null> {
  try {
    const doc = await db().getDocument(env.databaseId(), FB_QUEUE_COLLECTION, id);
    const item = doc as unknown as FbQueueItem;
    return item.pageId === pageId ? item : null;
  } catch {
    return null;
  }
}
