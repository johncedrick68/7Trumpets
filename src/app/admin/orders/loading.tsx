import { Skeleton } from "@/components/ui/skeleton";

export default function AdminOrdersLoading() {
  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div className="space-y-2">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-9 w-60" />
          <Skeleton className="h-4 w-80" />
        </div>
        <Skeleton className="h-6 w-28" />
      </div>

      {/* Filter toolbar skeleton */}
      <div className="flex flex-col gap-3">
        <Skeleton className="h-11 w-full rounded-lg" />
        <div className="flex gap-2 overflow-x-auto pb-1">
          <Skeleton className="h-9 w-24 rounded-lg shrink-0" />
          <Skeleton className="h-9 w-24 rounded-lg shrink-0" />
          <Skeleton className="h-9 w-36 rounded-lg shrink-0" />
          <Skeleton className="h-9 w-36 rounded-lg shrink-0" />
          <Skeleton className="h-9 w-24 rounded-lg shrink-0" />
        </div>
      </div>

      {/* Orders table skeleton */}
      <div className="border rounded-xl overflow-hidden bg-card">
        <div className="p-4 border-b flex justify-between items-center bg-muted/20">
          <Skeleton className="h-6 w-32" />
          <Skeleton className="h-4 w-20" />
        </div>
        <div className="p-4 space-y-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-12 w-full rounded-md" />
          ))}
        </div>
      </div>
    </div>
  );
}
