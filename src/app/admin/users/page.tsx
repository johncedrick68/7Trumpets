import { notFound } from "next/navigation";
import { CheckCircle2, ShieldAlert, Users, Mail, ShieldCheck, Clock, XCircle } from "lucide-react";

import { requireAdminAal2 } from "@/lib/admin/auth";
import { revokeStaffInvitation } from "@/lib/staff/actions";
import { logServerError } from "@/lib/server-log";
import { createClient, createServiceClient } from "@/lib/supabase/server";

import { AdminPageHeader } from "@/components/admin/admin-page-header";
import {
  AdminTableContainer,
  AdminTable,
  AdminTableHeader,
  AdminTableBody,
  AdminTableRow,
  AdminTableHead,
  AdminTableCell,
  AdminEmptyState,
} from "@/components/admin/admin-table";
import { StatusBadge } from "@/components/admin/status-badge";
import { Button } from "@/components/ui/button";
import { StaffInviteDialog, ResetMfaDialog } from "@/components/admin/staff-invite-dialog";
import { RoleRevokeDialog } from "@/components/admin/role-revoke-dialog";

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
  const adminCtx = await requireAdminAal2("/admin/users");

  // Super admin only access — preserve intentional 404 for ordinary admins
  if (adminCtx.role !== "super_admin") {
    notFound();
  }

  const { notice, error } = await searchParams;
  const supabase = await createClient();
  const serviceClient = createServiceClient();

  // 1. Fetch staff roles
  const { data: userRoles, error: rolesError } = await supabase.rpc("list_staff_roles");
  if (rolesError) {
    logServerError("admin.roles.list", "database_failure");
    throw new Error("ADMIN_ROLES_UNAVAILABLE");
  }
  const roleList = (userRoles || []) as Array<{ user_id: string; role: string; created_at: string }>;

  // Count active super admins to enforce last-super-admin protection
  const superAdminCount = roleList.filter(
    (r) => r.role === "super_admin"
  ).length;

  // 2. Fetch profiles for staff users
  const userIds = roleList.map((r) => r.user_id);
  const { data: profiles } = userIds.length > 0
    ? await supabase.from("profiles").select("id, display_name, phone").in("id", userIds)
    : { data: [] };
  const profileMap = new Map((profiles || []).map((p) => [p.id, p]));

  // 3. Fetch MFA factor status for each staff user
  const mfaMap = new Map<string, boolean>();
  for (const uid of userIds) {
    try {
      const { data: factors } = await serviceClient.auth.admin.mfa.listFactors({ userId: uid });
      const hasVerified = factors?.factors?.some((f) => f.status === "verified") ?? false;
      mfaMap.set(uid, hasVerified);
    } catch {
      mfaMap.set(uid, false);
    }
  }

  // 4. Fetch pending invitations
  const { data: invitations } = await supabase
    .from("staff_invitations")
    .select("*")
    .order("created_at", { ascending: false });
  const inviteList = (invitations || []) as Array<{
    id: string;
    email: string;
    full_name: string;
    requested_role: string;
    status: string;
    created_at: string;
    expires_at: string;
  }>;

  return (
    <div className="space-y-8">
      <AdminPageHeader
        title="Staff & Team Governance"
        description="Super Administrator privilege management, role delegations, individual MFA lifecycle, and staff onboarding invitations."
        actions={<StaffInviteDialog disabled={adminCtx.aal !== "aal2"} />}
      />

      {adminCtx.aal !== "aal2" && (
        <div
          role="alert"
          className="flex items-start gap-3 rounded-xl border border-destructive/30 bg-destructive/10 p-4 text-xs text-destructive"
        >
          <ShieldAlert className="size-4 shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold">AAL2 MFA Verification Required</p>
            <p className="mt-0.5 text-muted-foreground">
              Your current session level is <strong>{adminCtx.aal.toUpperCase()}</strong>. Role mutations and staff invitations strictly require active AAL2 re-authentication.
            </p>
          </div>
        </div>
      )}

      {notice && (
        <div
          role="status"
          className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-xs text-emerald-800 dark:border-emerald-900/60 dark:bg-emerald-950/20 dark:text-emerald-300"
        >
          <CheckCircle2 className="size-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
          <span className="font-medium">
            {notice === "role_updated" && "Role mutation completed and logged."}
            {notice === "invitation_sent" && "Staff onboarding invitation recorded and dispatched."}
            {notice === "invitation_revoked" && "Staff invitation was successfully revoked."}
            {notice === "mfa_reset_success" && "MFA factor reset successfully. Staff member must re-enroll upon sign-in."}
          </span>
        </div>
      )}

      {error && (
        <div
          role="alert"
          className="flex items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-xs text-rose-800 dark:border-rose-900/60 dark:bg-rose-950/20 dark:text-rose-300"
        >
          <XCircle className="size-4 shrink-0 text-rose-600 dark:text-rose-400" />
          <span className="font-medium">Error: {error}</span>
        </div>
      )}

      {/* ── Section 1: Active Staff Accounts ─────────────────────── */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-base font-bold text-foreground flex items-center gap-2">
              <Users className="size-4 text-muted-foreground" />
              Active Staff Accounts
              <span className="rounded-full bg-muted px-2 py-0.5 font-mono text-xs font-semibold text-muted-foreground">
                {roleList.length}
              </span>
            </h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              Authorized team members with operational permissions. MFA is mandatory on administrative surfaces.
            </p>
          </div>
        </div>

        <AdminTableContainer>
          <AdminTable>
            <AdminTableHeader>
              <AdminTableRow>
                <AdminTableHead className="w-[280px]">Staff Member</AdminTableHead>
                <AdminTableHead className="w-[160px]">Assigned Role</AdminTableHead>
                <AdminTableHead className="w-[180px]">MFA Security</AdminTableHead>
                <AdminTableHead className="w-[140px]">Assigned Date</AdminTableHead>
                <AdminTableHead className="text-right">Actions</AdminTableHead>
              </AdminTableRow>
            </AdminTableHeader>
            <AdminTableBody>
              {roleList.length === 0 ? (
                <AdminTableRow>
                  <AdminTableCell colSpan={5} className="p-0">
                    <AdminEmptyState
                      icon={Users}
                      title="No active staff accounts"
                      description="No administrative staff roles are currently assigned in PostgreSQL."
                    />
                  </AdminTableCell>
                </AdminTableRow>
              ) : (
                roleList.map((ur) => {
                  const prof = profileMap.get(ur.user_id);
                  const isMfaEnrolled = mfaMap.get(ur.user_id) ?? false;
                  const isLastSuperAdmin = ur.role === "super_admin" && superAdminCount <= 1;

                  return (
                    <AdminTableRow key={`${ur.user_id}-${ur.role}`}>
                      <AdminTableCell>
                        <div className="min-w-0">
                          <p className="font-semibold text-xs text-foreground">
                            {prof?.display_name || "Staff Member"}
                          </p>
                          <p className="font-mono text-[11px] text-muted-foreground truncate">
                            {ur.user_id}
                          </p>
                        </div>
                      </AdminTableCell>
                      <AdminTableCell>
                        <StatusBadge
                          variant={
                            ur.role === "super_admin"
                              ? "info"
                              : "neutral"
                          }
                          dot={false}
                        >
                          {ur.role.replace(/_/g, " ").toUpperCase()}
                        </StatusBadge>
                      </AdminTableCell>
                      <AdminTableCell>
                        {isMfaEnrolled ? (
                          <span className="inline-flex items-center gap-1.5 text-xs text-emerald-600 dark:text-emerald-400 font-medium">
                            <ShieldCheck className="size-3.5" />
                            <span>Enrolled (AAL2)</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 text-xs text-amber-600 dark:text-amber-400 font-medium">
                            <Clock className="size-3.5" />
                            <span>Pending Enrollment</span>
                          </span>
                        )}
                      </AdminTableCell>
                      <AdminTableCell className="font-mono text-xs text-muted-foreground whitespace-nowrap">
                        {new Date(ur.created_at).toLocaleDateString(undefined, {
                          month: "short",
                          day: "numeric",
                          year: "numeric",
                        })}
                      </AdminTableCell>
                      <AdminTableCell className="text-right">
                        <div className="flex items-center justify-end gap-2">
                          <ResetMfaDialog
                            userId={ur.user_id}
                            displayName={prof?.display_name || "Staff Member"}
                            disabled={adminCtx.aal !== "aal2"}
                          />
                          <RoleRevokeDialog
                            userId={ur.user_id}
                            displayName={prof?.display_name || "Staff Member"}
                            currentRole={ur.role}
                            disabled={adminCtx.aal !== "aal2"}
                            isLastSuperAdmin={isLastSuperAdmin}
                          />
                        </div>
                      </AdminTableCell>
                    </AdminTableRow>
                  );
                })
              )}
            </AdminTableBody>
          </AdminTable>
        </AdminTableContainer>
      </div>

      {/* ── Section 2: Pending Onboarding Invitations ───────────── */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-base font-bold text-foreground flex items-center gap-2">
              <Mail className="size-4 text-muted-foreground" />
              Pending Team Invitations
              <span className="rounded-full bg-muted px-2 py-0.5 font-mono text-xs font-semibold text-muted-foreground">
                {inviteList.length}
              </span>
            </h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              Secure onboarding invitation links sent to staff. Links expire in 7 days.
            </p>
          </div>
        </div>

        <AdminTableContainer>
          <AdminTable>
            <AdminTableHeader>
              <AdminTableRow>
                <AdminTableHead className="w-[280px]">Recipient</AdminTableHead>
                <AdminTableHead className="w-[160px]">Requested Role</AdminTableHead>
                <AdminTableHead className="w-[140px]">Status</AdminTableHead>
                <AdminTableHead className="w-[140px]">Sent Date</AdminTableHead>
                <AdminTableHead className="w-[140px]">Expires</AdminTableHead>
                <AdminTableHead className="text-right">Action</AdminTableHead>
              </AdminTableRow>
            </AdminTableHeader>
            <AdminTableBody>
              {inviteList.length === 0 ? (
                <AdminTableRow>
                  <AdminTableCell colSpan={6} className="p-0">
                    <AdminEmptyState
                      icon={Mail}
                      title="No pending invitations"
                      description="There are no active staff onboarding invitations currently awaiting acceptance."
                    />
                  </AdminTableCell>
                </AdminTableRow>
              ) : (
                inviteList.map((inv) => (
                  <AdminTableRow key={inv.id}>
                    <AdminTableCell>
                      <div className="min-w-0">
                        <p className="font-semibold text-xs text-foreground">{inv.full_name}</p>
                        <p className="font-mono text-[11px] text-muted-foreground truncate">{inv.email}</p>
                      </div>
                    </AdminTableCell>
                    <AdminTableCell>
                      <StatusBadge variant="neutral" dot={false}>
                        {inv.requested_role.replace(/_/g, " ").toUpperCase()}
                      </StatusBadge>
                    </AdminTableCell>
                    <AdminTableCell>
                      <StatusBadge
                        variant={
                          inv.status === "ACCEPTED"
                            ? "success"
                            : inv.status === "PENDING"
                            ? "warning"
                            : "danger"
                        }
                        dot
                      >
                        {inv.status}
                      </StatusBadge>
                    </AdminTableCell>
                    <AdminTableCell className="font-mono text-xs text-muted-foreground whitespace-nowrap">
                      {new Date(inv.created_at).toLocaleDateString(undefined, {
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                      })}
                    </AdminTableCell>
                    <AdminTableCell className="font-mono text-xs text-muted-foreground whitespace-nowrap">
                      {new Date(inv.expires_at).toLocaleDateString(undefined, {
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                      })}
                    </AdminTableCell>
                    <AdminTableCell className="text-right">
                      {inv.status === "PENDING" && (
                        <form action={revokeStaffInvitation}>
                          <input type="hidden" name="invitation_id" value={inv.id} />
                          <Button
                            type="submit"
                            variant="ghost"
                            size="sm"
                            disabled={adminCtx.aal !== "aal2"}
                            className="h-8 text-xs text-rose-600 hover:bg-rose-50 hover:text-rose-700 dark:text-rose-400 dark:hover:bg-rose-950/20"
                          >
                            Revoke
                          </Button>
                        </form>
                      )}
                    </AdminTableCell>
                  </AdminTableRow>
                ))
              )}
            </AdminTableBody>
          </AdminTable>
        </AdminTableContainer>
      </div>
    </div>
  );
}
