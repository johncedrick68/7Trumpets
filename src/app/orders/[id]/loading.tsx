import { Skeleton } from "@/components/ui/skeleton";

export default function OrderDetailLoading() {
  return (
    <main className="account-container page-section min-h-screen space-y-6 animate-in fade-in duration-200">
      <Skeleton className="h-4 w-32" />
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-2">
          <Skeleton className="h-9 w-64" />
          <Skeleton className="h-4 w-40" />
        </div>
        <Skeleton className="h-7 w-28 rounded-full" />
      </div>

      {/* Progress timeline skeleton */}
      <div className="p-6 border rounded-xl space-y-4">
        <Skeleton className="h-5 w-44" />
        <Skeleton className="h-12 w-full rounded-lg" />
      </div>

      {/* Details skeleton */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="p-6 border rounded-xl space-y-3">
          <Skeleton className="h-5 w-32" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-3/4" />
        </div>
        <div className="p-6 border rounded-xl space-y-3">
          <Skeleton className="h-5 w-32" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-2/3" />
        </div>
      </div>
    </main>
  );
}
