import { Skeleton } from "@/components/ui/skeleton";

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
    </div>
  );
}
