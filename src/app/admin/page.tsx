import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowRight, CheckCircle2, CreditCard, Package, Box, Users, AlertTriangle, Inbox } from "lucide-react";

import { getAdminAuthContext } from "@/lib/admin/auth";
import { logServerError } from "@/lib/server-log";
import { createServiceClient } from "@/lib/supabase/server";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export const dynamic = "force-dynamic";

export default async function AdminDashboardPage() {
  const adminCtx = await getAdminAuthContext();
  if (!adminCtx) {
    redirect("/login?next=/admin");
  }

  const serviceClient = createServiceClient();

  // Fetch all canonical operational metrics in parallel
  const [
    pendingGcashRes,
    confirmedOrdersRes,
    processingOrdersRes,
    readyOrdersRes,
    inTransitOrdersRes,
    failedDeliveryRes,
    completedOrdersRes,
    inventoryRes,
    recentAuditRes,
  ] = await Promise.all([
    serviceClient.from("payments").select("*", { count: "exact", head: true }).eq("method", "MANUAL_GCASH").eq("status", "SUBMITTED"),
    serviceClient.from("orders").select("*", { count: "exact", head: true }).eq("status", "CONFIRMED"),
    serviceClient.from("orders").select("*", { count: "exact", head: true }).in("status", ["PROCESSING", "PACKING"]),
    serviceClient.from("orders").select("*", { count: "exact", head: true }).eq("status", "READY_FOR_SHIPMENT"),
    serviceClient.from("orders").select("*", { count: "exact", head: true }).in("status", ["SHIPPED", "IN_TRANSIT", "OUT_FOR_DELIVERY"]),
    serviceClient.from("orders").select("*", { count: "exact", head: true }).eq("status", "DELIVERY_FAILED"),
    serviceClient.from("orders").select("*", { count: "exact", head: true }).in("status", ["DELIVERED", "COMPLETED"]),
    serviceClient.from("inventory").select("variant_id, on_hand, reserved, safety_stock"),
    serviceClient.from("audit_logs").select("id, action, entity, actor_role, created_at").order("created_at", { ascending: false }).limit(8),
  ]);

  if (
    pendingGcashRes.error || confirmedOrdersRes.error || processingOrdersRes.error ||
    readyOrdersRes.error || inTransitOrdersRes.error || failedDeliveryRes.error ||
    completedOrdersRes.error || inventoryRes.error || recentAuditRes.error
  ) {
    logServerError("admin.dashboard", "database_failure");
    throw new Error("ADMIN_DASHBOARD_UNAVAILABLE");
  }

  const pendingGcashCount = pendingGcashRes.count ?? 0;
  const confirmedCount = confirmedOrdersRes.count ?? 0;
  const processingCount = processingOrdersRes.count ?? 0;
  const readyCount = readyOrdersRes.count ?? 0;
  const inTransitCount = inTransitOrdersRes.count ?? 0;
  const deliveryFailedCount = failedDeliveryRes.count ?? 0;
  const completedCount = completedOrdersRes.count ?? 0;

  // Calculate low stock and out of stock
  let lowStockCount = 0;
  let outOfStockCount = 0;
  for (const inv of inventoryRes.data || []) {
    const available = inv.on_hand - inv.reserved;
    if (available <= 0) {
      outOfStockCount++;
    } else if (available <= inv.safety_stock) {
      lowStockCount++;
    }
  }

  const recentLogs = recentAuditRes.data || [];

  return (
    <div className="space-y-10">
      <header>
        <h1 className="text-3xl font-extrabold tracking-tight mb-2">Operations Dashboard</h1>
        <p className="text-muted-foreground text-sm max-w-2xl">
          Live database-backed queues and fulfillment pipelines for 1968 Clothing.
        </p>
      </header>

      {/* Primary Alert Queues */}
      <section aria-labelledby="urgent-queues-title">
        <h2 id="urgent-queues-title" className="text-lg font-bold mb-4 flex items-center gap-2">
          <AlertTriangle className="w-5 h-5 text-destructive" />
          Urgent Action Queues
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className={pendingGcashCount > 0 ? "border-amber-500/50 bg-amber-50/50 dark:bg-amber-950/20" : ""}>
            <CardHeader className="pb-2">
              <CardDescription className="font-mono text-xs uppercase tracking-wider">Pending GCash</CardDescription>
              <CardTitle className="text-3xl font-bold">{pendingGcashCount}</CardTitle>
            </CardHeader>
            <CardContent className="text-xs text-muted-foreground">Awaiting verification</CardContent>
            <CardFooter>
              <Button asChild variant="outline" className="w-full text-xs" size="sm">
                <Link href="/admin/payments">Review Queue <ArrowRight className="w-3 h-3 ml-2" /></Link>
              </Button>
            </CardFooter>
          </Card>

          <Card className={deliveryFailedCount > 0 ? "border-destructive/50 bg-destructive/5" : ""}>
            <CardHeader className="pb-2">
              <CardDescription className="font-mono text-xs uppercase tracking-wider">Delivery Failures</CardDescription>
              <CardTitle className="text-3xl font-bold">{deliveryFailedCount}</CardTitle>
            </CardHeader>
            <CardContent className="text-xs text-muted-foreground">Failed courier drops</CardContent>
            <CardFooter>
              <Button asChild variant="outline" className="w-full text-xs" size="sm">
                <Link href="/admin/orders?status=DELIVERY_FAILED">Investigate <ArrowRight className="w-3 h-3 ml-2" /></Link>
              </Button>
            </CardFooter>
          </Card>

          <Card className={outOfStockCount > 0 ? "border-destructive/50 bg-destructive/5" : ""}>
            <CardHeader className="pb-2">
              <CardDescription className="font-mono text-xs uppercase tracking-wider">Out of Stock</CardDescription>
              <CardTitle className="text-3xl font-bold">{outOfStockCount}</CardTitle>
            </CardHeader>
            <CardContent className="text-xs text-muted-foreground">Zero available units</CardContent>
            <CardFooter>
              <Button asChild variant="outline" className="w-full text-xs" size="sm">
                <Link href="/admin/catalog">Restock <ArrowRight className="w-3 h-3 ml-2" /></Link>
              </Button>
            </CardFooter>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardDescription className="font-mono text-xs uppercase tracking-wider">Low Stock</CardDescription>
              <CardTitle className="text-3xl font-bold">{lowStockCount}</CardTitle>
            </CardHeader>
            <CardContent className="text-xs text-muted-foreground">Below safety threshold</CardContent>
            <CardFooter>
              <Button asChild variant="outline" className="w-full text-xs" size="sm">
                <Link href="/admin/catalog">Check Stock <ArrowRight className="w-3 h-3 ml-2" /></Link>
              </Button>
            </CardFooter>
          </Card>
        </div>
      </section>

      {/* Fulfillment Pipeline Queues */}
      <section aria-labelledby="fulfillment-pipeline-title">
        <h2 id="fulfillment-pipeline-title" className="text-lg font-bold mb-4 flex items-center gap-2">
          <Package className="w-5 h-5 text-muted-foreground" />
          Fulfillment Pipeline
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardDescription className="font-mono text-[10px] uppercase tracking-wider">Confirmed</CardDescription>
              <CardTitle className="text-2xl font-bold">{confirmedCount}</CardTitle>
            </CardHeader>
            <CardFooter className="pt-2">
              <Button asChild variant="ghost" className="w-full text-xs h-8" size="sm">
                <Link href="/admin/orders?status=CONFIRMED">View <ArrowRight className="w-3 h-3 ml-2" /></Link>
              </Button>
            </CardFooter>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription className="font-mono text-[10px] uppercase tracking-wider">Processing</CardDescription>
              <CardTitle className="text-2xl font-bold">{processingCount}</CardTitle>
            </CardHeader>
            <CardFooter className="pt-2">
              <Button asChild variant="ghost" className="w-full text-xs h-8" size="sm">
                <Link href="/admin/orders?status=PROCESSING">View <ArrowRight className="w-3 h-3 ml-2" /></Link>
              </Button>
            </CardFooter>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription className="font-mono text-[10px] uppercase tracking-wider">Ready to Ship</CardDescription>
              <CardTitle className="text-2xl font-bold">{readyCount}</CardTitle>
            </CardHeader>
            <CardFooter className="pt-2">
              <Button asChild variant="ghost" className="w-full text-xs h-8" size="sm">
                <Link href="/admin/orders?status=READY_FOR_SHIPMENT">Dispatch <ArrowRight className="w-3 h-3 ml-2" /></Link>
              </Button>
            </CardFooter>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription className="font-mono text-[10px] uppercase tracking-wider">In Transit</CardDescription>
              <CardTitle className="text-2xl font-bold">{inTransitCount}</CardTitle>
            </CardHeader>
            <CardFooter className="pt-2">
              <Button asChild variant="ghost" className="w-full text-xs h-8" size="sm">
                <Link href="/admin/orders?status=IN_TRANSIT">Track <ArrowRight className="w-3 h-3 ml-2" /></Link>
              </Button>
            </CardFooter>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription className="font-mono text-[10px] uppercase tracking-wider">Completed</CardDescription>
              <CardTitle className="text-2xl font-bold">{completedCount}</CardTitle>
            </CardHeader>
            <CardFooter className="pt-2">
              <Button asChild variant="ghost" className="w-full text-xs h-8" size="sm">
                <Link href="/admin/orders?status=COMPLETED">History <ArrowRight className="w-3 h-3 ml-2" /></Link>
              </Button>
            </CardFooter>
          </Card>
        </div>
      </section>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
        {/* Recent Admin Activity Log */}
        <Card className="xl:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <div className="space-y-1">
              <CardTitle className="text-lg">Recent Activity</CardTitle>
              <CardDescription>Latest administrative actions across the system.</CardDescription>
            </div>
            <Button asChild variant="outline" size="sm" className="hidden sm:flex">
              <Link href="/admin/audit">Full Audit Log</Link>
            </Button>
          </CardHeader>
          <CardContent>
            {recentLogs.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground text-sm border border-dashed rounded-lg">
                No recent activity recorded.
              </div>
            ) : (
              <div className="overflow-x-auto rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Action</TableHead>
                      <TableHead>Entity</TableHead>
                      <TableHead>Role</TableHead>
                      <TableHead>Time</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {recentLogs.map((log) => (
                      <TableRow key={log.id}>
                        <TableCell className="font-mono text-xs">{log.action}</TableCell>
                        <TableCell className="text-sm truncate max-w-[150px]">{log.entity}</TableCell>
                        <TableCell>
                          <Badge variant="secondary" className="text-[10px] uppercase tracking-wider">
                            {log.actor_role || "system"}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                          {new Date(log.created_at).toLocaleTimeString()}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
            <Button asChild variant="outline" size="sm" className="w-full mt-4 sm:hidden">
              <Link href="/admin/audit">Full Audit Log</Link>
            </Button>
          </CardContent>
        </Card>

        {/* Shortcuts Card */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Quick Links</CardTitle>
            <CardDescription>Fast access to common operations.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <Button asChild variant="default" className="justify-start gap-3">
              <Link href="/admin/orders"><Inbox className="w-4 h-4" /> All Orders</Link>
            </Button>
            <Button asChild variant="default" className="justify-start gap-3">
              <Link href="/admin/payments"><CreditCard className="w-4 h-4" /> GCash Verification</Link>
            </Button>
            <Button asChild variant="outline" className="justify-start gap-3">
              <Link href="/admin/catalog"><Box className="w-4 h-4" /> Catalog Management</Link>
            </Button>
            <Button asChild variant="outline" className="justify-start gap-3">
              <Link href="/admin/audit"><CheckCircle2 className="w-4 h-4" /> Immutable Audit Logs</Link>
            </Button>
            {adminCtx.role === "super_admin" && (
              <Button asChild variant="outline" className="justify-start gap-3">
                <Link href="/admin/users"><Users className="w-4 h-4" /> Staff Roles & Access</Link>
              </Button>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
