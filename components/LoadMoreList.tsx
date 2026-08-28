"use client";

import { useState } from "react";

/**
 * Reveals a server-rendered list of items a page at a time, with a
 * "Load more" trigger. Items are pre-rendered <li> elements passed down
 * from a Server Component — passing rendered JSX as children/props is
 * fine across the RSC boundary; passing a render *function* isn't, so
 * the caller owns each item's markup and this just owns how many show.
 */
export function LoadMoreList({
  items,
  pageSize,
  className = "mt-3 flex flex-col gap-3",
  compact = false,
}: {
  items: React.ReactNode[];
  pageSize: number;
  className?: string;
  /** Smaller inline text-link trigger instead of the full-width dashed box — for tight lists like a balance breakdown. */
  compact?: boolean;
}) {
  const [visibleCount, setVisibleCount] = useState(pageSize);
  const remaining = items.length - visibleCount;

  return (
    <ul className={className}>
      {items.slice(0, visibleCount)}
      {remaining > 0 && (
        <li className={compact ? "pt-0.5 text-center" : undefined}>
          <button
            type="button"
            onClick={() => setVisibleCount((c) => c + pageSize)}
            className={
              compact
                ? "font-mono text-[11px] text-amber underline"
                : "w-full rounded-lg border border-dashed border-edge py-2.5 text-center text-sm font-medium text-muted transition-colors hover:border-gold hover:text-fg"
            }
          >
            Load {Math.min(pageSize, remaining)} more · {remaining} remaining
          </button>
        </li>
      )}
    </ul>
  );
}
