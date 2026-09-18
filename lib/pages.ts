/**
 * Managed-page resolution + active-page selection.
 *
 * Multi-page mode: FB_SYSTEM_USER_TOKEN (shared system-user credential,
 * still from .env) + the distinct `fbPageId` values across all
 * companies in Appwrite — Appwrite is the single source of truth for
 * which pages are in scope, so a company's fbPageId can never silently
 * drift out of sync with a hand-maintained id list. For each page id
 * the Page token is derived via `GET /{page-id}?fields=access_token`
 * (system-user pages don't reliably appear in /me/accounts).
 *
 * Legacy single-page mode: FB_PAGE_ID + FB_PAGE_ACCESS_TOKEN — a manual
 * local-testing escape hatch, independent of Appwrite.
 *
 * Results are cached in-process for 10 minutes (this also bounds how
 * often the Appwrite companies collection is scanned). The active page
 * is a cookie; it defaults to the first configured page.
 */

import { cookies } from "next/headers";
import { env } from "./env";
import { getPageInfo } from "./facebook";
import { getCompanies } from "./data";

export type ManagedPage = {
  id: string;
  name: string;
  pictureUrl?: string;
  fanCount?: number;
  /** Page access token — server-side only, never pass to client components. */
  token: string;
};

export const ACTIVE_PAGE_COOKIE = "awaj_fb_active_page";

let cache: { pages: ManagedPage[]; at: number } | null = null;
const TTL_MS = 10 * 60 * 1000;

/** Distinct, non-empty fbPageId values across all companies. */
async function companyPageIds(): Promise<string[]> {
  const companies = await getCompanies();
  const ids = new Set<string>();
  for (const c of companies) {
    if (c.fbPageId) ids.add(c.fbPageId);
  }
  return [...ids];
}

export async function listPages(): Promise<ManagedPage[]> {
  if (cache && Date.now() - cache.at < TTL_MS) return cache.pages;

  const pages: ManagedPage[] = [];
  const sys = env.systemToken();
  const ids = sys ? await companyPageIds() : [];

  if (sys && ids.length) {
    // Multi-page: derive each page's token from the system-user token.
    // One bad/inaccessible id must not take down every other company's
    // social data — isolate failures per id instead of aborting the loop.
    for (const id of ids) {
      try {
        const info = await getPageInfo(sys, id, true);
        if (!info.access_token) {
          console.error(
            `[lib/pages] Page ${id} returned no access_token — is it assigned to the system user as an asset? Skipping.`
          );
          continue;
        }
        pages.push({
          id: info.id,
          name: info.name,
          pictureUrl: info.picture?.data?.url,
          fanCount: info.fan_count,
          token: info.access_token,
        });
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        console.error(`[lib/pages] Failed to resolve page ${id} — skipping: ${msg}`);
      }
    }
  } else if (env.legacyPageId() && env.legacyPageToken()) {
    // Legacy single-page mode.
    const info = await getPageInfo(env.legacyPageToken(), env.legacyPageId());
    pages.push({
      id: info.id,
      name: info.name,
      pictureUrl: info.picture?.data?.url,
      fanCount: info.fan_count,
      token: env.legacyPageToken(),
    });
  }

  cache = { pages, at: Date.now() };
  return pages;
}

/** The page the user is currently working with (cookie, else first). */
export async function getActivePage(): Promise<ManagedPage | null> {
  const pages = await listPages();
  if (!pages.length) return null;
  const chosen = (await cookies()).get(ACTIVE_PAGE_COOKIE)?.value;
  return pages.find((p) => p.id === chosen) ?? pages[0];
}
