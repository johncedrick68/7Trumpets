import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft, Box, CheckCircle2, Clock, CreditCard, Truck, User, XCircle } from "lucide-react";

import { getAdminAuthContext } from "@/lib/admin/auth";
import { settleCodPayment, transitionOrderStatus } from "@/lib/admin/actions";
import { formatMinorUnitsToPHP } from "@/lib/catalog/queries";
import { logServerError } from "@/lib/server-log";
import { createServiceClient } from "@/lib/supabase/server";

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Separator } from "@/components/ui/separator";

export const dynamic = "force-dynamic";

interface SearchParams {
  notice?: string;
  error?: string;
}

export default async function AdminOrderDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<SearchParams>;
}) {
  const adminCtx = await getAdminAuthContext();
  if (!adminCtx) {
    redirect("/login?next=/admin/orders");
  }

  const { id } = await params;
  const { notice, error } = await searchParams;
  const serviceClient = createServiceClient();

  // Fetch full order record
  const { data: order, error: orderError } = await serviceClient
    .from("orders")
    .select(`
      *,
      order_items (
        id,
        product_name,
        variant_name,
        sku,
        unit_price_minor,
        quantity,
        line_total_minor
      ),
      payments (
        id,
        method,
        status,
        amount_minor,
        paid_at
      ),
      order_status_history (
        id,
        from_status,
        to_status,
        note,
        source,
        created_at
      )
    `)
    .eq("id", id)
    .maybeSingle();

  if (orderError) {
    logServerError("admin.order.detail", "database_failure");
    throw new Error("ADMIN_ORDER_UNAVAILABLE");
  }
  if (!order) {
    notFound();
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const payment = (order.payments as any)?.[0];
  const history = order.order_status_history || [];
  // Sort history newest first
  history.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

  // Determine allowed forward transitions based on canonical order status machine
  const allowedTransitions: Array<{ to: string; label: string; destructive?: boolean }> = [];

  if (order.status === "CONFIRMED") {
    // Only allow PROCESSING if payment requirements are satisfied:
    // GCash must be PAID; COD can be UNPAID or PAID
    const canProcess = payment?.method === "COD" || (payment?.method === "MANUAL_GCASH" && payment?.status === "PAID");
    if (canProcess) {
      allowedTransitions.push({ to: "PROCESSING", label: "Start Processing" });
    }
    allowedTransitions.push({ to: "CANCELLED", label: "Cancel Order", destructive: true });
  } else if (order.status === "PROCESSING") {
    allowedTransitions.push({ to: "PACKING", label: "Mark Packing" });
    allowedTransitions.push({ to: "CANCELLED", label: "Cancel Order", destructive: true });
  } else if (order.status === "PACKING") {
    allowedTransitions.push({ to: "READY_FOR_SHIPMENT", label: "Ready for Shipment" });
    allowedTransitions.push({ to: "CANCELLED", label: "Cancel Order", destructive: true });
  } else if (order.status === "READY_FOR_SHIPMENT") {
    allowedTransitions.push({ to: "SHIPPED", label: "Mark Shipped" });
    allowedTransitions.push({ to: "CANCELLED", label: "Cancel Order", destructive: true });
  } else if (order.status === "SHIPPED") {
    allowedTransitions.push({ to: "IN_TRANSIT", label: "Mark In Transit" });
    allowedTransitions.push({ to: "DELIVERY_FAILED", label: "Delivery Failed", destructive: true });
  } else if (order.status === "IN_TRANSIT") {
    allowedTransitions.push({ to: "OUT_FOR_DELIVERY", label: "Out for Delivery" });
    allowedTransitions.push({ to: "DELIVERY_FAILED", label: "Delivery Failed", destructive: true });
  } else if (order.status === "OUT_FOR_DELIVERY") {
    allowedTransitions.push({ to: "DELIVERED", label: "Mark Delivered" });
    allowedTransitions.push({ to: "DELIVERY_FAILED", label: "Delivery Failed", destructive: true });
  } else if (order.status === "DELIVERED") {
    if (payment?.status === "PAID") {
      allowedTransitions.push({ to: "COMPLETED", label: "Complete Order" });
    }
  }

  return (
    <div className="space-y-8">
      <header>
        <Button asChild variant="ghost" size="sm" className="mb-4 -ml-3 text-muted-foreground">
          <Link href="/admin/orders">
            <ArrowLeft className="w-4 h-4 mr-2" /> Back to Orders
          </Link>
        </Button>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-extrabold tracking-tight mb-1">Order #{order.order_number}</h1>
            <p className="text-muted-foreground text-sm flex items-center gap-2">
              <Clock className="w-4 h-4" /> Placed {new Date(order.placed_at).toLocaleString()}
            </p>
          </div>
          <Badge variant={
            order.status === "COMPLETED" || order.status === "DELIVERED" ? "default" :
            order.status === "CANCELLED" || order.status === "DELIVERY_FAILED" ? "destructive" :
            "secondary"
          } className="text-sm px-3 py-1">
            {order.status.replace(/_/g, " ")}
          </Badge>
        </div>
      </header>

      {notice && (
        <div className="p-4 rounded-md bg-emerald-50 text-emerald-800 border border-emerald-200 dark:bg-emerald-950/30 dark:border-emerald-900/50 dark:text-emerald-400">
          {notice === "status_updated" && "Order status successfully updated."}
          {notice === "cod_settled" && "COD payment successfully settled as PAID."}
        </div>
      )}

      {error && (
        <div className="p-4 rounded-md bg-destructive/10 text-destructive border border-destructive/20">
          Error: {error}
        </div>
      )}

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-8 items-start">
        <div className="xl:col-span-2 space-y-8">
          {/* Order Transition Control Card */}
          <Card>
            <CardHeader>
              <CardTitle>Fulfillment Actions</CardTitle>
              <CardDescription>Advance the order through its lifecycle.</CardDescription>
            </CardHeader>
            <CardContent>
              {allowedTransitions.length > 0 ? (
                <div className="flex flex-wrap gap-3">
                  {allowedTransitions.map((t) => (
                    <form key={t.to} action={transitionOrderStatus}>
                      <input type="hidden" name="order_id" value={order.id} />
                      <input type="hidden" name="to_status" value={t.to} />
                      <Button
                        type="submit"
                        variant={t.destructive ? "destructive" : "default"}
                      >
                        {t.label}
                      </Button>
                    </form>
                  ))}
                </div>
              ) : (
                <div className="flex items-center gap-2 text-muted-foreground bg-muted/50 p-4 rounded-lg border border-border/50">
                  {order.status === "COMPLETED" || order.status === "DELIVERED" ? (
                    <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                  ) : order.status === "CANCELLED" || order.status === "DELIVERY_FAILED" ? (
                    <XCircle className="w-5 h-5 text-destructive" />
                  ) : (
                    <Box className="w-5 h-5" />
                  )}
                  This order is in a terminal state ({order.status}).
                </div>
              )}

              {/* COD Settlement action */}
              {payment?.method === "COD" && payment?.status === "UNPAID"
                && (order.status === "DELIVERED" || order.status === "COMPLETED") && (
                <div className="mt-8 pt-6 border-t">
                  <h3 className="text-sm font-semibold mb-1">COD Payment Settlement</h3>
                  <p className="text-sm text-muted-foreground mb-4">
                    Confirm that cash payment has been collected at doorstep.
                  </p>
                  <form action={settleCodPayment}>
                    <input type="hidden" name="payment_id" value={payment.id} />
                    <input type="hidden" name="order_id" value={order.id} />
                    <input type="hidden" name="reason" value="COD cash collected at delivery by courier/driver" />
                    <Button type="submit" variant="secondary">
                      Settle COD (Mark as PAID)
                    </Button>
                  </form>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Historical Items Snapshot */}
          <Card>
            <CardHeader>
              <CardTitle>Order Items</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="border rounded-md overflow-x-auto mb-6">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Item</TableHead>
                      <TableHead>SKU</TableHead>
                      <TableHead className="text-right">Price</TableHead>
                      <TableHead className="text-center">Qty</TableHead>
                      <TableHead className="text-right">Total</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {order.order_items.map((item) => (
                      <TableRow key={item.id}>
                        <TableCell>
                          <div className="font-medium">{item.product_name}</div>
                          {item.variant_name && <div className="text-xs text-muted-foreground">{item.variant_name}</div>}
                        </TableCell>
                        <TableCell className="font-mono text-xs">{item.sku}</TableCell>
                        <TableCell className="text-right">{formatMinorUnitsToPHP(item.unit_price_minor)}</TableCell>
                        <TableCell className="text-center">{item.quantity}</TableCell>
                        <TableCell className="text-right font-medium">{formatMinorUnitsToPHP(item.line_total_minor)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              <div className="w-full max-w-sm ml-auto space-y-2 text-sm">
                <div className="flex justify-between items-center text-muted-foreground">
                  <span>Subtotal</span>
                  <span className="font-medium text-foreground">{formatMinorUnitsToPHP(order.subtotal_minor)}</span>
                </div>
                <div className="flex justify-between items-center text-muted-foreground">
                  <span>Shipping</span>
                  <span className="font-medium text-foreground">{formatMinorUnitsToPHP(order.shipping_minor)}</span>
                </div>
                <Separator className="my-2" />
                <div className="flex justify-between items-center text-lg font-bold">
                  <span>Total</span>
                  <span>{formatMinorUnitsToPHP(order.total_minor)}</span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Status History */}
          <Card>
            <CardHeader>
              <CardTitle>Timeline</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="relative border-l border-muted ml-3 space-y-6">
                {history.map((h) => (
                  <div key={h.id} className="relative pl-6">
                    <div className="absolute w-3 h-3 bg-primary rounded-full -left-[6.5px] top-1.5 ring-4 ring-background" />
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 mb-1">
                      <strong className="text-sm">
                        {h.to_status} <span className="font-normal text-muted-foreground">{h.from_status && `(from ${h.from_status})`}</span>
                      </strong>
                      <span className="text-xs text-muted-foreground">
                        {new Date(h.created_at).toLocaleString()}
                      </span>
                    </div>
                    {h.note && <div className="text-sm text-muted-foreground mb-1">Note: {h.note}</div>}
                    <div className="text-xs text-muted-foreground font-mono">Source: {h.source}</div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-8">
          {/* Customer and Delivery Snapshot */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><User className="w-4 h-4" /> Customer Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div>
                <div className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Contact</div>
                <div className="font-medium">{order.recipient_name}</div>
                <div className="text-sm text-muted-foreground">{order.customer_email}</div>
                <div className="text-sm text-muted-foreground">{order.recipient_phone}</div>
              </div>

              <div>
                <div className="text-xs text-muted-foreground uppercase tracking-wider mb-1 flex items-center gap-1">
                  <Truck className="w-3 h-3" /> Delivery Address
                </div>
                <address className="not-italic text-sm space-y-1">
                  <div>{order.address_line1}</div>
                  {order.address_line2 && <div>{order.address_line2}</div>}
                  {order.barangay && <div>{order.barangay}</div>}
                  <div>{order.city_municipality}, {order.province} {order.postal_code}</div>
                  <div className="text-muted-foreground">{order.country_code}</div>
                </address>
              </div>

              {order.customer_note && (
                <div className="bg-muted/50 p-3 rounded-lg border border-border/50">
                  <div className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Delivery Note</div>
                  <p className="text-sm italic text-foreground/80">&ldquo;{order.customer_note}&rdquo;</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Payment Snapshot */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><CreditCard className="w-4 h-4" /> Payment Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {payment ? (
                <>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">Method</span>
                    <span className="font-medium text-sm">{payment.method === "MANUAL_GCASH" ? "Manual GCash" : "Cash on Delivery"}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">Status</span>
                    <Badge variant={payment.status === "PAID" ? "default" : "secondary"}>{payment.status}</Badge>
                  </div>
                  {payment.paid_at && (
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-muted-foreground">Paid At</span>
                      <span className="text-sm">{new Date(payment.paid_at).toLocaleString()}</span>
                    </div>
                  )}
                  {payment.method === "MANUAL_GCASH" && (
                    <Button asChild variant="outline" className="w-full mt-2" size="sm">
                      <Link href="/admin/payments">View GCash Queue</Link>
                    </Button>
                  )}
                </>
              ) : (
                <p className="text-sm text-muted-foreground text-center py-4">No payment record found.</p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
