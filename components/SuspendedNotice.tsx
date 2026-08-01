import { ShieldAlert } from "lucide-react";
import Link from "next/link";

/**
 * Shown at /login?suspended=1 — the PIN was correct but the account is
 * inactive. Rather than a plain error, this renders a static (non-
 * loading) mockup of the real dashboard's shape, blurred, with a notice
 * overlaid — the "here's what you're missing" pattern, without ever
 * fetching or exposing this company's actual data.
 */
export function SuspendedNotice() {
  return (
    <div className="fixed inset-0 overflow-hidden bg-app">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 mx-auto max-w-6xl scale-[1.02] p-6 blur-md select-none sm:p-10"
      >
        <DashboardMockup />
      </div>

      <div className="absolute inset-0 bg-app/50" aria-hidden />

      <div className="relative flex min-h-full items-center justify-center p-6">
        <div className="w-full max-w-sm rounded-xl border border-edge bg-card p-6 text-center shadow-lg">
          <ShieldAlert className="mx-auto h-10 w-10 text-amber" aria-hidden />
          <h1 className="mt-3 font-display text-xl font-bold">
            Account suspended
          </h1>
          <p className="mt-2 text-sm text-muted">
            Your PIN is correct, but this account is currently inactive.
            Please contact your Awaj ET account manager to restore access.
          </p>
          <Link
            href="/login"
            className="mt-5 inline-flex items-center justify-center rounded-md border border-edge px-4 py-2 text-sm font-semibold text-fg transition-colors hover:border-gold"
          >
            Back to login
          </Link>
        </div>
      </div>
    </div>
  );
}

/** Static (non-animated) placeholder shapes — deliberately not real data. */
function DashboardMockup() {
  return (
    <div>
      <div className="mb-8 flex items-center justify-between">
        <div>
          <div className="h-8 w-56 rounded-md bg-charcoal/10" />
          <div className="mt-2 h-4 w-72 rounded-md bg-charcoal/10" />
        </div>
        <div className="h-9 w-32 rounded-md bg-charcoal/10" />
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {Array.from({ length: 4 }, (_, i) => (
          <div key={i} className="rounded-xl border border-edge bg-card p-4 shadow-sm">
            <div className="h-3 w-16 rounded-md bg-charcoal/10" />
            <div className="mt-2 h-6 w-20 rounded-md bg-charcoal/10" />
            <div className="mt-2 h-3 w-24 rounded-md bg-charcoal/10" />
          </div>
        ))}
      </div>

      <div className="mt-8 grid gap-4 lg:grid-cols-2">
        {Array.from({ length: 2 }, (_, i) => (
          <div key={i} className="rounded-xl border border-edge bg-card p-4 shadow-sm sm:p-6">
            <div className="mb-4 h-5 w-40 rounded-md bg-charcoal/10" />
            <div className="h-32 w-full rounded-md bg-charcoal/10" />
          </div>
        ))}
      </div>

      <div className="mt-8 grid gap-4 lg:grid-cols-2">
        {Array.from({ length: 2 }, (_, i) => (
          <div key={i} className="rounded-xl border border-edge bg-card p-4 shadow-sm sm:p-6">
            <div className="mb-4 h-5 w-40 rounded-md bg-charcoal/10" />
            {Array.from({ length: 3 }, (_, j) => (
              <div key={j} className="mt-3 h-4 w-full rounded-md bg-charcoal/10" />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
