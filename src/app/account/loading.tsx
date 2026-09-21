import { Skeleton } from "@/components/ui/skeleton";

export default function AccountLoading() {
  return (
    <main className="account-container page-section min-h-screen space-y-8 animate-in fade-in duration-200">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="space-y-2">
          <Skeleton className="h-4 w-28" />
          <Skeleton className="h-9 w-48" />
          <Skeleton className="h-4 w-60" />
        </div>
        <Skeleton className="h-10 w-28 rounded-md" />
      </div>

      {/* Tabs navigation skeleton */}
      <div className="flex gap-2 border-b pb-2">
        <Skeleton className="h-9 w-24 rounded-md" />
        <Skeleton className="h-9 w-24 rounded-md" />
        <Skeleton className="h-9 w-24 rounded-md" />
      </div>

      {/* Profile form card skeleton */}
      <div className="border rounded-xl p-6 space-y-6 max-w-2xl">
        <div className="space-y-2">
          <Skeleton className="h-6 w-36" />
          <Skeleton className="h-4 w-64" />
        </div>
        <div className="space-y-4">
          <div className="space-y-2">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-10 w-full rounded-md" />
          </div>
          <div className="space-y-2">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-10 w-full rounded-md" />
          </div>
          <Skeleton className="h-10 w-32 rounded-md" />
        </div>
      </div>
    </main>
  );
}
