import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { formatMinorUnitsToPHP } from "@/lib/catalog/queries";
import { deriveCustomerFulfillmentStage } from "@/lib/orders/status";
import { logServerError } from "@/lib/server-log";
import { getReceiptSignedUrl, submitGcashProof } from "@/lib/payments/actions";
import { getGcashConfig } from "@/lib/payments/config";
import { formatPhDeadline } from "@/lib/payments/deadline";
import { getOrderReservationDeadline, type ReservationDeadlineResult } from "@/lib/payments/queries";
import { createClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const dynamic = "force-dynamic";

export default async function OrderConfirmationPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ notice?: string; error?: string }>;
}) {
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

  // 2. Fetch order items, payment, and payment submissions
  const [itemsRes, paymentRes] = await Promise.all([
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
  ]);

  const items = itemsRes.data || [];
  const payment = paymentRes.data;
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

  const stageInfo = deriveCustomerFulfillmentStage(order.status);

  const reservationDeadline: ReservationDeadlineResult =
    payment?.method === "MANUAL_GCASH"
      ? await getOrderReservationDeadline(order.id)
      : { state: "NO_RESERVATIONS" };

  const gcashConfig = getGcashConfig();
  const isDeadlineActive = reservationDeadline.state === "ACTIVE";
  const canSubmitProof =
    payment?.method === "MANUAL_GCASH" &&
    order.status === "CONFIRMED" &&
    (payment.status === "UNPAID" || payment.status === "REJECTED") &&
    isDeadlineActive &&
    gcashConfig.isConfigured;

  const formattedDeadline =
    reservationDeadline.state === "ACTIVE" || reservationDeadline.state === "EXPIRED"
      ? formatPhDeadline(reservationDeadline.expiresAt)
      : null;

  return (
    <main className="w-full min-h-screen px-4 py-8 md:py-12 max-w-5xl mx-auto">
      <div className="w-full">
        {/* Breadcrumb */}
        <nav aria-label="Breadcrumb" className="flex items-center gap-2 font-mono text-[11px] text-muted-foreground uppercase tracking-widest mb-8">
          <Link href="/orders" className="hover:text-foreground transition-colors">Orders</Link>
          <span>/</span>
          <span className="text-foreground font-bold">#{order.order_number}</span>
        </nav>

        {/* Page header */}
        <header className="mb-8">
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

            {/* Cash on Delivery Payment */}
            {payment?.method === "COD" && (
              <Card className="border-border shadow-sm">
                <CardHeader className="pb-3 border-b border-border">
                  <CardTitle className="text-lg">Cash on Delivery</CardTitle>
                </CardHeader>
                <CardContent className="pt-6 space-y-4">
                  {order.status === "CANCELLED" ? (
                    <div className="p-4 text-sm text-red-800 bg-red-50 rounded-md border border-red-200">
                      <strong>Order Cancelled:</strong> This order has been cancelled. Doorstep cash collection will not take place.
                    </div>
                  ) : order.status === "DELIVERED" || order.status === "COMPLETED" ? (
                    <div className="p-4 text-sm text-green-800 bg-green-50 rounded-md border border-green-200">
                      ✓ <strong>Delivered:</strong> Cash payment of{" "}
                      <strong className="text-foreground">{formatMinorUnitsToPHP(order.total_minor)}</strong> was collected upon delivery.
                    </div>
                  ) : (
                    <>
                      <div className="p-4 text-sm text-blue-900 bg-blue-50 rounded-md border border-blue-200">
                        💵 <strong>Doorstep Payment:</strong> Please prepare the exact cash amount of{" "}
                        <strong className="text-foreground">{formatMinorUnitsToPHP(order.total_minor)}</strong> to hand to the courier upon delivery.
                      </div>
                      <p className="text-xs text-muted-foreground leading-relaxed">
                        Order status: <strong className="text-foreground">{order.status}</strong>. Cash payment will be collected and verified upon doorstep delivery.
                      </p>
                    </>
                  )}
                </CardContent>
              </Card>
            )}

            {/* GCash Payment */}
            {payment?.method === "MANUAL_GCASH" && (
              <Card className="border-border shadow-sm">
                <CardHeader className="pb-3 border-b border-border">
                  <CardTitle className="text-lg">GCash Payment</CardTitle>
                </CardHeader>
                <CardContent className="pt-6">

                  {/* Terminal order cancellation notice */}
                  {order.status === "CANCELLED" && (
                    <div className="p-4 text-sm text-red-800 bg-red-50 rounded-md border border-red-200 mb-6">
                      <strong>Order Cancelled:</strong> This order has been cancelled and any held inventory reservations have been released.
                    </div>
                  )}

                  {/* Elapsed deadline notice for unpaid/rejected orders (not yet terminally cancelled) */}
                  {order.status === "CONFIRMED" &&
                    reservationDeadline.state === "EXPIRED" &&
                    (payment.status === "UNPAID" || payment.status === "REJECTED") && (
                      <div className="p-4 text-sm text-red-800 bg-red-50 rounded-md border border-red-200 mb-6">
                        <strong>Payment Window Expired:</strong> The deadline to submit payment proof for this order has passed{formattedDeadline ? ` (${formattedDeadline})` : ""}. If payment was not submitted, this order will be cancelled by staff.
                      </div>
                  )}

                  {/* Abnormal or query error state */}
                  {order.status === "CONFIRMED" &&
                    (reservationDeadline.state === "ERROR" ||
                      reservationDeadline.state === "INVALID_SET" ||
                      reservationDeadline.state === "NO_RESERVATIONS") &&
                    (payment.status === "UNPAID" || payment.status === "REJECTED") && (
                      <div className="p-4 text-sm text-amber-800 bg-amber-50 rounded-md border border-amber-200 mb-6">
                        <strong>Notice:</strong> Payment status is temporarily unavailable. Please contact support before sending payment.
                      </div>
                    )}

                  {/* Missing/unconfigured GCash destination notice */}
                  {!gcashConfig.isConfigured &&
                    order.status === "CONFIRMED" &&
                    (payment.status === "UNPAID" || payment.status === "REJECTED") && (
                      <div className="p-4 text-sm text-amber-800 bg-amber-50 rounded-md border border-amber-200 mb-6">
                        <strong>Notice:</strong> GCash payment destination is temporarily unavailable. Please contact store support to arrange payment.
                      </div>
                  )}

                  {payment.status === "UNPAID" &&
                    order.status === "CONFIRMED" &&
                    reservationDeadline.state === "ACTIVE" &&
                    gcashConfig.isConfigured && (
                    <div className="mb-6 space-y-4">
                      <h3 className="font-bold text-foreground">📱 How to Pay</h3>
                      {formattedDeadline && (
                        <div className="p-3 bg-blue-50/70 border border-blue-200 text-blue-900 rounded-md text-xs">
                          ⏰ <strong>Payment Deadline:</strong> {formattedDeadline}
                        </div>
                      )}
                      <p className="text-sm text-muted-foreground">
                        Send exactly <strong className="text-foreground">{formatMinorUnitsToPHP(order.total_minor)}</strong> to:
                      </p>
                      <div className="space-y-1">
                        <div className="inline-block px-4 py-3 bg-muted rounded-md font-mono text-xl font-bold tracking-wider">
                          {gcashConfig.accountNumber}
                        </div>
                        {gcashConfig.accountName && (
                          <p className="text-xs font-medium text-muted-foreground">
                            Account Name: <strong className="text-foreground">{gcashConfig.accountName}</strong>
                          </p>
                        )}
                      </div>
                      <ol className="list-decimal list-inside text-sm text-muted-foreground space-y-2 mt-4">
                        <li>Open GCash → Send Money → enter the account number above.</li>
                        <li>Use <strong className="text-foreground">#{order.order_number}</strong> as the note/reference.</li>
                        <li>Screenshot the confirmation and upload it below before the deadline.</li>
                      </ol>
                    </div>
                  )}

                  {payment.status === "SUBMITTED" && (
                    <div className="p-4 text-sm text-blue-800 bg-blue-50 rounded-md border border-blue-200 mb-6">
                      ⏳ <strong>Under Review</strong> — Receipt received. Your payment proof is currently under review by staff.
                    </div>
                  )}

                  {payment.status === "PAID" && (
                    <div className="p-4 text-sm text-green-800 bg-green-50 rounded-md border border-green-200 mb-6">
                      ✓ <strong>Payment Verified</strong> — Your GCash payment has been confirmed.
                    </div>
                  )}

                  {payment.status === "REJECTED" && order.status === "CONFIRMED" && reservationDeadline.state === "ACTIVE" && (
                    <div className="p-4 text-sm text-red-800 bg-red-50 rounded-md border border-red-200 mb-6">
                      ✕ <strong>Receipt Rejected</strong> — Please upload a corrected GCash receipt before {formattedDeadline || "the deadline"}.
                    </div>
                  )}

                  {canSubmitProof && (
                    <form action={submitGcashProof} className="space-y-4">
                      <input type="hidden" name="order_id" value={order.id} />

                      <div className="space-y-2">
                        <Label htmlFor="reference_number">GCash Reference No. (Optional)</Label>
                        <Input
                          id="reference_number"
                          type="text"
                          name="reference_number"
                          placeholder="e.g. 1002 9382 1928"
                          maxLength={100}
                        />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="receipt_file">
                          Upload Payment Screenshot (JPG, PNG, WebP · max 2MB) *
                        </Label>
                        <Input
                          id="receipt_file"
                          type="file"
                          name="receipt_file"
                          accept="image/jpeg,image/png,image/webp"
                          required
                          className="cursor-pointer file:cursor-pointer"
                        />
                      </div>

                      <Button type="submit" className="w-full">
                        Submit GCash Proof &rarr;
                      </Button>
                    </form>
                  )}

                  {submissions.length > 0 && (
                    <div className="mt-8 pt-6 border-t border-border">
                      <h4 className="text-[10px] font-mono font-bold uppercase tracking-widest text-muted-foreground mb-4">
                        Submission History
                      </h4>
                      <div className="space-y-3">
                        {submissions.map((sub, idx) => (
                          <div key={sub.id} className="p-4 bg-muted/50 border border-border rounded-lg text-sm flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3">
                            <div>
                              <strong className="block mb-1">Submission #{submissions.length - idx}</strong>
                              <span className="text-xs font-mono text-muted-foreground block">
                                {new Date(sub.created_at).toLocaleDateString("en-PH", {
                                  year: "numeric", month: "short", day: "numeric",
                                  hour: "2-digit", minute: "2-digit",
                                })}
                              </span>
                              {sub.reference_number && (
                                <div className="text-xs font-mono text-muted-foreground mt-2">
                                  Ref: {sub.reference_number}
                                </div>
                              )}
                            </div>
                            
                            {idx === 0 && latestSignedUrl && (
                              <Button variant="outline" size="sm" asChild>
                                <a href={latestSignedUrl} target="_blank" rel="noopener noreferrer">
                                  View Receipt ↗
                                </a>
                              </Button>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
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

            {/* Delivery Address */}
            <Card className="border-border shadow-sm">
              <CardHeader className="pb-3 border-b border-border">
                <CardTitle className="text-lg">Delivery Address</CardTitle>
              </CardHeader>
              <CardContent className="pt-4">
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
          </div>

          {/* Right column — Order Summary */}
          <Card className="border-border shadow-sm h-fit sticky top-6">
            <CardHeader className="pb-4 border-b border-border">
              <CardTitle className="text-lg">Order Summary</CardTitle>
            </CardHeader>
            <CardContent className="pt-6 pb-6">
              <div className="space-y-4 mb-6">
                <div className="flex justify-between items-center text-sm border-b border-border pb-3">
                  <span className="text-muted-foreground font-medium">Payment</span>
                  <span className="font-medium text-foreground">
                    {payment?.method === "COD" ? "Cash on Delivery" : "Manual GCash"}
                  </span>
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
                  <span className="font-mono font-bold">{formatMinorUnitsToPHP(order.subtotal_minor)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Shipping</span>
                  <span className="font-mono font-bold">{formatMinorUnitsToPHP(order.shipping_minor)}</span>
                </div>
                <div className="flex justify-between items-center pt-4 border-t-2 border-primary mt-2">
                  <span className="font-bold">Total</span>
                  <span className="font-mono font-bold text-lg">{formatMinorUnitsToPHP(order.total_minor)}</span>
                </div>
              </div>

              <Button variant="secondary" className="w-full mt-8" asChild>
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
