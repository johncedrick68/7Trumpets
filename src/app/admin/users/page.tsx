import { notFound, redirect } from "next/navigation";

import { getAdminAuthContext } from "@/lib/admin/auth";
import { manageUserRole } from "@/lib/admin/actions";
import { createServiceClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

interface SearchParams {
  notice?: string;
  error?: string;
}

export default async function AdminUsersPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const adminCtx = await getAdminAuthContext();
  if (!adminCtx) {
    redirect("/login?next=/admin/users");
  }

  // Super admin only access
  if (adminCtx.role !== "super_admin") {
    notFound();
  }

  const { notice, error } = await searchParams;
  const serviceClient = createServiceClient();

  // Fetch staff roles from private.user_roles via service client
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: userRoles } = await (serviceClient as any)
    .schema("private")
    .from("user_roles")
    .select("user_id, role, created_at, assigned_by")
    .order("created_at", { ascending: false });

  const roleList = userRoles || [];

  return (
    <div className="admin-page">
      <header className="admin-page-header">
        <h1>Staff & Role Management</h1>
        <p className="subtle-text">
          Privileged role assignment. STRICTLY requires super_admin role and active AAL2 authentication.
        </p>
      </header>

      {adminCtx.aal !== "aal2" && (
        <div className="error" role="alert" style={{ marginBottom: "1.5rem" }}>
          <strong>AAL2 MFA Verification Required: </strong>
          Your current session is {adminCtx.aal.toUpperCase()}. Role mutations require active AAL2 (MFA) re-authentication.
        </div>
      )}

      {notice && (
        <div className="notice" role="status" style={{ marginBottom: "1.5rem" }}>
          {notice === "role_updated" && "Role successfully assigned/revoked."}
        </div>
      )}

      {error && (
        <div className="error" role="alert" style={{ marginBottom: "1.5rem" }}>
          Error: {error}
        </div>
      )}

      <div className="admin-card">
        <h2>Assign Staff Role (AAL2 Required)</h2>
        <form action={manageUserRole} style={{ marginTop: "1rem", maxWidth: "500px" }}>
          <input type="hidden" name="assign" value="true" />

          <div>
            <label htmlFor="target_user_id">Target User UUID</label>
            <input
              id="target_user_id"
              type="text"
              name="target_user_id"
              placeholder="e.g. 00000000-0000-0000-0000-000000000000"
              required
            />
          </div>

          <div>
            <label htmlFor="target_role">Role</label>
            <select id="target_role" name="target_role" required>
              <option value="admin">Admin</option>
              <option value="super_admin">Super Admin</option>
            </select>
          </div>

          <button
            type="submit"
            className="btn btn-primary"
            disabled={adminCtx.aal !== "aal2"}
          >
            Assign Role
          </button>
        </form>
      </div>

      <div className="admin-card">
        <h2>Current Staff Roles ({roleList.length})</h2>

        {roleList.length === 0 ? (
          <p className="subtle-text" style={{ padding: "1.5rem 0" }}>
            No staff roles assigned.
          </p>
        ) : (
          <div className="admin-table-wrapper">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>User ID</th>
                  <th>Role</th>
                  <th>Assigned At</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {roleList.map((ur: { user_id: string; role: string; created_at: string }) => (
                  <tr key={`${ur.user_id}-${ur.role}`}>
                    <td><code>{ur.user_id}</code></td>
                    <td>
                      <span className={`status-pill status-${ur.role}`}>
                        {ur.role}
                      </span>
                    </td>
                    <td>{new Date(ur.created_at).toLocaleString()}</td>
                    <td>
                      <form action={manageUserRole}>
                        <input type="hidden" name="target_user_id" value={ur.user_id} />
                        <input type="hidden" name="target_role" value={ur.role} />
                        <input type="hidden" name="assign" value="false" />
                        <button
                          type="submit"
                          className="btn btn-secondary small-btn btn-danger-tone"
                          disabled={adminCtx.aal !== "aal2"}
                        >
                          Revoke Role
                        </button>
                      </form>
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
