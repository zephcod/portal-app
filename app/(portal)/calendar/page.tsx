import { Suspense } from "react";
import CalendarView from "@/components/CalendarView";
import PostsList from "@/components/PostsList";
import { ShowTopContentButton } from "@/components/ShowTopContentButton";
import { Skeleton } from "@/components/ui/skeleton";
import { getClientPage } from "@/lib/clientpage";

export const dynamic = "force-dynamic";

export default async function ClientCalendarPage({
  searchParams,
}: {
  searchParams: Promise<{ m?: string; top?: string }>;
}) {
  const { m, top } = await searchParams;
  const showTop = Boolean(top);

  return (
    <div>
      <h1 className="font-display text-2xl font-bold">Content calendar</h1>
      <Suspense fallback={<CalendarBodySkeleton />}>
        <CalendarBody monthParam={m} showTop={showTop} />
      </Suspense>
    </div>
  );
}

async function CalendarBody({
  monthParam,
  showTop,
}: {
  monthParam?: string;
  showTop: boolean;
}) {
  const ctx = await getClientPage();
  const error = ctx
    ? null
    : "Your account isn't linked to a page yet — contact your Awaj ET account manager.";

  return (
    <>
      <p className="mt-1 text-sm text-muted">
        {ctx?.page.name ?? "Your page"} · scheduled and published posts, ET
        time.
      </p>

      {!error && !showTop && (
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-dashed border-edge bg-card/60 p-4">
          <p className="text-sm text-muted">
            The calendar and recently published list below show scheduled
            posts only. Load published posts from Facebook and Instagram to
            see the full picture.
          </p>
          <ShowTopContentButton label="Show published posts" />
        </div>
      )}

      <div className="mt-4">
        <CalendarView
          page={ctx?.page ?? null}
          error={error}
          monthParam={monthParam}
          basePath="/calendar"
          readOnly
          showTop={showTop}
        />
      </div>

      <hr className="mt-10 border-edge" />

      <div className="mt-8">
        <PostsList page={ctx?.page ?? null} error={error} showTop={showTop} />
      </div>
    </>
  );
}

function PostCardSkeleton() {
  return (
    <div className="rounded-lg border border-edge bg-card p-4 shadow-sm">
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <Skeleton className="h-3 w-28" />
        <Skeleton className="h-3 w-16" />
        <Skeleton className="h-3 w-20" />
      </div>
      <div className="mt-3 flex gap-4">
        <Skeleton className="h-20 w-20 shrink-0 rounded-md" />
        <div className="flex-1 space-y-2">
          <Skeleton className="h-3.5 w-full" />
          <Skeleton className="h-3.5 w-2/3" />
        </div>
      </div>
    </div>
  );
}

function CalendarBodySkeleton() {
  return (
    <>
      <Skeleton className="mt-1 h-4 w-72" />

      <div className="mt-4 flex flex-wrap items-center justify-end gap-2">
        <Skeleton className="h-8 w-9 rounded-md" />
        <Skeleton className="h-5 w-36" />
        <Skeleton className="h-8 w-9 rounded-md" />
      </div>

      <div className="mt-5 flex gap-3">
        {Array.from({ length: 3 }, (_, i) => (
          <Skeleton key={i} className="h-3 w-16" />
        ))}
      </div>

      <div className="mt-4 grid grid-cols-7 gap-px overflow-hidden rounded-lg border border-edge bg-line">
        {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d) => (
          <div key={d} className="bg-navy px-2 py-2 text-center">
            <span className="font-mono text-[10px] tracking-wider text-white/30 uppercase">
              {d}
            </span>
          </div>
        ))}
        {Array.from({ length: 35 }, (_, i) => (
          <div key={i} className="min-h-28 bg-card p-1.5">
            <Skeleton className="h-6 w-6 rounded-full" />
            <Skeleton className="mt-2 h-4 w-full" />
          </div>
        ))}
      </div>

      <hr className="mt-10 border-edge" />

      <div className="mt-8">
        <Skeleton className="h-7 w-64" />
        <Skeleton className="mt-2 h-4 w-80" />

        <Skeleton className="mt-8 h-3 w-32" />
        <div className="mt-3 flex flex-col gap-3">
          {Array.from({ length: 2 }, (_, i) => (
            <PostCardSkeleton key={i} />
          ))}
        </div>

        <Skeleton className="mt-10 h-3 w-40" />
        <div className="mt-3 flex flex-col gap-3">
          {Array.from({ length: 3 }, (_, i) => (
            <PostCardSkeleton key={i} />
          ))}
        </div>
      </div>
    </>
  );
}
