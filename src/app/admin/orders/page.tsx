import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowRight, Inbox, Filter } from "lucide-react";

import { getAdminAuthContext } from "@/lib/admin/auth";
import { formatMinorUnitsToPHP } from "@/lib/catalog/queries";
import { logServerError } from "@/lib/server-log";
import { createServiceClient } from "@/lib/supabase/server";

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export const dynamic = "force-dynamic";

interface SearchParams {
  status?: string;
}

export default async function AdminOrdersListPage({
  searchParams,
}: {
  searchParams?: Promise<SearchParams>;
}) {
  const adminCtx = await getAdminAuthContext();
  if (!adminCtx) {
    redirect("/login?next=/admin/orders");
  }

  const params = searchParams ? await searchParams : {};
  const statusFilter = params.status?.toUpperCase();

  const serviceClient = createServiceClient();

  let query = serviceClient
    .from("orders")
    .select(`
      id,
      order_number,
      customer_email,
      recipient_name,
      status,
      total_minor,
      placed_at,
      payments (
        method,
        status
      )
    `)
    .order("placed_at", { ascending: false })
    .limit(100);

  if (statusFilter) {
    if (statusFilter === "PROCESSING") {
      query = query.in("status", ["PROCESSING", "PACKING"]);
    } else if (statusFilter === "IN_TRANSIT") {
      query = query.in("status", ["SHIPPED", "IN_TRANSIT", "OUT_FOR_DELIVERY"]);
    } else if (statusFilter === "COMPLETED") {
      query = query.in("status", ["DELIVERED", "COMPLETED"]);
    } else {
      query = query.eq("status", statusFilter);
    }
  }

  const { data: orders, error: ordersError } = await query;

  if (ordersError) {
    logServerError("admin.orders.list", "database_failure");
    throw new Error("ADMIN_ORDERS_UNAVAILABLE");
  }
  const orderList = orders || [];
  const filterLabel = statusFilter ? statusFilter.replace(/_/g, " ").toLowerCase() : "all";

  return (
    <div className="space-y-8">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="font-mono text-xs font-bold uppercase tracking-widest text-muted-foreground">Operations</p>
          <h1 className="mt-1 text-3xl font-extrabold tracking-tight">Orders & Fulfillment</h1>
          <p className="text-muted-foreground text-sm max-w-2xl">
            Review the current queue, then open an order to make an authorized fulfillment change.
          </p>
        </div>
        <Badge variant="outline" className="w-fit font-mono text-xs">{orderList.length} shown</Badge>
      </header>

      <section aria-label="Order status filters" className="rounded-lg border border-border bg-card p-3">
        <div className="mb-2 flex items-center gap-2 text-sm font-medium"><Filter className="size-4 text-muted-foreground" aria-hidden="true" />Filter by fulfillment status</div>
        <div className="flex gap-2 overflow-x-auto pb-1">
        <Button asChild variant={!statusFilter ? "default" : "outline"} size="sm" className="h-10 shrink-0 rounded-full">
          <Link href="/admin/orders">All Orders</Link>
        </Button>
        <Button asChild variant={statusFilter === "CONFIRMED" ? "default" : "outline"} size="sm" className="h-10 shrink-0 rounded-full">
          <Link href="/admin/orders?status=CONFIRMED">Confirmed</Link>
        </Button>
        <Button asChild variant={statusFilter === "PROCESSING" ? "default" : "outline"} size="sm" className="h-10 shrink-0 rounded-full">
          <Link href="/admin/orders?status=PROCESSING">Processing / Packing</Link>
        </Button>
        <Button asChild variant={statusFilter === "READY_FOR_SHIPMENT" ? "default" : "outline"} size="sm" className="h-10 shrink-0 rounded-full">
          <Link href="/admin/orders?status=READY_FOR_SHIPMENT">Ready for Shipment</Link>
        </Button>
        <Button asChild variant={statusFilter === "IN_TRANSIT" ? "default" : "outline"} size="sm" className="h-10 shrink-0 rounded-full">
          <Link href="/admin/orders?status=IN_TRANSIT">In Transit / Out for Delivery</Link>
        </Button>
        <Button asChild variant={statusFilter === "DELIVERY_FAILED" ? "default" : "outline"} size="sm" className="h-10 shrink-0 rounded-full border-destructive/30 hover:bg-destructive/10">
          <Link href="/admin/orders?status=DELIVERY_FAILED">Delivery Failed</Link>
        </Button>
        <Button asChild variant={statusFilter === "COMPLETED" ? "default" : "outline"} size="sm" className="h-10 shrink-0 rounded-full">
          <Link href="/admin/orders?status=COMPLETED">Delivered / Completed</Link>
        </Button>
        </div>
      </section>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Inbox className="w-5 h-5" />
            {statusFilter ? `${statusFilter.replace(/_/g, " ")} Orders` : "All Orders"}
            <Badge variant="secondary" className="ml-2 font-mono">{orderList.length}</Badge>
          </CardTitle>
          <CardDescription>View and manage customer orders.</CardDescription>
        </CardHeader>
        
        {orderList.length === 0 ? (
          <CardContent className="border-t border-dashed py-12 text-center text-muted-foreground">
            <p>No {filterLabel} orders need attention right now.</p>
            {statusFilter && <Button asChild variant="link" className="mt-2"><Link href="/admin/orders">View all orders</Link></Button>}
          </CardContent>
        ) : (
          <>
          <div className="divide-y border-t md:hidden">
            {orderList.map((order) => {
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              const payment = (order.payments as any)?.[0];
              const statusVariant = order.status === "COMPLETED" || order.status === "DELIVERED" ? "default" : order.status === "CANCELLED" || order.status === "DELIVERY_FAILED" ? "destructive" : "outline";
              return <article key={order.id} className="space-y-4 p-4">
                <div className="flex items-start justify-between gap-3"><div><p className="font-mono text-xs text-muted-foreground">ORDER {order.order_number}</p><p className="mt-1 font-semibold">{order.recipient_name}</p><p className="text-sm text-muted-foreground">{order.customer_email}</p></div><Badge variant={statusVariant} className="max-w-36 whitespace-normal text-right text-[10px] uppercase">{order.status.replace(/_/g, " ")}</Badge></div>
                <div className="grid grid-cols-2 gap-3 border-y py-3 text-sm"><div><p className="text-xs text-muted-foreground">Payment</p><p className="font-medium">{payment?.method === "MANUAL_GCASH" ? "Manual GCash" : payment ? "Cash on Delivery" : "No payment"}</p><p className="text-xs text-muted-foreground">{payment?.status ?? "—"}</p></div><div><p className="text-xs text-muted-foreground">Total</p><p className="font-mono font-semibold">{formatMinorUnitsToPHP(order.total_minor)}</p><p className="text-xs text-muted-foreground">{new Date(order.placed_at).toLocaleDateString()}</p></div></div>
                <Button asChild className="w-full"><Link href={`/admin/orders/${order.id}`}>Open order <ArrowRight className="ml-2 size-4" aria-hidden="true" /></Link></Button>
              </article>;
            })}
          </div>
          <div className="hidden border-t md:block md:overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[120px]">Order #</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Customer</TableHead>
                  <TableHead>Payment</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                  <TableHead className="text-center w-[100px]">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {orderList.map((order) => {
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  const payment = (order.payments as any)?.[0];

                  return (
                    <TableRow key={order.id} className="group">
                      <TableCell className="font-mono font-medium">
                        {order.order_number}
                      </TableCell>
                      <TableCell className="text-muted-foreground text-sm whitespace-nowrap">
                        {new Date(order.placed_at).toLocaleDateString()}
                      </TableCell>
                      <TableCell>
                        <div className="font-medium">{order.recipient_name}</div>
                        <div className="text-xs text-muted-foreground">{order.customer_email}</div>
                      </TableCell>
                      <TableCell>
                        {payment ? (
                          <div className="flex items-center gap-2">
                            <span className="text-sm whitespace-nowrap">{payment.method === "MANUAL_GCASH" ? "Manual GCash" : "Cash on Delivery"}</span>
                            <Badge variant={payment.status === "PAID" ? "default" : "secondary"} className="text-[10px]">
                              {payment.status}
                            </Badge>
                          </div>
                        ) : (
                          <span className="text-muted-foreground text-sm italic">None</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge variant={
                          order.status === "COMPLETED" || order.status === "DELIVERED" ? "default" :
                          order.status === "CANCELLED" || order.status === "DELIVERY_FAILED" ? "destructive" :
                          "outline"
                        } className="capitalize whitespace-nowrap">
                          {order.status.replace(/_/g, " ").toLowerCase()}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right font-mono font-medium whitespace-nowrap">
                        {formatMinorUnitsToPHP(order.total_minor)}
                      </TableCell>
                      <TableCell className="text-center">
                        <Button asChild variant="ghost" size="icon" className="group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
                          <Link href={`/admin/orders/${order.id}`} aria-label={`Manage order ${order.order_number}`}>
                            <ArrowRight className="w-4 h-4" />
                          </Link>
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
          </>
        )}
      </Card>
    </div>
  );
}
