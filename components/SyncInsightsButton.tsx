"use client";

import { RefreshCw } from "lucide-react";
import { useActionState } from "react";
import { syncOrganicInsightsNow, type SyncState } from "@/app/(portal)/insights/actions";
import { relativeFromNow } from "@/lib/format";

/** "Sync now" for Organic Insights (adapted from the scheduler's SyncStatsButton). */
export default function SyncInsightsButton({
  lastSyncedAt,
}: {
  /** ISO datetime of the last successful sync for this company, if any. */
  lastSyncedAt?: string | null;
}) {
  const [state, formAction, pending] = useActionState<SyncState, FormData>(
    syncOrganicInsightsNow,
    null
  );

  return (
    <div className="flex flex-col items-end gap-1">
      <form action={formAction}>
        <button
          disabled={pending}
          className="flex items-center gap-1.5 rounded-md border border-edge bg-card px-3 py-1.5 text-xs font-semibold text-muted hover:text-fg disabled:opacity-50"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${pending ? "animate-spin" : ""}`} />
          {pending ? "Syncing…" : "Sync from Meta"}
        </button>
      </form>
      {lastSyncedAt && !state && (
        <span className="font-mono text-[10px] text-muted">
          Last synced {relativeFromNow(Math.floor(new Date(lastSyncedAt).getTime() / 1000))}
        </span>
      )}
      {state && (
        <span className={`font-mono text-[10px] ${state.ok ? "text-amber" : "text-red-600"}`}>
          {state.message}
        </span>
      )}
    </div>
  );
}
