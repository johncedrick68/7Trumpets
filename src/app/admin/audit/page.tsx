import { redirect } from "next/navigation";

import { getAdminAuthContext } from "@/lib/admin/auth";
import { logServerError } from "@/lib/server-log";
import { createServiceClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function AdminAuditLogsPage() {
  const adminCtx = await getAdminAuthContext();
  if (!adminCtx) {
    redirect("/login?next=/admin/audit");
  }

  const serviceClient = createServiceClient();

  // Fetch recent audit logs
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
      created_at
    `)
    .order("created_at", { ascending: false })
    .limit(100);

  if (auditError) {
    logServerError("admin.audit", "database_failure");
    throw new Error("ADMIN_AUDIT_UNAVAILABLE");
  }
  const logList = auditLogs || [];

  return (
    <div className="admin-page">
      <header className="admin-page-header">
        <h1>Audit Logs</h1>
        <p className="subtle-text">Immutable append-only audit trail for administrative and transactional events.</p>
      </header>

      <div className="admin-card">
        <h2>Recent Audit Entries ({logList.length})</h2>

        {logList.length === 0 ? (
          <p className="subtle-text" style={{ padding: "1.5rem 0" }}>
            No audit log entries recorded.
          </p>
        ) : (
          <div className="admin-table-wrapper">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Timestamp</th>
                  <th>Action</th>
                  <th>Entity</th>
                  <th>Actor</th>
                  <th>Details</th>
                </tr>
              </thead>
              <tbody>
                {logList.map((log) => (
                  <tr key={log.id}>
                    <td>{new Date(log.created_at).toLocaleString()}</td>
                    <td>
                      <code><strong>{log.action}</strong></code>
                    </td>
                    <td>
                      <span>{log.entity}</span>
                      {log.entity_id && <div className="subtle-text small-text">{log.entity_id}</div>}
                    </td>
                    <td>
                      <div>{log.actor_role || "system"}</div>
                      {log.actor_id && <div className="subtle-text small-text">{log.actor_id}</div>}
                    </td>
                    <td>
                      <details className="small-text">
                        <summary style={{ cursor: "pointer" }}>View payload</summary>
                        <pre style={{ margin: "0.5rem 0", padding: "0.5rem", background: "var(--surface)", borderRadius: "4px", fontSize: "0.75rem" }}>
                          {JSON.stringify({ old: log.old_values, new: log.new_values }, null, 2)}
                        </pre>
                      </details>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
