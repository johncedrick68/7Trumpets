import { Skeleton } from "@/components/ui/skeleton";
import { AdminPageHeader } from "@/components/admin/admin-page-header";

export default function AdminAuditLoading() {
  return (
    <div className="space-y-6">
      <AdminPageHeader
        eyebrow="System Governance"
        title="Audit Logs"
        description="Immutable append-only history for administrative, transactional, and security events."
      />

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between rounded-xl border border-border bg-card p-3 sm:p-4">
        <Skeleton className="h-9 w-full sm:w-72" />
        <Skeleton className="h-9 w-48" />
      </div>

      <div className="rounded-xl border border-border bg-card p-4 space-y-3">
        <Skeleton className="h-10 w-full" />
        {Array.from({ length: 8 }).map((_, i) => (
          <Skeleton key={i} className="h-12 w-full" />
        ))}
      </div>
    </div>
  );
}
