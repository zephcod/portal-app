import { Skeleton } from "@/components/ui/skeleton";

export default function OverviewLoading() {
  return (
    <div className="mx-auto max-w-6xl">
      <header className="mb-8 flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-col gap-2">
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-4 w-56" />
        </div>
        <Skeleton className="h-9 w-32 rounded-full" />
      </header>

      <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {Array.from({ length: 4 }, (_, i) => (
          <div key={i} className="rounded-xl border border-edge bg-card p-4 shadow-sm">
            <Skeleton className="h-3 w-16" />
            <Skeleton className="mt-2 h-6 w-20" />
            <Skeleton className="mt-2 h-3 w-24" />
          </div>
        ))}
      </section>

      <section className="mt-8 grid gap-4 lg:grid-cols-2">
        <div className="rounded-xl border border-edge bg-card p-4 shadow-sm sm:p-6">
          <Skeleton className="mb-4 h-5 w-40" />
          <Skeleton className="h-32 w-full" />
          <Skeleton className="mt-6 h-32 w-full" />
        </div>
        <div className="rounded-xl border border-edge bg-card p-4 shadow-sm sm:p-6">
          <Skeleton className="mb-4 h-5 w-32" />
          {Array.from({ length: 4 }, (_, i) => (
            <div key={i} className="flex items-center justify-between py-2.5">
              <Skeleton className="h-3 w-16" />
              <Skeleton className="h-4 w-16" />
            </div>
          ))}
        </div>
      </section>

      <section className="mt-8 grid gap-4 lg:grid-cols-2">
        <div className="rounded-xl border border-edge bg-card p-4 shadow-sm sm:p-6">
          <Skeleton className="mb-4 h-5 w-40" />
          {Array.from({ length: 3 }, (_, i) => (
            <Skeleton key={i} className="mt-2 h-6 w-full" />
          ))}
        </div>
        <div className="rounded-xl border border-edge bg-card p-4 shadow-sm sm:p-6">
          <Skeleton className="mb-4 h-5 w-40" />
          {Array.from({ length: 3 }, (_, i) => (
            <Skeleton key={i} className="mt-3 h-4 w-full" />
          ))}
        </div>
      </section>

      <section className="mt-8 rounded-xl border border-edge bg-card p-4 shadow-sm sm:p-6">
        <Skeleton className="mb-4 h-5 w-56" />
        <div className="grid gap-4 sm:grid-cols-3">
          {Array.from({ length: 3 }, (_, i) => (
            <div key={i}>
              <Skeleton className="h-32 w-full rounded-md" />
              <Skeleton className="mt-2 h-3.5 w-full" />
              <Skeleton className="mt-1.5 h-3 w-2/3" />
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
