import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { formatMinorUnitsToPHP } from "@/lib/catalog/queries";
import { deriveCustomerFulfillmentStage } from "@/lib/orders/status";
import { getReceiptSignedUrl, submitGcashProof } from "@/lib/payments/actions";
import { createClient } from "@/lib/supabase/server";

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
    .single();

  if (orderError || !order) {
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

  // 3. If payment exists, fetch submissions for this payment (owner-scoped)
  let submissions: Array<{
    id: string;
    claimed_amount_minor: number;
    reference_number: string | null;
    receipt_storage_path: string;
    created_at: string;
  }> = [];

  if (payment) {
    const { data: subData } = await supabase
      .from("payment_submissions")
      .select("id, claimed_amount_minor, reference_number, receipt_storage_path, created_at")
      .eq("payment_id", payment.id)
      .order("created_at", { ascending: false });
    submissions = subData || [];
  }

  const latestSubmission = submissions[0];
  const latestSignedUrl = latestSubmission
    ? await getReceiptSignedUrl(latestSubmission.receipt_storage_path)
    : null;

  const stageInfo = deriveCustomerFulfillmentStage(order.status);

  const canSubmitProof =
    payment?.method === "MANUAL_GCASH" &&
    order.status === "CONFIRMED" &&
    (payment.status === "UNPAID" || payment.status === "REJECTED");

  return (
    <main className="catalog-main">
      <div className="catalog-container">
        <header className="catalog-header">
          <div className="breadcrumb">
            <Link href="/orders">← Back to Order History</Link>
          </div>
          <p className="eyebrow">Order Details</p>
          <h1>Order #{order.order_number}</h1>
          <p className="summary">
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

        {search.notice === "proof_submitted" && (
          <p className="notice" role="status">
            Payment proof submitted successfully! Our team will verify your GCash payment shortly.
          </p>
        )}
        {search.error === "missing_file" && (
          <p className="error" role="alert">Please select a valid image receipt file to upload.</p>
        )}
        {search.error === "file_size_exceeded" && (
          <p className="error" role="alert">Receipt image exceeds the 2MB size limit.</p>
        )}
        {search.error === "invalid_file_signature" && (
          <p className="error" role="alert">Invalid image file format. Only JPG, PNG, and WebP images are allowed.</p>
        )}
        {search.error === "submission_failed" && (
          <p className="error" role="alert">Unable to submit payment proof. Please try again.</p>
        )}

        {/* Fulfillment Tracking Stepper */}
        <section className="tracking-stepper-card" aria-labelledby="tracking-heading">
          <h2 id="tracking-heading">Fulfillment Progress: <span className="status-badge">{stageInfo.label}</span></h2>
          <p className="stage-description">{stageInfo.description}</p>

          {!stageInfo.isException ? (
            <div className="stepper-track">
              {[
                { name: "Confirmed", step: 1 },
                { name: "Preparing", step: 2 },
                { name: "Shipping", step: 3 },
                { name: "Arriving", step: 4 },
                { name: "Delivered", step: 5 },
              ].map((s) => (
                <div
                  key={s.step}
                  className={`step-node ${
                    stageInfo.stepIndex >= s.step
                      ? stageInfo.stepIndex === s.step
                        ? "current"
                        : "completed"
                      : "pending"
                  }`}
                >
                  <div className="node-icon">{stageInfo.stepIndex > s.step ? "✓" : s.step}</div>
                  <span className="node-label">{s.name}</span>
                </div>
              ))}
            </div>
          ) : (
            <div className="exception-status-box">
              <strong>Notice: </strong>
              {stageInfo.description}
            </div>
          )}
        </section>

        <div className="order-details-layout">
          <div className="order-main-info">
            {/* GCash Proof Submission & History */}
            {payment?.method === "MANUAL_GCASH" && (
              <section className="gcash-proof-section" aria-labelledby="gcash-proof-heading">
                <h2 id="gcash-proof-heading">Manual GCash Payment Verification</h2>

                {payment.status === "UNPAID" && (
                  <div className="gcash-instructions-box">
                    <h3>Payment Instructions</h3>
                    <p>
                      Please transfer <strong>{formatMinorUnitsToPHP(order.total_minor)}</strong> to our official GCash account:
                    </p>
                    <p className="gcash-account-number">GCash: <strong>0917-7TRUMPETS (7Trumpets Devotional)</strong></p>
                    <p className="small-note">After sending, upload your receipt/screenshot below.</p>
                  </div>
                )}

                {payment.status === "SUBMITTED" && (
                  <div className="notice" style={{ margin: "1rem 0" }}>
                    <strong>Proof Under Review: </strong>
                    We have received your GCash receipt and our staff is verifying the transaction.
                  </div>
                )}

                {payment.status === "PAID" && (
                  <div className="notice" style={{ margin: "1rem 0", borderColor: "var(--success)" }}>
                    <strong>Payment Verified: </strong>
                    Your GCash payment has been approved and confirmed.
                  </div>
                )}

                {payment.status === "REJECTED" && (
                  <div className="error" style={{ margin: "1rem 0" }}>
                    <strong>Payment Rejected: </strong>
                    Previous payment submission was rejected. Please review the details and upload a corrected receipt.
                  </div>
                )}

                {canSubmitProof && (
                  <form action={submitGcashProof} className="proof-upload-form">
                    <input type="hidden" name="order_id" value={order.id} />

                    <div>
                      <label htmlFor="reference_number">GCash Reference No. (Optional)</label>
                      <input
                        id="reference_number"
                        type="text"
                        name="reference_number"
                        placeholder="e.g. 1002 9382 1928"
                        maxLength={100}
                      />
                    </div>

                    <div>
                      <label htmlFor="receipt_file">Upload Payment Screenshot / Receipt (JPG, PNG, WebP &lt; 2MB)</label>
                      <input
                        id="receipt_file"
                        type="file"
                        name="receipt_file"
                        accept="image/jpeg,image/png,image/webp"
                        required
                      />
                    </div>

                    <button type="submit" className="button-link">
                      Submit GCash Proof
                    </button>
                  </form>
                )}

                {/* Submissions Evidence History */}
                {submissions.length > 0 && (
                  <div className="submissions-history-list" style={{ marginTop: "1.5rem" }}>
                    <h3>Payment Submission Evidence</h3>
                    {submissions.map((sub, idx) => (
                      <div key={sub.id} className="submission-card">
                        <p>
                          <strong>Submission #{submissions.length - idx}</strong> —{" "}
                          {new Date(sub.created_at).toLocaleDateString("en-PH", {
                            year: "numeric",
                            month: "short",
                            day: "numeric",
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </p>
                        {sub.reference_number && <p className="ref-line">Ref: {sub.reference_number}</p>}
                        {idx === 0 && latestSignedUrl && (
                          <div style={{ marginTop: "0.5rem" }}>
                            <a
                              href={latestSignedUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="receipt-view-link"
                            >
                              View Uploaded Receipt ↗
                            </a>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </section>
            )}

            <section className="order-items-section" aria-labelledby="order-items-heading">
              <h2 id="order-items-heading">Purchased Items</h2>
              <div className="order-items-list">
                {items.map((item) => (
                  <article key={item.id} className="order-item-row">
                    <div>
                      <h3>{item.product_name}</h3>
                      {item.variant_name && <p className="variant-label">{item.variant_name}</p>}
                      <p className="sku-label">SKU: {item.sku} | Qty: {item.quantity}</p>
                    </div>
                    <span className="item-price">
                      {formatMinorUnitsToPHP(item.line_total_minor)}
                    </span>
                  </article>
                ))}
              </div>
            </section>

            <section className="delivery-snapshot-section" aria-labelledby="delivery-heading">
              <h2 id="delivery-heading">Delivery Address</h2>
              <p>
                <strong>{order.recipient_name}</strong> ({order.recipient_phone})<br />
                {order.address_line1}
                {order.address_line2 && <>, {order.address_line2}</>}
                {order.barangay && <>, Brgy. {order.barangay}</>}<br />
                {order.city_municipality}, {order.province} {order.postal_code}
              </p>
            </section>
          </div>

          <aside className="order-side-info">
            <div className="cart-summary-card">
              <h2>Payment Summary</h2>
              <div className="summary-row">
                <span>Method</span>
                <strong>{payment?.method === "MANUAL_GCASH" ? "Manual GCash" : "Cash on Delivery (COD)"}</strong>
              </div>
              <div className="summary-row">
                <span>Payment Status</span>
                <span className="payment-status-badge">{payment?.status ?? "UNPAID"}</span>
              </div>

              <hr style={{ margin: "1rem 0", borderColor: "var(--line)" }} />

              <div className="summary-row">
                <span>Subtotal</span>
                <span>{formatMinorUnitsToPHP(order.subtotal_minor)}</span>
              </div>
              <div className="summary-row">
                <span>Shipping</span>
                <span>{formatMinorUnitsToPHP(order.shipping_minor)}</span>
              </div>
              <div className="summary-row total-row">
                <span>Total Amount</span>
                <span className="summary-amount">{formatMinorUnitsToPHP(order.total_minor)}</span>
              </div>

              <div style={{ marginTop: "1.5rem" }}>
                <Link href="/orders" className="button-link secondary" style={{ width: "100%", textAlign: "center" }}>
                  View All Orders
                </Link>
              </div>
            </div>
          </aside>
        </div>
      </div>
    </main>
  );
}
