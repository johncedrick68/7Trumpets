import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { 
  AlertTriangle, 
  ArrowLeft, 
  Box, 
  CheckCircle2, 
  Clock, 
  CreditCard, 
  ExternalLink, 
  RotateCcw, 
  Truck, 
  User, 
  XCircle,
  PackageCheck
} from "lucide-react";

import { getAdminAuthContext } from "@/lib/admin/auth";
import { settleCodPayment, transitionOrderStatus } from "@/lib/admin/actions";
import { createShipment } from "@/lib/fulfillment/actions";
import { formatMinorUnitsToPHP } from "@/lib/catalog/queries";
import { getCourierDisplayName, getCourierTrackingUrl } from "@/lib/orders/courier";
import { logServerError } from "@/lib/server-log";
import { createServiceClient } from "@/lib/supabase/server";
import { relationToOne } from "@/lib/data/relations";

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import {
  AdminTableContainer,
  AdminTable,
  AdminTableHeader,
  AdminTableBody,
  AdminTableRow,
  AdminTableHead,
  AdminTableCell,
} from "@/components/admin/admin-table";
import { StatusBadge, type StatusVariant } from "@/components/admin/status-badge";

export const dynamic = "force-dynamic";

interface SearchParams {
  notice?: string;
  error?: string;
}

function getFulfillmentStatusVariant(status: string): StatusVariant {
  switch (status) {
    case "COMPLETED":
    case "DELIVERED":
      return "success";
    case "CANCELLED":
    case "DELIVERY_FAILED":
      return "danger";
    case "READY_FOR_SHIPMENT":
      return "warning";
    case "CONFIRMED":
    case "PROCESSING":
    case "PACKING":
    case "SHIPPED":
    case "IN_TRANSIT":
    case "OUT_FOR_DELIVERY":
      return "info";
    default:
      return "neutral";
  }
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

  const [{ id }, { notice, error }] = await Promise.all([params, searchParams]);
  const serviceClient = createServiceClient();

  // Fetch full order record with related facts
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
      shipments (
        id,
        provider,
        tracking_number,
        tracking_url,
        carrier_notes,
        shipped_at,
        status
      ),
      order_status_history (
        id,
        from_status,
        to_status,
        note,
        source,
        created_at
      ),
      return_requests (
        id,
        type,
        status,
        reason,
        reason_details,
        requested_refund_minor,
        approved_refund_minor,
        admin_notes,
        created_at
      ),
      refunds (
        id,
        amount_minor,
        method,
        status,
        reference_number,
        reason,
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

  const payment = relationToOne(order.payments);
  const history = order.order_status_history || [];
  history.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

  // Determine allowed forward transitions based on canonical order status machine
  const allowedTransitions: Array<{ to: string; label: string; destructive?: boolean }> = [];

  if (order.status === "CONFIRMED") {
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
    <div className="space-y-6">
      {/* ── Breadcrumb & Top Navigation ── */}
      <div>
        <Button asChild variant="ghost" size="sm" className="mb-2 -ml-2.5 h-8 gap-1 text-xs text-muted-foreground hover:text-foreground">
          <Link href="/admin/orders">
            <ArrowLeft className="size-3.5" aria-hidden="true" />
            <span>Back to Orders Queue</span>
          </Link>
        </Button>

        {/* Structured Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-border">
          <div>
            <div className="flex items-center gap-2.5 flex-wrap">
              <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground font-mono">
                Order #{order.order_number}
              </h1>
              <StatusBadge variant={getFulfillmentStatusVariant(order.status)}>
                {order.status.replace(/_/g, " ")}
              </StatusBadge>
            </div>
            <div className="mt-1 flex items-center gap-3 text-xs text-muted-foreground flex-wrap">
              <span className="flex items-center gap-1">
                <Clock className="size-3" aria-hidden="true" />
                Placed {new Date(order.placed_at).toLocaleString("en-PH", {
                  month: "short",
                  day: "numeric",
                  year: "numeric",
                  hour: "numeric",
                  minute: "2-digit",
                })}
              </span>
              <span>·</span>
              <span className="font-mono uppercase">{order.sales_channel || "STOREFRONT"}</span>
              <span>·</span>
              <span>{order.fulfillment_method === "STORE_PICKUP" ? "Store Pickup" : "Courier Delivery"}</span>
            </div>
          </div>

          {/* Primary Quick Transition (if available) */}
          {allowedTransitions.length > 0 && !allowedTransitions[0].destructive && (
            <form action={transitionOrderStatus}>
              <input type="hidden" name="order_id" value={order.id} />
              <input type="hidden" name="to_status" value={allowedTransitions[0].to} />
              <Button type="submit" size="sm" className="h-9 font-semibold gap-1.5 shadow-xs">
                <span>{allowedTransitions[0].label}</span>
              </Button>
            </form>
          )}
        </div>
      </div>

      {/* Operational Notices */}
      {notice && (
        <div className="p-3.5 rounded-xl bg-emerald-500/10 text-emerald-800 border border-emerald-500/20 dark:bg-emerald-950/30 dark:border-emerald-900/50 dark:text-emerald-400 flex items-center gap-2 text-xs">
          <CheckCircle2 className="size-4 shrink-0" aria-hidden="true" />
          <span>
            {notice === "status_updated" && "Order status successfully updated in database."}
            {notice === "cod_settled" && "COD payment successfully settled as PAID."}
            {notice === "shipment_created" && "Shipment recorded and order advanced to SHIPPED."}
          </span>
        </div>
      )}

      {error && (
        <div className="p-3.5 rounded-xl bg-destructive/10 text-destructive border border-destructive/20 flex items-center gap-2 text-xs">
          <XCircle className="size-4 shrink-0" aria-hidden="true" />
          <span>Operation failed: {error}</span>
        </div>
      )}

      {/* ── 2-Column Responsive Operational Layout ── */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 items-start">
        {/* Left Column (Main: Items + Fulfillment Operations + Timeline) */}
        <div className="xl:col-span-2 space-y-6">
          {/* 1. Fulfillment Control Panel */}
          <Card className="border-border shadow-xs">
            <CardHeader className="pb-3 border-b border-border bg-muted/20">
              <CardTitle className="text-base font-semibold">Fulfillment Actions</CardTitle>
              <CardDescription className="text-xs">
                {order.fulfillment_method === "STORE_PICKUP"
                  ? "Manage counter pickup and handover for this order."
                  : "Advance the order through packaging, courier dispatch, and final delivery."}
              </CardDescription>
            </CardHeader>
            <CardContent className="p-5 space-y-5">
              {/* Status Transition Triggers */}
              {allowedTransitions.length > 0 && (
                <div className="space-y-2">
                  <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    Permitted State Transitions
                  </Label>
                  <div className="flex flex-wrap gap-2.5">
                    {allowedTransitions.map((t) => (
                      <form key={t.to} action={transitionOrderStatus}>
                        <input type="hidden" name="order_id" value={order.id} />
                        <input type="hidden" name="to_status" value={t.to} />
                        <Button
                          type="submit"
                          variant={t.destructive ? "destructive" : "outline"}
                          size="sm"
                          className="h-8 text-xs font-semibold"
                        >
                          {t.label}
                        </Button>
                      </form>
                    ))}
                  </div>
                </div>
              )}

              {/* Courier Shipment Dispatch Form */}
              {order.fulfillment_method !== "STORE_PICKUP"
                && ["CONFIRMED", "PROCESSING", "PACKING", "READY_FOR_SHIPMENT"].includes(order.status) && (
                <div className="p-4 bg-muted/30 border border-border rounded-xl space-y-3">
                  <div className="flex items-center gap-2">
                    <Truck className="size-4 text-primary" aria-hidden="true" />
                    <h4 className="font-semibold text-sm text-foreground">
                      Dispatch Courier Shipment
                    </h4>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Record courier provider and tracking reference. This automatically advances status to <strong>SHIPPED</strong>.
                  </p>
                  <form action={createShipment} className="space-y-3 pt-1">
                    <input type="hidden" name="order_id" value={order.id} />
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <Label htmlFor="courier_prov" className="text-xs font-semibold text-foreground">
                          Courier Carrier
                        </Label>
                        <select
                          id="courier_prov"
                          name="provider"
                          defaultValue="JNT"
                          className="w-full h-9 rounded-lg border border-input bg-background px-2.5 text-xs mt-1"
                        >
                          <option value="JNT">J&amp;T Express</option>
                          <option value="LBC">LBC Express</option>
                          <option value="GOGO">GoGo Xpress</option>
                          <option value="FLASH">Flash Express</option>
                          <option value="NINJAVAN">Ninja Van</option>
                          <option value="OTHER">Other / Self-Handled</option>
                        </select>
                      </div>
                      <div>
                        <Label htmlFor="tracking_num" className="text-xs font-semibold text-foreground">
                          Tracking / Waybill Number
                        </Label>
                        <Input
                          id="tracking_num"
                          name="tracking_number"
                          placeholder="e.g. 781293847291"
                          required
                          className="h-9 text-xs font-mono mt-1"
                        />
                      </div>
                    </div>
                    <div>
                      <Label htmlFor="carrier_notes" className="text-xs font-semibold text-foreground">
                        Carrier Notes / Dispatch Dispatcher
                      </Label>
                      <Input
                        id="carrier_notes"
                        name="carrier_notes"
                        placeholder="Rider name, pickup batch #, vehicle plate"
                        className="h-9 text-xs mt-1"
                      />
                    </div>
                    <Button type="submit" size="sm" className="h-9 font-semibold text-xs gap-1.5">
                      <Truck className="size-3.5" aria-hidden="true" />
                      <span>Record Dispatch &amp; Mark Shipped</span>
                    </Button>
                  </form>
                </div>
              )}

              {/* Counter Handover Form for Store Pickup */}
              {order.fulfillment_method === "STORE_PICKUP" && ["CONFIRMED", "PROCESSING", "PACKING", "READY_FOR_SHIPMENT"].includes(order.status) && (
                <div className="p-4 bg-muted/30 border border-border rounded-xl space-y-3">
                  <div className="flex items-center gap-2">
                    <PackageCheck className="size-4 text-emerald-600 dark:text-emerald-400" aria-hidden="true" />
                    <h4 className="font-semibold text-sm text-foreground">
                      Store Counter Handover
                    </h4>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Customer is at the retail counter to claim items. Verify recipient identity and mark complete.
                  </p>
                  <form action={transitionOrderStatus}>
                    <input type="hidden" name="order_id" value={order.id} />
                    <input type="hidden" name="to_status" value="DELIVERED" />
                    <input type="hidden" name="note" value="Items handed to customer at flagship store counter" />
                    <Button type="submit" size="sm" className="h-9 font-semibold text-xs gap-1.5">
                      <span>Confirm Counter Handover (Mark DELIVERED)</span>
                    </Button>
                  </form>
                </div>
              )}

              {/* Terminal Status Note */}
              {allowedTransitions.length === 0 && (
                <div className="flex items-center gap-2 text-muted-foreground bg-muted/40 p-3.5 rounded-xl border border-border text-xs">
                  {order.status === "COMPLETED" || order.status === "DELIVERED" ? (
                    <CheckCircle2 className="size-4 text-emerald-600 dark:text-emerald-400" />
                  ) : order.status === "CANCELLED" || order.status === "DELIVERY_FAILED" ? (
                    <XCircle className="size-4 text-rose-600 dark:text-rose-400" />
                  ) : (
                    <Box className="size-4" />
                  )}
                  <span>This order is in a terminal state ({order.status}).</span>
                </div>
              )}

              {/* COD Settlement action */}
              {payment?.method === "COD" && payment?.status === "UNPAID"
                && (order.status === "DELIVERED" || order.status === "COMPLETED") && (
                <div className="pt-4 border-t border-border">
                  <h3 className="text-sm font-semibold mb-1 text-foreground">COD Payment Settlement</h3>
                  <p className="text-xs text-muted-foreground mb-3">
                    Confirm that cash payment has been collected at doorstep.
                  </p>
                  <form action={settleCodPayment}>
                    <input type="hidden" name="payment_id" value={payment.id} />
                    <input type="hidden" name="order_id" value={order.id} />
                    <input type="hidden" name="reason" value="COD cash collected at delivery by courier/driver" />
                    <Button type="submit" variant="secondary" size="sm" className="h-8 text-xs font-semibold">
                      Settle COD (Mark as PAID)
                    </Button>
                  </form>
                </div>
              )}
            </CardContent>
          </Card>

          {/* 2. Order Items Snapshot */}
          <Card className="border-border shadow-xs">
            <CardHeader className="pb-3 border-b border-border bg-muted/20">
              <CardTitle className="text-base font-semibold">Order Items</CardTitle>
              <CardDescription className="text-xs">
                Historical snapshot of purchased items, prices, and quantities.
              </CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <AdminTableContainer className="border-0 rounded-none shadow-none">
                <AdminTable>
                  <AdminTableHeader>
                    <AdminTableRow>
                      <AdminTableHead align="left">Item</AdminTableHead>
                      <AdminTableHead align="left">SKU</AdminTableHead>
                      <AdminTableHead align="right">Unit Price</AdminTableHead>
                      <AdminTableHead align="right">Qty</AdminTableHead>
                      <AdminTableHead align="right">Line Total</AdminTableHead>
                    </AdminTableRow>
                  </AdminTableHeader>
                  <AdminTableBody>
                    {order.order_items.map((item: {
                      id: string;
                      product_name: string;
                      variant_name: string | null;
                      sku: string;
                      unit_price_minor: number;
                      quantity: number;
                      line_total_minor: number;
                    }) => (
                      <AdminTableRow key={item.id}>
                        <AdminTableCell align="left">
                          <p className="font-semibold text-sm text-foreground">{item.product_name}</p>
                          {item.variant_name && (
                            <p className="text-xs text-muted-foreground">{item.variant_name}</p>
                          )}
                        </AdminTableCell>
                        <AdminTableCell align="left">
                          <span className="font-mono text-xs text-muted-foreground">{item.sku}</span>
                        </AdminTableCell>
                        <AdminTableCell align="right">
                          <span className="tabular-nums font-mono text-xs text-foreground">
                            {formatMinorUnitsToPHP(item.unit_price_minor)}
                          </span>
                        </AdminTableCell>
                        <AdminTableCell align="right">
                          <span className="tabular-nums font-mono text-xs text-foreground">
                            {item.quantity}
                          </span>
                        </AdminTableCell>
                        <AdminTableCell align="right">
                          <span className="tabular-nums font-mono font-bold text-xs text-foreground">
                            {formatMinorUnitsToPHP(item.line_total_minor)}
                          </span>
                        </AdminTableCell>
                      </AdminTableRow>
                    ))}
                  </AdminTableBody>
                </AdminTable>
              </AdminTableContainer>

              {/* Financial Totals Breakdown */}
              <div className="p-5 border-t border-border flex justify-end">
                <div className="w-full max-w-xs space-y-2 text-xs">
                  <div className="flex justify-between items-center text-muted-foreground">
                    <span>Subtotal</span>
                    <span className="font-mono font-medium text-foreground">{formatMinorUnitsToPHP(order.subtotal_minor)}</span>
                  </div>
                  <div className="flex justify-between items-center text-muted-foreground">
                    <span>Shipping</span>
                    <span className="font-mono font-medium text-foreground">{formatMinorUnitsToPHP(order.shipping_minor)}</span>
                  </div>
                  <Separator className="my-1.5" />
                  <div className="flex justify-between items-center text-sm font-bold text-foreground">
                    <span>Total</span>
                    <span className="font-mono text-base font-extrabold">{formatMinorUnitsToPHP(order.total_minor)}</span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* 3. Status History Timeline */}
          <Card className="border-border shadow-xs">
            <CardHeader className="pb-3 border-b border-border bg-muted/20">
              <CardTitle className="text-base font-semibold">Timeline</CardTitle>
              <CardDescription className="text-xs">
                Audit history of state transitions and actor sources.
              </CardDescription>
            </CardHeader>
            <CardContent className="p-5">
              <div className="relative border-l border-border ml-3 space-y-5">
                {history.map((h: {
                  id: string;
                  from_status: string | null;
                  to_status: string;
                  note: string | null;
                  source: string;
                  created_at: string;
                }) => (
                  <div key={h.id} className="relative pl-6">
                    <div className="absolute size-2.5 bg-foreground rounded-full -left-[5px] top-1.5 ring-4 ring-card" />
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 mb-0.5">
                      <strong className="text-xs font-semibold text-foreground">
                        {h.to_status} {h.from_status && <span className="font-normal text-muted-foreground">(from {h.from_status})</span>}
                      </strong>
                      <span className="text-[11px] text-muted-foreground font-mono">
                        {new Date(h.created_at).toLocaleString("en-PH")}
                      </span>
                    </div>
                    {h.note && <p className="text-xs text-muted-foreground mt-0.5">Note: {h.note}</p>}
                    <p className="text-[10px] text-muted-foreground font-mono mt-0.5">Source: {h.source}</p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right Column (Side Panels: Customer + Payment + Shipment + Returns) */}
        <div className="space-y-6">
          {/* Customer & Delivery Snapshot */}
          <Card className="border-border shadow-xs">
            <CardHeader className="pb-3 border-b border-border bg-muted/20">
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <User className="size-4" aria-hidden="true" />
                <span>Customer Details</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4 space-y-4 text-xs">
              <div>
                <span className="font-semibold text-muted-foreground uppercase tracking-wider text-[10px] block mb-1">
                  Recipient Contact
                </span>
                <p className="font-semibold text-foreground text-sm">{order.recipient_name}</p>
                <p className="text-muted-foreground mt-0.5">{order.customer_email}</p>
                {order.recipient_phone && (
                  <p className="text-muted-foreground font-mono mt-0.5">{order.recipient_phone}</p>
                )}
              </div>

              <div>
                <span className="font-semibold text-muted-foreground uppercase tracking-wider text-[10px] block mb-1">
                  Delivery Address
                </span>
                <address className="not-italic text-foreground space-y-0.5">
                  <p>{order.address_line1}</p>
                  {order.address_line2 && <p>{order.address_line2}</p>}
                  {order.barangay && <p>{order.barangay}</p>}
                  <p>{order.city_municipality}, {order.province} {order.postal_code}</p>
                  <p className="text-muted-foreground text-[11px]">{order.country_code}</p>
                </address>
              </div>

              {order.customer_note && (
                <div className="bg-muted/40 p-3 rounded-lg border border-border">
                  <span className="font-semibold text-muted-foreground uppercase tracking-wider text-[10px] block mb-0.5">
                    Delivery Note
                  </span>
                  <p className="italic text-foreground">&ldquo;{order.customer_note}&rdquo;</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Payment Snapshot */}
          <Card className="border-border shadow-xs">
            <CardHeader className="pb-3 border-b border-border bg-muted/20">
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <CreditCard className="size-4" aria-hidden="true" />
                <span>Payment Details</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4 space-y-3 text-xs">
              {payment ? (
                <>
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">Method</span>
                    <span className="font-semibold text-foreground">
                      {payment.method === "MANUAL_GCASH" ? "Manual GCash" : "Cash on Delivery"}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">Status</span>
                    <StatusBadge variant={payment.status === "PAID" ? "success" : "neutral"} dot={false}>
                      {payment.status}
                    </StatusBadge>
                  </div>
                  {payment.paid_at && (
                    <div className="flex justify-between items-center">
                      <span className="text-muted-foreground">Paid At</span>
                      <span className="font-mono text-muted-foreground">
                        {new Date(payment.paid_at).toLocaleString("en-PH")}
                      </span>
                    </div>
                  )}
                  {payment.method === "MANUAL_GCASH" && (
                    <Button asChild variant="outline" className="w-full mt-1.5 h-8 text-xs font-semibold" size="sm">
                      <Link href="/admin/payments">View GCash Queue</Link>
                    </Button>
                  )}
                </>
              ) : (
                <div className="rounded-lg border border-rose-200 dark:border-rose-900 bg-rose-50/50 dark:bg-rose-950/20 p-3 text-rose-800 dark:text-rose-300 space-y-1">
                  <div className="flex items-center gap-1.5 font-bold text-xs">
                    <AlertTriangle className="size-4 text-rose-600 dark:text-rose-400" />
                    <span>Data Integrity Issue: Payment Missing</span>
                  </div>
                  <p className="text-[11px] leading-relaxed opacity-90">
                    No canonical payment record was found for this order. Check database consistency or transaction audit log.
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Shipment & Tracking Card */}
          {order.shipments && order.shipments.length > 0 && (
            <Card className="border-border shadow-xs">
              <CardHeader className="pb-3 border-b border-border bg-muted/20">
                <CardTitle className="text-base font-semibold flex items-center gap-2">
                  <Truck className="size-4" aria-hidden="true" />
                  <span>Shipment &amp; Tracking</span>
                </CardTitle>
                <CardDescription className="text-xs">
                  Courier dispatch records and official tracking references.
                </CardDescription>
              </CardHeader>
              <CardContent className="p-4 space-y-3">
                {order.shipments.map((s: {
                  id: string;
                  provider: string;
                  tracking_number: string | null;
                  tracking_url: string | null;
                  carrier_notes: string | null;
                  shipped_at: string | null;
                  status: string;
                }) => {
                  const trackingUrl = s.tracking_url || getCourierTrackingUrl(s.provider, s.tracking_number);
                  return (
                    <div key={s.id} className="p-3.5 rounded-xl border border-border bg-muted/20 space-y-2.5 text-xs">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-semibold text-foreground">
                          {getCourierDisplayName(s.provider)}
                        </span>
                        <StatusBadge variant="info" dot={false} className="text-[10px]">
                          {s.status}
                        </StatusBadge>
                      </div>
                      <div>
                        <span className="text-[10px] uppercase tracking-wider text-muted-foreground block">
                          Waybill / Tracking Number
                        </span>
                        <p className="font-mono font-bold text-sm text-foreground mt-0.5 select-all">
                          {s.tracking_number || "—"}
                        </p>
                      </div>
                      {s.carrier_notes && (
                        <div>
                          <span className="text-[10px] uppercase tracking-wider text-muted-foreground block">
                            Carrier Notes
                          </span>
                          <p className="text-foreground mt-0.5">{s.carrier_notes}</p>
                        </div>
                      )}
                      {s.shipped_at && (
                        <p className="text-[10px] font-mono text-muted-foreground">
                          Dispatched {new Date(s.shipped_at).toLocaleString("en-PH")}
                        </p>
                      )}
                      {trackingUrl && (
                        <Button asChild variant="outline" size="sm" className="w-full h-8 text-xs gap-1 mt-1">
                          <a href={trackingUrl} target="_blank" rel="noopener noreferrer">
                            <span>Track on Official Courier Portal</span>
                            <ExternalLink className="size-3" />
                          </a>
                        </Button>
                      )}
                    </div>
                  );
                })}
              </CardContent>
            </Card>
          )}

          {/* Returns & Refunds History Card */}
          {((order.return_requests && order.return_requests.length > 0) || (order.refunds && order.refunds.length > 0)) && (
            <Card className="border-border shadow-xs">
              <CardHeader className="pb-3 border-b border-border bg-muted/20">
                <CardTitle className="text-base font-semibold flex items-center gap-2">
                  <RotateCcw className="size-4" aria-hidden="true" />
                  <span>Returns &amp; Refunds</span>
                </CardTitle>
                <CardDescription className="text-xs">
                  Historical returns inspection and refund ledger entries.
                </CardDescription>
              </CardHeader>
              <CardContent className="p-4 space-y-3">
                {order.return_requests?.map((r: {
                  id: string;
                  type: string;
                  status: string;
                  reason: string;
                  reason_details: string | null;
                  requested_refund_minor: number;
                }) => (
                  <div key={r.id} className="p-3 rounded-lg border border-border bg-muted/20 text-xs space-y-1.5">
                    <div className="flex justify-between items-center">
                      <span className="font-mono text-[10px] uppercase text-muted-foreground">{r.type}</span>
                      <StatusBadge variant="neutral" dot={false} className="text-[10px]">
                        {r.status}
                      </StatusBadge>
                    </div>
                    <p className="font-semibold text-foreground">Reason: {r.reason.replace(/_/g, " ")}</p>
                    {r.reason_details && <p className="text-muted-foreground italic">&ldquo;{r.reason_details}&rdquo;</p>}
                    <p className="font-mono text-foreground font-bold">
                      Requested: {formatMinorUnitsToPHP(r.requested_refund_minor)}
                    </p>
                  </div>
                ))}
                {order.refunds?.map((rf: {
                  id: string;
                  amount_minor: number;
                  method: string;
                  reference_number: string | null;
                  created_at: string;
                }) => (
                  <div key={rf.id} className="p-3 rounded-lg border border-emerald-500/30 bg-emerald-500/10 text-xs space-y-1 text-emerald-900 dark:text-emerald-300">
                    <div className="flex justify-between items-center font-bold">
                      <span>Refund Processed ({rf.method})</span>
                      <span className="font-mono">{formatMinorUnitsToPHP(rf.amount_minor)}</span>
                    </div>
                    {rf.reference_number && <p className="font-mono text-[11px]">Ref: {rf.reference_number}</p>}
                    <p className="text-[10px] opacity-80">{new Date(rf.created_at).toLocaleString("en-PH")}</p>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
