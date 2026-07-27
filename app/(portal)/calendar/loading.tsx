import { Skeleton } from "@/components/ui/skeleton";

function PostCard() {
  return (
    <div className="rounded-lg border border-line bg-white p-4 shadow-sm">
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

export default function CalendarLoading() {
  return (
    <div>
      <Skeleton className="h-8 w-56" />
      <Skeleton className="mt-2 h-4 w-72" />

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

      <div className="mt-4 grid grid-cols-7 gap-px overflow-hidden rounded-lg border border-line bg-line">
        {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d) => (
          <div key={d} className="bg-navy px-2 py-2 text-center">
            <span className="font-mono text-[10px] tracking-wider text-white/30 uppercase">
              {d}
            </span>
          </div>
        ))}
        {Array.from({ length: 35 }, (_, i) => (
          <div key={i} className="min-h-28 bg-white p-1.5">
            <Skeleton className="h-6 w-6 rounded-full" />
            <Skeleton className="mt-2 h-4 w-full" />
          </div>
        ))}
      </div>

      <hr className="mt-10 border-line" />

      <div className="mt-8">
        <Skeleton className="h-7 w-64" />
        <Skeleton className="mt-2 h-4 w-80" />

        <Skeleton className="mt-8 h-3 w-32" />
        <div className="mt-3 flex flex-col gap-3">
          {Array.from({ length: 2 }, (_, i) => (
            <PostCard key={i} />
          ))}
        </div>

        <Skeleton className="mt-10 h-3 w-40" />
        <div className="mt-3 flex flex-col gap-3">
          {Array.from({ length: 3 }, (_, i) => (
            <PostCard key={i} />
          ))}
        </div>
      </div>
    </div>
  );
}
