import { Skeleton } from "@/components/ui/skeleton";

export default function CartLoading() {
  return (
    <main className="transaction-container page-section min-h-screen space-y-8 animate-in fade-in duration-200">
      <header className="space-y-2">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-10 w-64" />
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Cart items column */}
        <div className="lg:col-span-8 space-y-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="grid grid-cols-[5rem_minmax(0,1fr)] items-center gap-4 rounded-xl border p-4 sm:grid-cols-[5rem_minmax(0,1fr)_auto]">
              <Skeleton className="row-span-2 size-20 rounded-lg" />
              <div className="min-w-0 space-y-2">
                <Skeleton className="h-5 w-48 max-w-full" />
                <Skeleton className="h-3 w-28 max-w-full" />
                <Skeleton className="h-4 w-20" />
              </div>
              <Skeleton className="col-start-2 h-9 w-24 max-w-full rounded-md sm:col-start-3 sm:row-start-1 sm:row-end-3" />
            </div>
          ))}
        </div>

        {/* Order summary column */}
        <div className="lg:col-span-4 border rounded-xl p-6 space-y-4">
          <Skeleton className="h-6 w-36" />
          <div className="space-y-3 pt-2">
            <div className="flex justify-between">
              <Skeleton className="h-4 w-20" />
              <Skeleton className="h-4 w-16" />
            </div>
            <div className="flex justify-between">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-4 w-16" />
            </div>
            <div className="flex justify-between pt-3 border-t">
              <Skeleton className="h-6 w-20" />
              <Skeleton className="h-6 w-24" />
            </div>
          </div>
          <Skeleton className="h-12 w-full rounded-md mt-4" />
        </div>
      </div>
    </main>
  );
}
