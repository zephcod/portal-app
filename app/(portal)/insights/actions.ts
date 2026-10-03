"use server";

import { revalidatePath } from "next/cache";
import { getClientPage } from "@/lib/clientpage";
import { getLastOrganicSyncAt } from "@/lib/data";
import { env } from "@/lib/env";

export type SyncState = { ok: boolean; message: string } | null;

/** Clients can't hammer Meta's Insights API — one manual sync per window. */
const COOLDOWN_MS = 15 * 60 * 1000;

/**
 * Manual "Sync now" for Organic Insights. The portal never talks to
 * Meta for organic stats itself — the scheduler app owns that sync
 * (its lib/organicStats.ts, nightly via /api/cron/organic-stats). This
 * just triggers the same endpoint for the logged-in client's own
 * company, on demand, then refreshes the page. Like the nightly run, it
 * covers the trailing 3 days through yesterday (Meta's daily insights
 * for "today" aren't final yet).
 */
export async function syncOrganicInsightsNow(
  _prev: SyncState,
  _formData: FormData
): Promise<SyncState> {
  const ctx = await getClientPage();
  if (!ctx) return { ok: false, message: "Your page isn't linked yet, nothing to sync." };

  const base = env.schedulerUrl();
  const secret = env.schedulerCronSecret();
  if (!base || !secret) {
    return { ok: false, message: "Sync isn't configured, contact your Awaj ET account manager." };
  }

  const companyId = ctx.session.cid;
  const last = await getLastOrganicSyncAt(companyId).catch(() => null);
  if (last && Date.now() - new Date(last).getTime() < COOLDOWN_MS) {
    const mins = Math.ceil((COOLDOWN_MS - (Date.now() - new Date(last).getTime())) / 60_000);
    return { ok: false, message: `Synced recently, try again in ${mins} min.` };
  }

  try {
    const res = await fetch(
      `${base}/api/cron/organic-stats?company=${encodeURIComponent(companyId)}&days=3`,
      {
        headers: { Authorization: `Bearer ${secret}` },
        cache: "no-store",
        signal: AbortSignal.timeout(120_000),
      }
    );
    const body = (await res.json().catch(() => null)) as {
      ok?: boolean;
      results?: { days: number; error?: string }[];
      error?: string;
    } | null;
    const result = body?.results?.[0];
    if (!res.ok || !body?.ok || result?.error) {
      console.error("[insights-sync] failed:", res.status, body);
      return { ok: false, message: "Sync failed, please try again later." };
    }
    revalidatePath("/insights");
    revalidatePath("/");
    return { ok: true, message: `Synced the last ${result?.days ?? 3} day(s).` };
  } catch (e) {
    console.error("[insights-sync] error:", e);
    return { ok: false, message: "Couldn't reach the sync service, please try again later." };
  }
}
