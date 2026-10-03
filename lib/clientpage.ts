/**
 * Resolve what a client session is allowed to see.
 *
 * getClientTarget(): the client's queue scope — always available for a
 * valid session, linked or not. `pageKeys` are the fb_queue/ig_queue
 * `pageId` values that belong to this company: its real page id (once
 * linked) plus `co:<companyId>` for planned posts (lib/planned.ts).
 * Past-due planned posts keep the `co:` key even after linking, so both
 * stay in scope. `page` is null until the company links a page.
 *
 * getClientPage(): the linked-only subset — null when the session is
 * missing or the company has no resolvable page. Used by the views that
 * need live Graph data (insights, published posts).
 */

import { cookies } from "next/headers";
import {
  CLIENT_COOKIE,
  verifyClientToken,
  type ClientSession,
} from "./clientsession";
import { getCompany } from "./data";
import { listPages, type ManagedPage } from "./pages";
import { plannedKey } from "./planned";

export type ClientTarget = {
  session: ClientSession;
  page: ManagedPage | null;
  pageKeys: string[];
};

export async function getClientTarget(): Promise<ClientTarget | null> {
  const token = (await cookies()).get(CLIENT_COOKIE)?.value;
  const session = token ? await verifyClientToken(token) : null;
  if (!session) return null;

  // The page id is baked into the session at login; a company that links
  // its page mid-session is picked up live instead of forcing a re-login.
  let pageId = session.pageId;
  if (!pageId) pageId = (await getCompany(session.cid))?.fbPageId ?? "";

  const page = pageId ? ((await listPages()).find((p) => p.id === pageId) ?? null) : null;
  const pageKeys = pageId ? [pageId, plannedKey(session.cid)] : [plannedKey(session.cid)];
  return { session, page, pageKeys };
}

export async function getClientPage(): Promise<{
  session: ClientSession;
  page: ManagedPage;
} | null> {
  const target = await getClientTarget();
  if (!target?.page) return null;
  return { session: target.session, page: target.page };
}
