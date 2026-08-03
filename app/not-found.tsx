import { LifeBuoy, SearchX } from "lucide-react";
import Link from "next/link";

/**
 * App-level 404 (Next.js convention — renders whenever a route doesn't
 * match, or notFound() is called). Same layout as app/error.tsx for a
 * consistent "something's off" screen; unlike error.tsx this is a plain
 * Server Component — there's no thrown error to recover from, so the
 * primary action is a link back into the app rather than a refresh.
 */
export default function NotFound() {
  return (
    <div className="fixed inset-0 flex items-center justify-center bg-app p-6">
      <div className="w-full max-w-sm rounded-xl border border-edge bg-card p-6 text-center shadow-lg">
        <SearchX className="mx-auto h-10 w-10 text-amber" aria-hidden />
        <h1 className="mt-3 font-display text-xl font-bold">Page not found</h1>
        <p className="mt-2 text-sm text-muted">
          The page you&apos;re looking for doesn&apos;t exist or may have moved.
        </p>
        <div className="mt-5 flex flex-col gap-2">
          <Link
            href="/"
            className="flex items-center justify-center gap-2 rounded-md bg-gold py-2.5 text-sm font-semibold text-navy transition-colors hover:bg-amber"
          >
            Back to Overview
          </Link>
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
