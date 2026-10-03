/**
 * View of the Social Platform Manager's Facebook scheduling
 * queue (`fb_queue` collection, same Appwrite database). Facebook posts
 * no longer use Facebook's own `scheduled_publish_time` — that path
 * silently throttled once a Page had ~30 pending scheduled posts. Every
 * scheduled Facebook post now lives here as "pending" until the
 * scheduler publishes it directly to Graph at the due time. Media is
 * staged in Appwrite (lib/storage.ts) at compose time, so thumbnails
 * come from there, not from Facebook. The portal never publishes —
 * clients can only reschedule, edit the caption, or approve (see the
 * client-side writes at the bottom).
 */

import { Client, Databases, Query } from "node-appwrite";
import { env } from "./env";
import type { ResetStatus } from "./planned";

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
  /** See the scheduler's lib/queueStatus.ts — planned* = unlinked company, posted by the client. */
  status:
    | "pending"
    | "approved"
    | "publishing"
    | "published"
    | "failed"
    | "planned"
    | "planned_ok"
    | "posted_manually";
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

/**
 * Non-published items for the given page key(s), soonest first — a
 * real page id and/or `co:<companyId>` for planned posts (lib/clientpage.ts).
 */
export async function listFbQueue(pageId: string | string[]): Promise<FbQueueItem[]> {
  const res = await db().listDocuments(env.databaseId(), FB_QUEUE_COLLECTION, [
    Query.equal("pageId", pageId),
    Query.notEqual("status", "published"),
    Query.orderAsc("scheduledAt"),
    Query.limit(100),
  ]);
  return res.documents as unknown as FbQueueItem[];
}

/** Single queue item, scoped to the page key(s) — null if missing or owned by another page. */
export async function getFbQueueItem(
  pageId: string | string[],
  id: string
): Promise<FbQueueItem | null> {
  try {
    const doc = await db().getDocument(env.databaseId(), FB_QUEUE_COLLECTION, id);
    const item = doc as unknown as FbQueueItem;
    const keys = Array.isArray(pageId) ? pageId : [pageId];
    return keys.includes(item.pageId) ? item : null;
  } catch {
    return null;
  }
}

// ── Client-side writes ────────────────────────────────────────────
// The only writes the portal makes to the scheduler's queue: schedule
// time, caption, and the pending/approved sign-off. Callers must have
// already checked ownership via getFbQueueItem(pageId, id). Same
// document shapes as the scheduler's own lib/fbqueue.ts.

export async function rescheduleFbItem(
  id: string,
  scheduledAt: number,
  status: ResetStatus
): Promise<void> {
  await db().updateDocument(env.databaseId(), FB_QUEUE_COLLECTION, id, {
    scheduledAt,
    status,
    error: null,
  });
}

/** Resets status (pending/planned) — an edited post needs re-approval. */
export async function editFbItemCaption(
  id: string,
  caption: string,
  status: ResetStatus
): Promise<void> {
  await db().updateDocument(env.databaseId(), FB_QUEUE_COLLECTION, id, {
    caption: caption.slice(0, 63000),
    status,
    error: null,
  });
}

export async function setFbItemStatus(
  id: string,
  status: "pending" | "approved" | "planned" | "planned_ok" | "posted_manually"
): Promise<void> {
  await db().updateDocument(env.databaseId(), FB_QUEUE_COLLECTION, id, { status });
}
