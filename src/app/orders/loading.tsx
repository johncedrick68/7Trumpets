import { Skeleton } from "@/components/ui/skeleton";

export default function OrdersLoading() {
  return (
    <main className="account-container page-section min-h-screen space-y-6 animate-in fade-in duration-200">
      <header className="space-y-2">
        <Skeleton className="h-4 w-28" />
        <Skeleton className="h-9 w-48" />
      </header>

      {/* Tabs navigation skeleton */}
      <div className="flex gap-2 border-b pb-2">
        <Skeleton className="h-9 w-24 rounded-md" />
        <Skeleton className="h-9 w-24 rounded-md" />
        <Skeleton className="h-9 w-24 rounded-md" />
      </div>

      {/* Order history list skeleton */}
      <div className="space-y-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="p-5 border rounded-xl space-y-4">
            <div className="flex justify-between items-start">
              <div className="space-y-1.5">
                <Skeleton className="h-5 w-36" />
                <Skeleton className="h-4 w-24" />
              </div>
              <Skeleton className="h-6 w-24 rounded-full" />
            </div>
            <div className="flex justify-between items-center pt-2 border-t">
              <Skeleton className="h-6 w-28" />
              <Skeleton className="h-9 w-32 rounded-md" />
            </div>
          </div>
        ))}
      </div>
    </main>
  );
}
