import { requireAdminAal2, getAdminAuthContext } from "@/lib/admin/auth";
import { logServerError } from "@/lib/server-log";
import { createServiceClient } from "@/lib/supabase/server";

import { AdminPageHeader } from "@/components/admin/admin-page-header";
import { AdminErrorState } from "@/components/admin/admin-table";
import { AuditWorkspace, type AuditLogEntry } from "@/components/admin/audit-workspace";

export const dynamic = "force-dynamic";

export default async function AdminAuditLogsPage() {
  await getAdminAuthContext();
  await requireAdminAal2("/admin/audit");

  const serviceClient = createServiceClient();

  // Fetch recent audit logs from immutable append-only table
  const { data: auditLogs, error: auditError } = await serviceClient
    .from("audit_logs")
    .select(`
      id,
      actor_id,
      actor_role,
      action,
      entity,
      entity_id,
      old_values,
      new_values,
      metadata,
      request_id,
      ip_address,
      user_agent,
      created_at
    `)
    .order("created_at", { ascending: false })
    .limit(100);

  if (auditError) {
    logServerError("admin.audit", "database_failure");
    return (
      <div className="space-y-6">
        <AdminPageHeader
          eyebrow="System Governance"
          title="Audit Logs"
          description="Immutable append-only history for administrative, transactional, and security events."
        />
        <div className="rounded-xl border border-border bg-card p-6">
          <AdminErrorState
            title="Audit Logs Unavailable"
            description="Unable to load operations history from PostgreSQL. Please verify database connectivity and permissions."
          />
        </div>
      </div>
    );
  }

  const logs = (auditLogs || []) as AuditLogEntry[];

  return (
    <div className="space-y-6">
      <AdminPageHeader
        eyebrow="System Governance"
        title="Audit Logs"
        description="Immutable append-only history for administrative, transactional, and security events."
      />

      <AuditWorkspace logs={logs} />
    </div>
  );
}
