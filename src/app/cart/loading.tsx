import { Skeleton } from "@/components/ui/skeleton";

export default function CartLoading() {
  return (
    <main className="store-container cart-page min-h-screen py-8 md:py-12 animate-in fade-in duration-200">
      <div className="w-full">
        {/* Header Skeleton */}
        <header className="mb-8 md:mb-10 space-y-2">
          <Skeleton className="h-3 w-24 rounded-none" />
          <Skeleton className="h-9 w-48 rounded-none sm:w-64" />
        </header>

        {/* 2-Column Grid */}
        <div className="grid grid-cols-1 items-start gap-8 lg:grid-cols-12 lg:gap-12">
          {/* Cart Items Column */}
          <div className="lg:col-span-7 xl:col-span-8 space-y-4">
            <div className="divide-y divide-border border-y border-border">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="flex flex-col gap-4 py-6 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex items-start gap-4">
                    <Skeleton className="h-32 w-24 sm:w-28 shrink-0 rounded-none aspect-[4/5]" />
                    <div className="space-y-2 min-w-0">
                      <Skeleton className="h-5 w-44 rounded-none" />
                      <Skeleton className="h-3 w-24 rounded-none" />
                      <Skeleton className="h-4 w-20 rounded-none" />
                    </div>
                  </div>
                  <div className="flex items-center justify-between gap-4 sm:justify-end">
                    <Skeleton className="h-11 w-32 rounded-none" />
                    <Skeleton className="h-6 w-20 rounded-none" />
                    <Skeleton className="h-11 w-16 rounded-none" />
                  </div>
                </div>
              ))}
            </div>
            <div className="pt-4">
              <Skeleton className="h-4 w-36 rounded-none" />
            </div>
          </div>

          {/* Summary Column */}
          <aside className="lg:sticky lg:top-24 lg:col-span-5 xl:col-span-4" aria-label="Loading summary">
            <div className="border border-border bg-card p-6 rounded-none space-y-6">
              <Skeleton className="h-5 w-28 rounded-none" />
              <div className="space-y-3 border-y border-border py-4">
                <div className="flex justify-between">
                  <Skeleton className="h-4 w-20 rounded-none" />
                  <Skeleton className="h-4 w-16 rounded-none" />
                </div>
                <div className="flex justify-between">
                  <Skeleton className="h-4 w-24 rounded-none" />
                  <Skeleton className="h-4 w-32 rounded-none" />
                </div>
              </div>
              <div className="flex justify-between items-baseline pt-2">
                <Skeleton className="h-6 w-28 rounded-none" />
                <Skeleton className="h-8 w-24 rounded-none" />
              </div>
              <Skeleton className="h-12 w-full rounded-none" />
            </div>
          </aside>
        </div>
      </div>
    </main>
  );
}
