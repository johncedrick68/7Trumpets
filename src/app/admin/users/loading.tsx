import { Skeleton } from "@/components/ui/skeleton";
import { AdminPageHeader } from "@/components/admin/admin-page-header";

export default function AdminUsersLoading() {
  return (
    <div className="space-y-8">
      <AdminPageHeader
        title="Staff & Team Governance"
        description="Super Administrator privilege management, role delegations, individual MFA lifecycle, and staff onboarding invitations."
      />

      <div className="space-y-3">
        <Skeleton className="h-6 w-48" />
        <div className="rounded-xl border border-border bg-card p-4 space-y-3">
          <Skeleton className="h-10 w-full" />
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-12 w-full" />
          ))}
        </div>
      </div>

      <div className="space-y-3">
        <Skeleton className="h-6 w-48" />
        <div className="rounded-xl border border-border bg-card p-4 space-y-3">
          <Skeleton className="h-10 w-full" />
          {Array.from({ length: 2 }).map((_, i) => (
            <Skeleton key={i} className="h-12 w-full" />
          ))}
        </div>
      </div>
    </div>
  );
}
