import { notFound } from "next/navigation";
import { ShieldAlert, Users, XCircle, CheckCircle2, Mail, Clock, ShieldCheck } from "lucide-react";

import { requireAdminAal2 } from "@/lib/admin/auth";
import { manageUserRole } from "@/lib/admin/actions";
import { revokeStaffInvitation } from "@/lib/staff/actions";
import { logServerError } from "@/lib/server-log";
import { createClient, createServiceClient } from "@/lib/supabase/server";

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { StaffInviteDialog, ResetMfaDialog } from "@/components/admin/staff-invite-dialog";

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

  // Super admin only access
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
  const roleList = userRoles || [];

  // Count active super admins
  const superAdminCount = roleList.filter(
    (r: { role: string }) => r.role === "super_admin"
  ).length;

  // 2. Fetch profiles for staff users
  const userIds = roleList.map((r: { user_id: string }) => r.user_id);
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
  const inviteList = invitations || [];

  return (
    <div className="space-y-8">
      <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight mb-1">Staff & Onboarding Governance</h1>
          <p className="text-muted-foreground text-xs max-w-2xl">
            Super Administrator privilege management, team onboarding invitations, individual MFA lifecycle, and role assignments.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <StaffInviteDialog disabled={adminCtx.aal !== "aal2"} />
        </div>
      </header>

      {adminCtx.aal !== "aal2" && (
        <Alert variant="destructive">
          <ShieldAlert className="h-4 w-4" />
          <AlertTitle>AAL2 MFA Verification Required</AlertTitle>
          <AlertDescription className="text-xs">
            Your current session is <strong>{adminCtx.aal.toUpperCase()}</strong>. Role mutations and staff invitations strictly require active AAL2 re-authentication.
          </AlertDescription>
        </Alert>
      )}

      {notice && (
        <div className="p-3 rounded-md bg-emerald-50 text-emerald-800 border border-emerald-200 dark:bg-emerald-950/30 dark:border-emerald-900/50 dark:text-emerald-400 flex items-center gap-2 text-xs">
          <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
          <span>
            {notice === "role_updated" && "Role mutation completed and logged."}
            {notice === "invitation_sent" && "Staff onboarding invitation recorded and dispatched."}
            {notice === "invitation_revoked" && "Staff invitation was successfully revoked."}
            {notice === "mfa_reset_success" && "MFA factor reset successfully. Staff member must re-enroll upon sign-in."}
          </span>
        </div>
      )}

      {error && (
        <div className="p-3 rounded-md bg-destructive/10 text-destructive border border-destructive/20 flex items-center gap-2 text-xs">
          <XCircle className="w-4 h-4 flex-shrink-0" />
          <span>Error: {error}</span>
        </div>
      )}

      {/* Active Staff Table */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2 text-base">
                <Users className="w-4 h-4" /> Active Staff Accounts
                <Badge variant="secondary" className="font-mono text-xs">{roleList.length}</Badge>
              </CardTitle>
              <CardDescription className="text-xs mt-0.5">
                Staff members authorized for operational access. MFA is enforced on administrative routes.
              </CardDescription>
            </div>
          </div>
        </CardHeader>

        {roleList.length === 0 ? (
          <CardContent className="text-center py-10 text-xs text-muted-foreground border-t border-dashed">
            No active staff roles assigned.
          </CardContent>
        ) : (
          <div className="border-t overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="text-xs">
                  <TableHead>Staff Member</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>MFA Status</TableHead>
                  <TableHead>Assigned</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {roleList.map((ur: { user_id: string; role: string; created_at: string }) => {
                  const prof = profileMap.get(ur.user_id);
                  const isMfaEnrolled = mfaMap.get(ur.user_id) ?? false;
                  const isLastSuperAdmin = ur.role === "super_admin" && superAdminCount <= 1;

                  return (
                    <TableRow key={`${ur.user_id}-${ur.role}`} className="text-xs">
                      <TableCell>
                        <div className="font-medium">
                          {prof?.display_name || "Staff Member"}
                        </div>
                        <div className="font-mono text-[10px] text-muted-foreground">
                          {ur.user_id}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={ur.role === "super_admin" ? "default" : ur.role === "admin" ? "secondary" : "outline"}
                          className="uppercase text-[10px]"
                        >
                          {ur.role.replace("_", " ")}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {isMfaEnrolled ? (
                          <span className="inline-flex items-center gap-1 text-[11px] text-emerald-600 dark:text-emerald-400 font-medium">
                            <ShieldCheck className="w-3.5 h-3.5" /> Enrolled (AAL2)
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[11px] text-amber-600 dark:text-amber-400 font-medium">
                            <Clock className="w-3.5 h-3.5" /> Pending Enrollment
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="text-muted-foreground whitespace-nowrap text-[11px]">
                        {new Date(ur.created_at).toLocaleDateString()}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-2">
                          <ResetMfaDialog
                            userId={ur.user_id}
                            displayName={prof?.display_name || "Staff Member"}
                            disabled={adminCtx.aal !== "aal2"}
                          />

                          {isLastSuperAdmin ? (
                            <Badge variant="outline" className="text-[10px] text-muted-foreground border-dashed">
                              Protected
                            </Badge>
                          ) : (
                            <form action={manageUserRole}>
                              <input type="hidden" name="target_user_id" value={ur.user_id} />
                              <input type="hidden" name="target_role" value={ur.role} />
                              <input type="hidden" name="assign" value="false" />
                              <Button
                                type="submit"
                                variant="destructive"
                                size="sm"
                                disabled={adminCtx.aal !== "aal2"}
                                className="h-8 text-xs"
                              >
                                Revoke
                              </Button>
                            </form>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </Card>

      {/* Pending Invitations Table */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Mail className="w-4 h-4" /> Pending & Recent Invitations
            <Badge variant="secondary" className="font-mono text-xs">{inviteList.length}</Badge>
          </CardTitle>
          <CardDescription className="text-xs mt-0.5">
            Onboarding invitations sent to team members. Valid for 7 days from creation.
          </CardDescription>
        </CardHeader>

        {inviteList.length === 0 ? (
          <CardContent className="text-center py-8 text-xs text-muted-foreground border-t border-dashed">
            No invitations currently tracked.
          </CardContent>
        ) : (
          <div className="border-t overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="text-xs">
                  <TableHead>Recipient</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Sent At</TableHead>
                  <TableHead>Expires</TableHead>
                  <TableHead className="text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {inviteList.map((inv) => (
                  <TableRow key={inv.id} className="text-xs">
                    <TableCell>
                      <div className="font-medium">{inv.full_name}</div>
                      <div className="text-[11px] text-muted-foreground font-mono">{inv.email}</div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="uppercase text-[10px]">
                        {inv.requested_role.replace("_", " ")}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={
                          inv.status === "ACCEPTED" ? "default" :
                          inv.status === "PENDING" ? "secondary" :
                          inv.status === "REVOKED" ? "destructive" : "outline"
                        }
                        className="text-[10px]"
                      >
                        {inv.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground text-[11px]">
                      {new Date(inv.created_at).toLocaleDateString()}
                    </TableCell>
                    <TableCell className="text-muted-foreground text-[11px]">
                      {new Date(inv.expires_at).toLocaleDateString()}
                    </TableCell>
                    <TableCell className="text-right">
                      {inv.status === "PENDING" && (
                        <form action={revokeStaffInvitation}>
                          <input type="hidden" name="invitation_id" value={inv.id} />
                          <Button
                            type="submit"
                            variant="ghost"
                            size="sm"
                            disabled={adminCtx.aal !== "aal2"}
                            className="h-8 text-xs text-destructive hover:bg-destructive/10"
                          >
                            Revoke
                          </Button>
                        </form>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </Card>
    </div>
  );
}
