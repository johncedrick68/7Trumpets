import { Skeleton } from "@/components/ui/skeleton";

export default function AdminPosLoading() {
  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div className="space-y-2">
          <Skeleton className="h-4 w-28" />
          <Skeleton className="h-9 w-60" />
          <Skeleton className="h-4 w-full max-w-96" />
        </div>
        <Skeleton className="h-6 w-32" />
      </div>

      {/* POS split terminal skeleton */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 min-h-[650px]">
        {/* Catalog grid skeleton */}
        <div className="lg:col-span-8 border rounded-xl p-4 space-y-4 bg-card">
          <div className="flex gap-3">
            <Skeleton className="h-11 flex-1 rounded-md" />
            <Skeleton className="h-11 w-32 rounded-md" />
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="p-3 border rounded-lg space-y-2">
                <Skeleton className="aspect-square w-full rounded-md" />
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-4 w-1/2" />
              </div>
            ))}
          </div>
        </div>

        {/* Register sale panel skeleton */}
        <div className="lg:col-span-4 border rounded-xl p-5 space-y-4 bg-card">
          <div className="flex justify-between items-center pb-3 border-b">
            <Skeleton className="h-6 w-28" />
            <Skeleton className="h-4 w-16" />
          </div>
          <div className="space-y-3 py-6">
            <Skeleton className="h-12 w-full rounded-lg" />
            <Skeleton className="h-12 w-full rounded-lg" />
          </div>
          <div className="space-y-2 pt-4 border-t">
            <div className="flex justify-between">
              <Skeleton className="h-4 w-20" />
              <Skeleton className="h-4 w-16" />
            </div>
            <div className="flex justify-between">
              <Skeleton className="h-6 w-24" />
              <Skeleton className="h-6 w-24" />
            </div>
          </div>
          <Skeleton className="h-12 w-full rounded-md mt-4" />
        </div>
      </div>
    </div>
  );
}
