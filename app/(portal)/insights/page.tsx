import { Suspense } from "react";
import InsightsView from "@/components/InsightsView";
import { Skeleton } from "@/components/ui/skeleton";
import { getClientPage } from "@/lib/clientpage";

export const dynamic = "force-dynamic";

export default async function ClientInsightsPage({
  searchParams,
}: {
  searchParams: Promise<{ d?: string }>;
}) {
  const { d } = await searchParams;
  const days = d === "7" ? 7 : 28;

  return (
    <div>
      <h1 className="text-2xl font-bold">Organic Insights</h1>
      <Suspense fallback={<InsightsBodySkeleton />}>
        <InsightsBody days={days} />
      </Suspense>
    </div>
  );
}

async function InsightsBody({ days }: { days: number }) {
  const ctx = await getClientPage();

  return (
    <>
      <p className="mt-1 text-sm text-muted">
        {ctx?.page.name ?? "Your page"} · reach and engagement across
        platforms.
      </p>
      <div className="mt-4">
        <InsightsView
          page={ctx?.page ?? null}
          error={
            ctx
              ? null
              : "Your account isn't linked to a page yet — contact your Awaj ET account manager."
          }
          days={days}
          basePath="/insights"
        />
      </div>
    </>
  );
}

function PostRowSkeleton() {
  return (
    <li className="rounded-lg border border-edge bg-card p-3 shadow-sm">
      <div className="flex items-center gap-3">
        <Skeleton className="h-12 w-12 shrink-0 rounded-md" />
        <div className="min-w-0 flex-1 space-y-2">
          <Skeleton className="h-3.5 w-full" />
          <Skeleton className="h-3 w-24" />
        </div>
      </div>
    </li>
  );
}

function InsightsBodySkeleton() {
  return (
    <>
      <Skeleton className="mt-1 h-4 w-80" />

      <div className="mt-4">
        <div className="flex justify-end gap-2">
          <Skeleton className="h-8 w-20 rounded-full" />
          <Skeleton className="h-8 w-20 rounded-full" />
        </div>

        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {Array.from({ length: 4 }, (_, i) => (
            <div
              key={i}
              className="rounded-lg border border-edge bg-card px-4 py-3 shadow-sm"
            >
              <Skeleton className="h-3 w-16" />
              <Skeleton className="mt-2 h-6 w-14" />
            </div>
          ))}
        </div>

        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          {Array.from({ length: 2 }, (_, i) => (
            <div
              key={i}
              className="rounded-lg border border-edge bg-card p-4 shadow-sm"
            >
              <div className="flex items-baseline justify-between">
                <Skeleton className="h-3 w-32" />
                <Skeleton className="h-5 w-10" />
              </div>
              <Skeleton className="mt-3 h-24 w-full" />
            </div>
          ))}
        </div>

        <div className="mt-8 grid gap-6 md:grid-cols-2">
          {Array.from({ length: 2 }, (_, i) => (
            <div key={i}>
              <Skeleton className="h-3 w-36" />
              <ul className="mt-3 flex flex-col gap-2">
                {Array.from({ length: 3 }, (_, j) => (
                  <PostRowSkeleton key={j} />
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}
