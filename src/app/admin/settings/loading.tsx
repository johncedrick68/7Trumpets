import { Skeleton } from "@/components/ui/skeleton";
import { AdminPageHeader } from "@/components/admin/admin-page-header";

export default function AdminSettingsLoading() {
  return (
    <div className="space-y-8 max-w-4xl">
      <AdminPageHeader
        eyebrow="System Configuration"
        title="Store Configuration"
        description="Authoritative business rules, storefront content, fulfillment rates, and payment methods."
      />

      {Array.from({ length: 3 }).map((_, i) => (
        <div key={i} className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <div className="space-y-2">
            <Skeleton className="h-5 w-32" />
            <Skeleton className="h-4 w-48" />
          </div>
          <div className="rounded-xl border border-border bg-card p-5 space-y-4 lg:col-span-2">
            <Skeleton className="h-9 w-full" />
            <Skeleton className="h-9 w-full" />
            <div className="flex justify-end pt-2">
              <Skeleton className="h-8 w-28" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
