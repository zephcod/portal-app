import { Skeleton } from "@/components/ui/skeleton";

export default function DashboardLoading() {
  return (
    <div className="mx-auto max-w-6xl">
      <header className="mb-8 flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-col gap-2">
          <Skeleton className="h-4 w-40" />
          <Skeleton className="h-8 w-56" />
          <Skeleton className="h-4 w-32" />
        </div>
        <Skeleton className="h-9 w-32 rounded-full" />
      </header>

      <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {Array.from({ length: 8 }, (_, i) => (
          <div
            key={i}
            className="rounded-xl border border-edge bg-card p-4 shadow-sm"
          >
            <Skeleton className="h-3 w-20" />
            <Skeleton className="mt-2 h-6 w-16" />
          </div>
        ))}
      </section>

      <section className="mt-8 rounded-xl border border-edge bg-card p-4 shadow-sm sm:p-6">
        <Skeleton className="mb-4 h-5 w-40" />
        <Skeleton className="h-56 w-full" />
      </section>

      <section className="mt-8 rounded-xl border border-edge bg-card shadow-sm">
        <div className="px-4 pt-5 sm:px-6">
          <Skeleton className="h-5 w-28" />
        </div>
        <div className="mt-4 flex flex-col gap-3 px-4 pb-6 sm:px-6">
          {Array.from({ length: 5 }, (_, i) => (
            <Skeleton key={i} className="h-8 w-full" />
          ))}
        </div>
      </section>
    </div>
  );
}
