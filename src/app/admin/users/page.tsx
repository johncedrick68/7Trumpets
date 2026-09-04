import { notFound } from "next/navigation";
import { ShieldAlert, ShieldCheck, UserPlus, Users, XCircle, CheckCircle2 } from "lucide-react";

import { requireAdminAal2 } from "@/lib/admin/auth";
import { manageUserRole } from "@/lib/admin/actions";
import { logServerError } from "@/lib/server-log";
import { createClient } from "@/lib/supabase/server";

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

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
  const { data: userRoles, error: rolesError } = await supabase.rpc("list_staff_roles");
  if (rolesError) {
    logServerError("admin.roles.list", "database_failure");
    throw new Error("ADMIN_ROLES_UNAVAILABLE");
  }

  const roleList = userRoles || [];

  return (
    <div className="space-y-8">
      <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight mb-2">Staff & Role Management</h1>
          <p className="text-muted-foreground text-sm max-w-2xl">
            Privileged role assignment. STRICTLY requires <Badge variant="outline" className="font-mono">super_admin</Badge> role and active AAL2 authentication.
          </p>
        </div>
      </header>

      {adminCtx.aal !== "aal2" && (
        <Alert variant="destructive">
          <ShieldAlert className="h-4 w-4" />
          <AlertTitle>AAL2 MFA Verification Required</AlertTitle>
          <AlertDescription>
            Your current session is <strong>{adminCtx.aal.toUpperCase()}</strong>. Role mutations require active AAL2 (MFA) re-authentication.
          </AlertDescription>
        </Alert>
      )}

      {notice && (
        <div className="p-4 rounded-md bg-emerald-50 text-emerald-800 border border-emerald-200 dark:bg-emerald-950/30 dark:border-emerald-900/50 dark:text-emerald-400 flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4" />
          {notice === "role_updated" && "Role successfully assigned/revoked."}
        </div>
      )}

      {error && (
        <div className="p-4 rounded-md bg-destructive/10 text-destructive border border-destructive/20 flex items-center gap-2">
          <XCircle className="w-4 h-4" />
          Error: {error}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
        <div className="lg:col-span-1">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <UserPlus className="w-5 h-5" /> Assign Staff Role
              </CardTitle>
              <CardDescription>AAL2 Required</CardDescription>
            </CardHeader>
            <CardContent>
              <form action={manageUserRole} className="space-y-4">
                <input type="hidden" name="assign" value="true" />

                <div className="space-y-2">
                  <label htmlFor="target_user_id" className="text-sm font-medium">Target User UUID</label>
                  <Input
                    id="target_user_id"
                    type="text"
                    name="target_user_id"
                    placeholder="e.g. 00000000-0000-0000-0000-000000000000"
                    required
                    className="font-mono text-xs"
                  />
                </div>

                <div className="space-y-2">
                  <label htmlFor="target_role" className="text-sm font-medium">Role</label>
                  <select 
                    id="target_role" 
                    name="target_role" 
                    required
                    className="flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <option value="admin">Admin</option>
                    <option value="super_admin">Super Admin</option>
                  </select>
                </div>

                <Button
                  type="submit"
                  disabled={adminCtx.aal !== "aal2"}
                  className="w-full mt-2"
                >
                  <ShieldCheck className="w-4 h-4 mr-2" /> Assign Role
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>

        <div className="lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="w-5 h-5" /> Current Staff Roles
                <Badge variant="secondary" className="ml-2 font-mono">{roleList.length}</Badge>
              </CardTitle>
            </CardHeader>
            
            {roleList.length === 0 ? (
              <CardContent className="text-center py-12 text-muted-foreground border-t border-dashed">
                No staff roles assigned.
              </CardContent>
            ) : (
              <div className="border-t overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>User ID</TableHead>
                      <TableHead>Role</TableHead>
                      <TableHead>Assigned At</TableHead>
                      <TableHead className="text-right">Action</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {roleList.map((ur: { user_id: string; role: string; created_at: string }) => (
                      <TableRow key={`${ur.user_id}-${ur.role}`}>
                        <TableCell className="font-mono text-xs">{ur.user_id}</TableCell>
                        <TableCell>
                          <Badge variant={ur.role === "super_admin" ? "default" : "secondary"} className="uppercase text-[10px]">
                            {ur.role.replace("_", " ")}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                          {new Date(ur.created_at).toLocaleString()}
                        </TableCell>
                        <TableCell className="text-right">
                          <form action={manageUserRole}>
                            <input type="hidden" name="target_user_id" value={ur.user_id} />
                            <input type="hidden" name="target_role" value={ur.role} />
                            <input type="hidden" name="assign" value="false" />
                            <Button
                              type="submit"
                              variant="destructive"
                              size="sm"
                              disabled={adminCtx.aal !== "aal2"}
                            >
                              Revoke
                            </Button>
                          </form>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}
