"use client";

import { LifeBuoy, RefreshCw, TriangleAlert } from "lucide-react";
import Link from "next/link";
import { useEffect } from "react";

/**
 * App-level error boundary (Next.js convention — catches any otherwise
 * unhandled error thrown while rendering a route). Deliberately simple:
 * a full page refresh (not `reset()` — that only re-renders the failed
 * segment, which tends to immediately error again the same way) and a
 * link to the existing Support Requests feature, since clients already
 * have that channel rather than a fabricated email address.
 */
export default function Error({
  error,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="fixed inset-0 flex items-center justify-center bg-app p-6">
      <div className="w-full max-w-sm rounded-xl border border-edge bg-card p-6 text-center shadow-lg">
        <TriangleAlert className="mx-auto h-10 w-10 text-amber" aria-hidden />
        <h1 className="mt-3 font-display text-xl font-bold">Something went wrong</h1>
        <p className="mt-2 text-sm text-muted">
          An unexpected error occurred. Refreshing usually fixes it — if it
          keeps happening, let us know.
        </p>
        <div className="mt-5 flex flex-col gap-2">
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="flex items-center justify-center gap-2 rounded-md bg-gold py-2.5 text-sm font-semibold text-navy transition-colors hover:bg-amber"
          >
            <RefreshCw className="h-4 w-4" aria-hidden />
            Refresh page
          </button>
          <Link
            href="/issues"
            className="flex items-center justify-center gap-2 rounded-md border border-edge py-2.5 text-sm font-semibold text-fg transition-colors hover:border-gold"
          >
            <LifeBuoy className="h-4 w-4" aria-hidden />
            Contact support
          </Link>
        </div>
      </div>
    </div>
  );
}
