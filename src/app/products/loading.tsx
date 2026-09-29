import { Skeleton } from "@/components/ui/skeleton";

export default function ProductsLoading() {
  return (
    <main className="store-container store-page min-h-screen space-y-8 animate-in fade-in duration-200">
      <header className="space-y-3">
        <Skeleton className="h-4 w-28" />
        <Skeleton className="h-10 w-72 md:w-96" />
        <Skeleton className="h-4 w-full max-w-xl" />
      </header>

      {/* Filter bar skeleton */}
      <div className="flex flex-col md:flex-row gap-4 justify-between items-start md:items-center">
        <div className="flex flex-wrap gap-2">
          <Skeleton className="h-10 w-20 rounded-full" />
          <Skeleton className="h-10 w-24 rounded-full" />
          <Skeleton className="h-10 w-28 rounded-full" />
          <Skeleton className="h-10 w-24 rounded-full" />
        </div>
        <Skeleton className="h-10 w-full md:w-72 rounded-md" />
      </div>

      {/* Grid of product card skeletons */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 md:gap-6">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="rounded-none border border-border overflow-hidden space-y-3 p-0">
            <Skeleton className="aspect-square w-full rounded-none" />
            <div className="space-y-2 p-3">
              <Skeleton className="h-4 w-3/4 rounded-none" />
              <Skeleton className="h-3 w-1/2 rounded-none" />
              <div className="flex justify-between items-center pt-2">
                <Skeleton className="h-4 w-20 rounded-none" />
                <Skeleton className="h-4 w-12 rounded-none" />
              </div>
            </div>
          </div>
        ))}
      </div>
    </main>
  );
}
