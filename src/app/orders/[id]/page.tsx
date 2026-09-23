import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { formatMinorUnitsToPHP } from "@/lib/catalog/queries";
import { deriveCustomerFulfillmentStage } from "@/lib/orders/status";
import { getCourierDisplayName } from "@/lib/orders/courier";
import { logServerError } from "@/lib/server-log";
import { getReceiptSignedUrl, submitGcashProof } from "@/lib/payments/actions";
import { createClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { GcashPaymentPanel } from "@/components/gcash-payment-panel";
import { ReturnRequestDialog } from "@/components/return-request-dialog";
import { CancelOrderDialog } from "@/components/cancel-order-dialog";
import { ExternalLink, Store, Truck, MessageSquare } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function OrderConfirmationPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ notice?: string; error?: string }>;
}) {
  void submitGcashProof;
  const [{ id }, search] = await Promise.all([params, searchParams]);

  const supabase = await createClient();
  const { data: claimsData } = await supabase.auth.getClaims();
  const userId = claimsData?.claims?.sub;
  if (!userId) {
    redirect("/login?next=/orders/" + id);
  }

  // 1. Fetch order owned by user
  const { data: order, error: orderError } = await supabase
    .from("orders")
    .select("*")
    .eq("id", id)
    .eq("user_id", userId)
    .maybeSingle();

  if (orderError) {
    logServerError("order.detail", "database_failure");
    throw new Error("ORDER_UNAVAILABLE");
  }
  if (!order) {
    notFound();
  }

  // 2. Fetch order items, payment, active reservations, shipment, and returns
  const [itemsRes, paymentRes, reservationsRes, shipmentRes, returnRequestsRes] = await Promise.all([
    supabase
      .from("order_items")
      .select("*")
      .eq("order_id", order.id)
      .order("created_at", { ascending: true }),
    supabase
      .from("payments")
      .select("*")
      .eq("order_id", order.id)
      .single(),
    supabase
      .from("inventory_reservations")
      .select("expires_at, status")
      .eq("order_id", order.id)
      .eq("status", "active")
      .order("expires_at", { ascending: true })
      .limit(1),
    supabase
      .from("shipments")
      .select("*")
      .eq("order_id", order.id)
      .order("created_at", { ascending: false })
      .maybeSingle(),
    supabase
      .from("return_requests")
      .select("*")
      .eq("order_id", order.id)
      .order("created_at", { ascending: false }),
  ]);

  const items = itemsRes.data || [];
  const payment = paymentRes.data;
  const activeReservation = reservationsRes.data?.[0];
  const shipment = shipmentRes.data;
  const returnRequests = returnRequestsRes.data || [];

  if (itemsRes.error || paymentRes.error) {
    logServerError("order.detail_relations", "database_failure");
    throw new Error("ORDER_UNAVAILABLE");
  }

  // 3. Fetch GCash proof submissions
  let submissions: Array<{
    id: string;
    claimed_amount_minor: number;
    reference_number: string | null;
    receipt_storage_path: string;
    created_at: string;
  }> = [];

  if (payment) {
    const { data: subData, error: submissionsError } = await supabase
      .from("payment_submissions")
      .select("id, claimed_amount_minor, reference_number, receipt_storage_path, created_at")
      .eq("payment_id", payment.id)
      .order("created_at", { ascending: false });
    if (submissionsError) {
      logServerError("order.submissions", "database_failure");
      throw new Error("ORDER_UNAVAILABLE");
    }
    submissions = subData || [];
  }

  const latestSubmission = submissions[0];
  const latestSignedUrl = latestSubmission
    ? await getReceiptSignedUrl(latestSubmission.receipt_storage_path)
    : null;

  const stageInfo = deriveCustomerFulfillmentStage(
    order.status,
    order.fulfillment_method === "STORE_PICKUP" ? "STORE_PICKUP" : "SHIPMENT"
  );

  const canSubmitProof =
    payment?.method === "MANUAL_GCASH" &&
    order.status === "CONFIRMED" &&
    (payment.status === "UNPAID" || payment.status === "REJECTED");

  return (
    <main id="main-content" className="account-container page-section min-h-screen">
      <div className="w-full">
        {/* Breadcrumb */}
        <nav aria-label="Breadcrumb" className="flex items-center gap-2 font-mono text-[11px] text-muted-foreground uppercase tracking-widest mb-8">
          <Link href="/orders" className="hover:text-foreground transition-colors">Orders</Link>
          <span>/</span>
          <span className="text-foreground font-bold">#{order.order_number}</span>
        </nav>

        {/* Page header */}
        <header className="mb-8 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <p className="text-xs font-mono font-bold tracking-widest text-muted-foreground uppercase">
              Order Details
            </p>
            <h1 className="text-3xl md:text-5xl font-extrabold tracking-tight mt-1 mb-2">
              Order #{order.order_number}
            </h1>
            <p className="text-sm font-mono text-muted-foreground">
              Placed on{" "}
              {new Date(order.placed_at).toLocaleDateString("en-PH", {
                year: "numeric",
                month: "long",
                day: "numeric",
                hour: "2-digit",
                minute: "2-digit",
              })}
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Link
              href={`/account/support?order_id=${order.id}&category=ORDER_STATUS`}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-md border border-input bg-card hover:bg-muted text-foreground transition-colors shadow-xs"
            >
              <MessageSquare className="w-3.5 h-3.5 text-primary" />
              Need Help with this Order?
            </Link>
          </div>
        </header>

        {/* Flash notices */}
        {search.notice === "proof_submitted" && (
          <div className="p-4 text-sm text-green-800 bg-green-50 rounded-md border border-green-200 mb-8" role="status">
            ✓ Payment receipt submitted! Our team will verify your GCash payment shortly (usually 1–2 hours).
          </div>
        )}
        {search.error === "missing_file" && (
          <div className="p-4 text-sm text-red-800 bg-red-50 rounded-md border border-red-200 mb-8" role="alert">
            Please select a valid image file to upload.
          </div>
        )}
        {search.error === "file_size_exceeded" && (
          <div className="p-4 text-sm text-red-800 bg-red-50 rounded-md border border-red-200 mb-8" role="alert">
            Receipt image exceeds the 2MB limit. Please compress and retry.
          </div>
        )}
        {search.error === "invalid_file_signature" && (
          <div className="p-4 text-sm text-red-800 bg-red-50 rounded-md border border-red-200 mb-8" role="alert">
            Invalid image format. Only JPG, PNG, and WebP are accepted.
          </div>
        )}
        {search.error === "submission_failed" && (
          <div className="p-4 text-sm text-red-800 bg-red-50 rounded-md border border-red-200 mb-8" role="alert">
            Unable to submit receipt. Please try again.
          </div>
        )}

        {/* ── Fulfillment Timeline ─────────────────── */}
        <Card className="mb-8 border-border shadow-sm">
          <CardContent className="p-6">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 mb-4">
              <h2 className="text-lg font-bold">Order Status</h2>
              <Badge variant="secondary" className="font-mono uppercase tracking-widest text-[10px] px-3 py-1">
                {stageInfo.label}
              </Badge>
            </div>

            <p className="text-sm text-muted-foreground mb-8">
              {stageInfo.description}
            </p>

            {!stageInfo.isException ? (
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                {[
                  { name: "Confirmed", step: 1 },
                  { name: "Preparing", step: 2 },
                  { name: "Shipping", step: 3 },
                  { name: "Arriving", step: 4 },
                  { name: "Delivered", step: 5 },
                ].map((s, i) => {
                  const isPassed = stageInfo.stepIndex >= s.step;
                  const isCurrent = stageInfo.stepIndex === s.step;
                  return (
                    <div key={s.step} className="flex sm:flex-col items-center sm:justify-center gap-3 w-full relative group">
                      {/* Connecting Line (Desktop) */}
                      {i !== 0 && (
                        <div className={`hidden sm:block absolute top-4 left-[calc(-50%+1.5rem)] right-[calc(50%+1.5rem)] h-[2px] ${isPassed ? 'bg-primary' : 'bg-muted'}`} />
                      )}
                      {/* Connecting Line (Mobile) */}
                      {i !== 0 && (
                        <div className={`sm:hidden absolute left-4 -top-[calc(100%-2rem)] h-full w-[2px] ${isPassed ? 'bg-primary' : 'bg-muted'}`} />
                      )}
                      
                      <div className={`relative z-10 w-8 h-8 rounded-full flex items-center justify-center font-mono text-xs font-bold border-2 transition-colors ${
                        isCurrent ? "bg-primary text-primary-foreground border-primary" : 
                        isPassed ? "bg-primary text-primary-foreground border-primary" : 
                        "bg-background text-muted-foreground border-muted"
                      }`}>
                        {isPassed && !isCurrent ? "✓" : s.step}
                      </div>
                      <div className={`text-xs font-bold uppercase tracking-widest ${
                        isCurrent ? "text-foreground" : 
                        isPassed ? "text-muted-foreground" : 
                        "text-muted-foreground/50"
                      }`}>
                        {s.name}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="p-4 text-sm text-red-800 bg-red-50 rounded-md border border-red-200">
                <strong>Exception: </strong>{stageInfo.description}
              </div>
            )}
          </CardContent>
        </Card>

        {/* ── Main Grid ───────────────────────────── */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">

          {/* Left column (Takes up 2/3 space on large screens) */}
          <div className="lg:col-span-2 flex flex-col gap-8">

            {/* GCash Payment Panel */}
            {payment?.method === "MANUAL_GCASH" && (
              <GcashPaymentPanel
                orderId={order.id}
                orderNumber={order.order_number}
                amountMinor={order.total_minor}
                formattedAmount={formatMinorUnitsToPHP(order.total_minor)}
                paymentStatus={payment.status}
                reservationExpiresAt={activeReservation?.expires_at}
                canSubmitProof={canSubmitProof}
                submissions={submissions}
                latestSignedUrl={latestSignedUrl}
              />
            )}

            {/* Items Ordered */}
            <Card className="border-border shadow-sm">
              <CardHeader className="pb-3 border-b border-border">
                <CardTitle className="text-lg">Items Ordered ({items.length})</CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="divide-y divide-border">
                  {items.map((item) => (
                    <article key={item.id} className="flex justify-between items-center py-4 gap-4 flex-wrap">
                      <div className="flex-1 min-w-0">
                        <h3 className="font-bold text-sm mb-1">{item.product_name}</h3>
                        {item.variant_name && (
                          <div className="text-[10px] font-mono uppercase text-muted-foreground mb-1">
                            {item.variant_name}
                          </div>
                        )}
                        <p className="text-[11px] font-mono text-muted-foreground">
                          SKU: {item.sku} · Qty: {item.quantity}
                        </p>
                      </div>
                      <span className="font-mono font-bold text-sm shrink-0">
                        {formatMinorUnitsToPHP(item.line_total_minor)}
                      </span>
                    </article>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Fulfillment & Delivery Details */}
            {order.fulfillment_method === "STORE_PICKUP" ? (
              <Card className="border-border shadow-sm">
                <CardHeader className="pb-3 border-b border-border">
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Store className="size-5 text-primary" />
                    Flagship Store Pickup
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-4 space-y-3">
                  <div className="text-sm leading-relaxed text-foreground">
                    <p className="font-bold text-base">1968 Flagship Store — Makati</p>
                    <p className="text-muted-foreground text-xs mt-0.5">
                      Ground Floor, Archival Retail Center, Makati City, Metro Manila
                    </p>
                    <p className="text-muted-foreground text-xs">
                      Pickup Hours: Monday to Sunday · 11:00 AM – 8:00 PM
                    </p>
                  </div>

                  <div className="p-3 bg-muted/40 rounded-lg text-xs space-y-1 font-mono">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Authorized Collector:</span>
                      <span className="font-bold text-foreground">{order.recipient_name}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Contact Phone:</span>
                      <span className="text-foreground">{order.recipient_phone}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Pickup Reference:</span>
                      <span className="font-bold text-primary">#{order.order_number}</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ) : (
              <Card className="border-border shadow-sm">
                <CardHeader className="pb-3 border-b border-border flex flex-row items-center justify-between">
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Truck className="size-5 text-primary" />
                    Delivery &amp; Shipment
                  </CardTitle>
                  {shipment && (
                    <Badge variant="outline" className="font-mono text-[10px]">
                      {getCourierDisplayName(shipment.provider)} · {shipment.status}
                    </Badge>
                  )}
                </CardHeader>
                <CardContent className="pt-4 space-y-4">
                  {/* Courier tracking details if available */}
                  {shipment && (
                    <div className="p-3.5 bg-muted/40 border border-border rounded-lg text-xs space-y-2 font-mono">
                      <div className="flex justify-between items-center">
                        <span className="text-muted-foreground">Courier Provider:</span>
                        <span className="font-bold text-foreground">{getCourierDisplayName(shipment.provider)}</span>
                      </div>
                      {shipment.tracking_number && (
                        <div className="flex justify-between items-center">
                          <span className="text-muted-foreground">Tracking No:</span>
                          <span className="font-bold text-foreground select-all">{shipment.tracking_number}</span>
                        </div>
                      )}
                      {shipment.carrier_notes && (
                        <div className="text-muted-foreground text-[11px] pt-1 border-t border-border">
                          {shipment.carrier_notes}
                        </div>
                      )}
                      {shipment.tracking_url && (
                        <div className="pt-1">
                          <Button asChild size="sm" variant="outline" className="w-full text-xs gap-1.5 h-8">
                            <a href={shipment.tracking_url} target="_blank" rel="noopener noreferrer">
                              <span>Track on Courier Portal</span>
                              <ExternalLink className="size-3" />
                            </a>
                          </Button>
                        </div>
                      )}
                    </div>
                  )}

                  <div className="text-sm leading-relaxed text-foreground">
                    <strong>{order.recipient_name}</strong><br />
                    {order.recipient_phone}<br />
                    {order.address_line1}
                    {order.address_line2 && <>, {order.address_line2}</>}
                    {order.barangay && <>, Brgy. {order.barangay}</>}<br />
                    {order.city_municipality}, {order.province} {order.postal_code}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Return / Exchange Status or Submission Block */}
            {returnRequests.length > 0 && (
              <Card className="border-border shadow-sm">
                <CardHeader className="pb-3 border-b border-border">
                  <CardTitle className="text-base font-bold">Return / Exchange History</CardTitle>
                </CardHeader>
                <CardContent className="pt-4 space-y-3">
                  {returnRequests.map((req) => (
                    <div key={req.id} className="p-3 rounded-lg bg-muted/30 border border-border text-xs space-y-1.5">
                      <div className="flex justify-between items-center">
                        <span className="font-bold uppercase tracking-wider font-mono">{req.type}</span>
                        <Badge variant={req.status === "APPROVED" ? "default" : req.status === "REJECTED" ? "destructive" : "secondary"} className="text-[10px] font-mono">
                          {req.status}
                        </Badge>
                      </div>
                      <p className="text-muted-foreground">Reason: {req.reason.replace(/_/g, " ")}</p>
                      {req.reason_details && <p className="text-foreground italic">&ldquo;{req.reason_details}&rdquo;</p>}
                      {req.admin_notes && (
                        <div className="pt-1 border-t border-border/50 text-xs text-primary font-medium">
                          Note from Merchant: {req.admin_notes}
                        </div>
                      )}
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}
          </div>

          {/* Right column — Order Summary */}
          <Card className="border-border shadow-sm h-fit sticky top-6">
            <CardHeader className="pb-4 border-b border-border">
              <CardTitle className="text-lg">Order Summary</CardTitle>
            </CardHeader>
            <CardContent className="pt-6 pb-6 space-y-6">
              <div className="space-y-4">
                <div className="flex justify-between items-center text-sm border-b border-border pb-3">
                  <span className="text-muted-foreground font-medium">Channel</span>
                  <span className="font-mono text-xs uppercase text-foreground">{order.sales_channel || "STOREFRONT"}</span>
                </div>
                <div className="flex justify-between items-center text-sm border-b border-border pb-3">
                  <span className="text-muted-foreground font-medium">Fulfillment</span>
                  <Badge variant="outline" className="font-mono text-[10px] uppercase tracking-widest px-2">
                    {order.fulfillment_method === "STORE_PICKUP" ? "Store Pickup" : "Courier Delivery"}
                  </Badge>
                </div>
                <div className="flex justify-between items-center text-sm border-b border-border pb-3">
                  <span className="text-muted-foreground font-medium">Payment</span>
                  <span className="font-medium text-foreground">{payment?.method || "MANUAL_GCASH"}</span>
                </div>
                <div className="flex justify-between items-center text-sm border-b border-border pb-3">
                  <span className="text-muted-foreground font-medium">Payment Status</span>
                  <Badge variant={payment?.status === 'PAID' ? 'default' : 'secondary'} className="font-mono text-[10px] uppercase tracking-widest px-2">
                    {payment?.status ?? "UNPAID"}
                  </Badge>
                </div>
                <div className="flex justify-between items-center text-sm border-b border-border pb-3">
                  <span className="text-muted-foreground font-medium">Order Status</span>
                  <Badge variant="outline" className="font-mono text-[10px] uppercase tracking-widest px-2">
                    {order.status}
                  </Badge>
                </div>
              </div>

              <div className="space-y-3 pt-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Subtotal</span>
                  <span className="font-semibold tabular-nums">{formatMinorUnitsToPHP(order.subtotal_minor)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Shipping</span>
                  <span className="font-mono font-bold">
                    {order.shipping_minor > 0 ? formatMinorUnitsToPHP(order.shipping_minor) : "₱0.00 (Free)"}
                  </span>
                </div>
                <div className="flex justify-between items-center pt-4 border-t-2 border-primary mt-2">
                  <span className="font-bold">Total</span>
                  <span className="text-lg font-bold tabular-nums">{formatMinorUnitsToPHP(order.total_minor)}</span>
                </div>
              </div>

              {/* Order Cancellation Before Shipment */}
              {(order.status === "CONFIRMED" || order.status === "PROCESSING") && (
                <div className="pt-2 border-t border-border">
                  <CancelOrderDialog
                    orderId={order.id}
                    orderNumber={order.order_number}
                  />
                </div>
              )}

              {/* Return / Exchange Button if Delivered */}
              {(order.status === "DELIVERED" || order.status === "COMPLETED") && returnRequests.length === 0 && (
                <div className="pt-2 border-t border-border">
                  <ReturnRequestDialog
                    orderId={order.id}
                    orderNumber={order.order_number}
                    totalMinor={order.total_minor}
                  />
                </div>
              )}

              <Button variant="secondary" className="w-full mt-4" asChild>
                <Link href="/orders">
                  &larr; Back to All Orders
                </Link>
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </main>
  );
}
