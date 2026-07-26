import { Skeleton } from "@/components/ui/skeleton";

export default function IssuesLoading() {
  return (
    <div className="mx-auto max-w-3xl">
      <header className="mb-8 flex flex-col gap-2">
        <Skeleton className="h-4 w-40" />
        <Skeleton className="h-8 w-32" />
        <Skeleton className="h-4 w-full max-w-md" />
      </header>

      <section className="rounded-xl border border-line bg-white p-4 shadow-sm sm:p-6">
        <Skeleton className="mb-4 h-5 w-32" />
        <div className="space-y-3">
          <Skeleton className="h-9 w-full rounded-md" />
          <Skeleton className="h-24 w-full rounded-md" />
          <Skeleton className="h-9 w-32 rounded-md" />
        </div>
      </section>

      <section className="mt-8">
        <Skeleton className="mb-3 h-5 w-28" />
        <ul className="space-y-3">
          {Array.from({ length: 3 }, (_, i) => (
            <li
              key={i}
              className="rounded-xl border border-line bg-white p-4 shadow-sm sm:p-5"
            >
              <div className="flex items-center justify-between gap-2">
                <Skeleton className="h-4 w-40" />
                <Skeleton className="h-5 w-16 rounded-full" />
              </div>
              <Skeleton className="mt-2 h-3 w-24" />
              <Skeleton className="mt-3 h-3.5 w-full" />
              <Skeleton className="mt-1.5 h-3.5 w-2/3" />
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
