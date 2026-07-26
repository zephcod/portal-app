import { Skeleton } from "@/components/ui/skeleton";

export default function PostDetailLoading() {
  return (
    <div className="mx-auto max-w-2xl">
      <Skeleton className="h-3 w-24" />

      <div className="mt-4 rounded-xl border border-line bg-white p-6 shadow-sm">
        <div className="flex items-center gap-2">
          <Skeleton className="h-4 w-20" />
          <Skeleton className="h-4 w-16 rounded-full" />
        </div>
        <Skeleton className="mt-3 h-3 w-48" />
        <Skeleton className="mt-4 h-72 w-full rounded-lg" />
        <div className="mt-4 space-y-2">
          <Skeleton className="h-3.5 w-full" />
          <Skeleton className="h-3.5 w-2/3" />
        </div>
        <div className="mt-6 flex gap-6 border-t border-line pt-4">
          <Skeleton className="h-3 w-12" />
          <Skeleton className="h-3 w-12" />
          <Skeleton className="h-3 w-12" />
        </div>
      </div>
    </div>
  );
}
