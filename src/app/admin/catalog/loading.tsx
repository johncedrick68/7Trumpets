import { Skeleton } from "@/components/ui/skeleton";

export default function AdminCatalogLoading() {
  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div className="space-y-2">
          <Skeleton className="h-4 w-28" />
          <Skeleton className="h-9 w-60" />
          <Skeleton className="h-4 w-full max-w-96" />
        </div>
        <Skeleton className="h-10 w-36 rounded-md" />
      </div>

      {/* Catalog table skeleton */}
      <div className="border rounded-xl overflow-hidden bg-card">
        <div className="p-4 border-b flex justify-between items-center bg-muted/20">
          <Skeleton className="h-6 w-32" />
          <Skeleton className="h-4 w-24" />
        </div>
        <div className="p-4 space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="flex gap-4 items-center py-2 border-b last:border-0">
              <Skeleton className="size-12 rounded-md shrink-0" />
              <div className="space-y-1.5 flex-1">
                <Skeleton className="h-4 w-48" />
                <Skeleton className="h-3 w-24" />
              </div>
              <Skeleton className="h-6 w-20 rounded-full" />
              <Skeleton className="h-8 w-16 rounded-md" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
