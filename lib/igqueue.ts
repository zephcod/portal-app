/**
 * View of the scheduler's Instagram queue (`ig_queue` collection,
 * same Appwrite database). The portal never publishes — the scheduler
 * app owns the publishing workers. Clients can only reschedule, edit
 * the caption, or approve (see the client-side writes at the bottom).
 */

import { Client, Databases, Query } from "node-appwrite";
import { env } from "./env";
import type { ResetStatus } from "./planned";

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

/**
 * Non-published items for the given page key(s), soonest first — a
 * real page id and/or `co:<companyId>` for planned posts (lib/clientpage.ts).
 */
export async function listIgQueue(pageId: string | string[]): Promise<IgQueueItem[]> {
  const res = await db().listDocuments(env.databaseId(), IG_QUEUE_COLLECTION, [
    Query.equal("pageId", pageId),
    Query.notEqual("status", "published"),
    Query.orderAsc("scheduledAt"),
    Query.limit(100),
  ]);
  return res.documents as unknown as IgQueueItem[];
}

/** Single queue item, scoped to the page key(s) — null if missing or owned by another page. */
export async function getIgQueueItem(
  pageId: string | string[],
  id: string
): Promise<IgQueueItem | null> {
  try {
    const doc = await db().getDocument(env.databaseId(), IG_QUEUE_COLLECTION, id);
    const item = doc as unknown as IgQueueItem;
    const keys = Array.isArray(pageId) ? pageId : [pageId];
    return keys.includes(item.pageId) ? item : null;
  } catch {
    return null;
  }
}

// ── Client-side writes ────────────────────────────────────────────
// See lib/fbqueue.ts — same three writes, ownership checked by callers.

export async function rescheduleIgItem(
  id: string,
  scheduledAt: number,
  status: ResetStatus
): Promise<void> {
  await db().updateDocument(env.databaseId(), IG_QUEUE_COLLECTION, id, {
    scheduledAt,
    status,
    error: null,
  });
}

/** Resets status (pending/planned) — an edited post needs re-approval. */
export async function editIgItemCaption(
  id: string,
  caption: string,
  status: ResetStatus
): Promise<void> {
  await db().updateDocument(env.databaseId(), IG_QUEUE_COLLECTION, id, {
    caption: caption.slice(0, 2200),
    status,
    error: null,
  });
}

export async function setIgItemStatus(
  id: string,
  status: "pending" | "approved" | "planned" | "planned_ok" | "posted_manually"
): Promise<void> {
  await db().updateDocument(env.databaseId(), IG_QUEUE_COLLECTION, id, { status });
}
