import { Client, Databases, ID, Query } from "node-appwrite";
import { env } from "./env";

export { ID, Query };
export * from "./domain";

export const COLLECTIONS = {
  companies: "companies",
  campaigns: "report_campaigns",
  insights: "insights_daily",
  issues: "report_issues",
  costs: "campaign_costs",
} as const;

let _db: Databases | null = null;

/** Server-side Appwrite Databases client (singleton). */
export function db(): Databases {
  if (_db) return _db;
  const client = new Client()
    .setEndpoint(env.appwriteEndpoint())
    .setProject(env.appwriteProjectId())
    .setKey(env.appwriteApiKey());
  _db = new Databases(client);
  return _db;
}

export const DB = () => env.databaseId();

// ── Transient-error retry ─────────────────────────────────
//
// Appwrite Cloud sits behind a CDN edge that occasionally returns
// "503 first byte timeout" (or 429/5xx) under bursts of sequential
// requests — exactly what a Meta sync produces. Retry those with
// exponential backoff + jitter instead of failing the whole sync.

const RETRYABLE = new Set([408, 429, 500, 502, 503, 504]);

function isRetryable(e: unknown): boolean {
  const err = e as { code?: number; message?: string };
  if (typeof err.code === "number" && RETRYABLE.has(err.code)) return true;
  // Network-level failures (no HTTP code) are also worth retrying.
  return /fetch failed|ECONNRESET|ETIMEDOUT|socket hang up|first byte timeout/i.test(
    err.message ?? ""
  );
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export async function withRetry<T>(
  fn: () => Promise<T>,
  attempts = 5
): Promise<T> {
  let delay = 500;
  for (let i = 0; ; i++) {
    try {
      return await fn();
    } catch (e) {
      if (i >= attempts - 1 || !isRetryable(e)) throw e;
      await sleep(delay + Math.random() * 250);
      delay = Math.min(delay * 2, 8000);
    }
  }
}

export async function listAll<T>(
  collectionId: string,
  queries: string[] = []
): Promise<T[]> {
  const out: T[] = [];
  let cursor: string | undefined;
  // Page through in batches of 500.
  for (;;) {
    const page = await withRetry(() =>
      db().listDocuments(DB(), collectionId, [
        Query.limit(500),
        ...(cursor ? [Query.cursorAfter(cursor)] : []),
        ...queries,
      ])
    );
    out.push(...(page.documents as unknown as T[]));
    if (page.documents.length < 500) break;
    cursor = page.documents[page.documents.length - 1].$id;
  }
  return out;
}
