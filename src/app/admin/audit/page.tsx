import { redirect } from "next/navigation";
import { Activity, Search } from "lucide-react";

import { getAdminAuthContext } from "@/lib/admin/auth";
import { logServerError } from "@/lib/server-log";
import { createServiceClient } from "@/lib/supabase/server";

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";

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
    <div className="space-y-8">
      <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight mb-2">Audit Logs</h1>
          <p className="text-muted-foreground text-sm max-w-2xl">
            Immutable append-only audit trail for administrative and transactional events.
          </p>
        </div>
      </header>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="w-5 h-5" /> Recent Audit Entries
            <Badge variant="secondary" className="ml-2 font-mono">{logList.length}</Badge>
          </CardTitle>
          <CardDescription>Comprehensive history of system activities.</CardDescription>
        </CardHeader>
        
        {logList.length === 0 ? (
          <CardContent className="text-center py-12 text-muted-foreground border-t border-dashed">
            No audit log entries recorded.
          </CardContent>
        ) : (
          <div className="border-t overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[180px]">Timestamp</TableHead>
                  <TableHead>Action</TableHead>
                  <TableHead>Entity</TableHead>
                  <TableHead>Actor</TableHead>
                  <TableHead>Details</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {logList.map((log) => (
                  <TableRow key={log.id}>
                    <TableCell className="text-sm whitespace-nowrap text-muted-foreground">
                      {new Date(log.created_at).toLocaleString()}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="font-mono text-xs font-bold uppercase tracking-wider bg-muted/20">
                        {log.action}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="font-medium capitalize">{log.entity}</div>
                      {log.entity_id && <div className="text-[10px] text-muted-foreground font-mono">{log.entity_id}</div>}
                    </TableCell>
                    <TableCell>
                      <div className="text-sm">{log.actor_role || "system"}</div>
                      {log.actor_id && <div className="text-[10px] text-muted-foreground font-mono">{log.actor_id}</div>}
                    </TableCell>
                    <TableCell className="max-w-[300px]">
                      <details className="text-xs group">
                        <summary className="cursor-pointer font-medium text-primary hover:underline flex items-center gap-1">
                          <Search className="w-3 h-3" /> View payload
                        </summary>
                        <ScrollArea className="h-[120px] w-full rounded-md border bg-muted/30 p-2 mt-2">
                          <pre className="font-mono text-[10px] leading-relaxed">
                            {JSON.stringify({ old: log.old_values, new: log.new_values }, null, 2)}
                          </pre>
                        </ScrollArea>
                      </details>
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
