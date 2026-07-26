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

export default function PostsLoading() {
  return (
    <div>
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
  );
}
