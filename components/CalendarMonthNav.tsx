"use client";

import { ChevronLeft, ChevronRight, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

type Dir = "prev" | "next" | "today";

/**
 * Prev/Next/Today month controls for CalendarView. A client component
 * (router.push + useTransition, same pattern as RangeSelect) so the
 * clicked button can swap its icon for a spinner while the new month
 * streams in — same size, same position, nothing else in the row moves.
 */
export function CalendarMonthNav({
  basePath,
  prevMonth,
  nextMonth,
  monthLabel,
  showToday,
}: {
  basePath: string;
  prevMonth: string;
  nextMonth: string;
  monthLabel: string;
  showToday: boolean;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [pendingDir, setPendingDir] = useState<Dir | null>(null);

  const go = (dir: Dir, href: string) => {
    setPendingDir(dir);
    startTransition(() => {
      router.push(href);
    });
  };

  return (
    <div className="flex flex-wrap items-center justify-end gap-2">
      <button
        type="button"
        aria-label="Previous month"
        disabled={isPending}
        onClick={() => go("prev", `${basePath}?m=${prevMonth}`)}
        className="flex items-center rounded-md border border-edge bg-card px-2.5 py-1.5 hover:border-gold disabled:pointer-events-none disabled:opacity-60"
      >
        {isPending && pendingDir === "prev" ? (
          <Loader2 className="h-4 w-4 animate-spin" aria-label="Loading" />
        ) : (
          <ChevronLeft className="h-4 w-4" />
        )}
      </button>
      <span className="min-w-36 text-center font-display text-sm font-semibold">
        {monthLabel}
      </span>
      <button
        type="button"
        aria-label="Next month"
        disabled={isPending}
        onClick={() => go("next", `${basePath}?m=${nextMonth}`)}
        className="flex items-center rounded-md border border-edge bg-card px-2.5 py-1.5 hover:border-gold disabled:pointer-events-none disabled:opacity-60"
      >
        {isPending && pendingDir === "next" ? (
          <Loader2 className="h-4 w-4 animate-spin" aria-label="Loading" />
        ) : (
          <ChevronRight className="h-4 w-4" />
        )}
      </button>
      {showToday && (
        <button
          type="button"
          disabled={isPending}
          onClick={() => go("today", basePath)}
          className="rounded-md border border-edge bg-card px-3 py-1.5 font-mono text-[11px] text-muted hover:border-gold disabled:pointer-events-none disabled:opacity-60"
        >
          {isPending && pendingDir === "today" ? (
            <Loader2 className="mx-auto h-3 w-3 animate-spin" aria-label="Loading" />
          ) : (
            "Today"
          )}
        </button>
      )}
    </div>
  );
}
