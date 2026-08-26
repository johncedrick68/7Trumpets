import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { formatMinorUnitsToPHP } from "@/lib/catalog/queries";
import { deriveCustomerFulfillmentStage } from "@/lib/orders/status";
import { logServerError } from "@/lib/server-log";
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

  // 3. If payment exists, fetch submissions for this payment (owner-scoped)
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

  const canSubmitProof =
    payment?.method === "MANUAL_GCASH" &&
    order.status === "CONFIRMED" &&
    (payment.status === "UNPAID" || payment.status === "REJECTED");

  return (
    <main className="catalog-main">
      <div className="catalog-container">
        <header className="admin-page-header">
          <div style={{ marginBottom: "0.5rem" }}>
            <Link href="/orders" style={{ fontSize: "0.85rem", color: "var(--muted)" }}>
              &larr; Back to Order History
            </Link>
          </div>
          <p className="eyebrow">Order Details</p>
          <h1 style={{ fontSize: "2rem", fontWeight: 800 }}>Order #{order.order_number}</h1>
          <p style={{ color: "var(--muted)", margin: "0.25rem 0 0" }}>
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
        <section style={{ width: "100%", maxWidth: "none", background: "var(--surface-card)", border: "1px solid var(--line)", borderRadius: "var(--radius)", padding: "1.75rem", marginBottom: "2rem" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "0.5rem", marginBottom: "1rem" }}>
            <h2 style={{ fontSize: "1.2rem", fontWeight: 700, margin: 0 }}>
              Fulfillment Status: <span className="status-pill status-confirmed">{stageInfo.label}</span>
            </h2>
          </div>
          <p style={{ color: "var(--muted)", margin: "0 0 1.5rem" }}>{stageInfo.description}</p>

          {!stageInfo.isException ? (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: "0.5rem" }}>
              {[
                { name: "Confirmed", step: 1 },
                { name: "Preparing", step: 2 },
                { name: "Shipping", step: 3 },
                { name: "Arriving", step: 4 },
                { name: "Delivered", step: 5 },
              ].map((s) => {
                const isPassed = stageInfo.stepIndex >= s.step;
                const isCurrent = stageInfo.stepIndex === s.step;
                return (
                  <div
                    key={s.step}
                    style={{
                      textAlign: "center",
                      padding: "0.75rem 0.5rem",
                      background: isCurrent ? "var(--surface-hover)" : isPassed ? "rgba(16, 185, 129, 0.08)" : "var(--surface)",
                      border: "1px solid",
                      borderColor: isCurrent ? "var(--accent-soft)" : isPassed ? "rgba(16, 185, 129, 0.3)" : "var(--line)",
                      borderRadius: "var(--radius-sm)",
                    }}
                  >
                    <div style={{ fontSize: "0.85rem", fontWeight: 700, color: isPassed ? "#34d399" : "var(--muted)", marginBottom: "0.25rem" }}>
                      {isPassed && !isCurrent ? "✓" : s.step}
                    </div>
                    <div style={{ fontSize: "0.8rem", fontWeight: isCurrent ? 700 : 500, color: isCurrent ? "var(--ink)" : "var(--muted)" }}>
                      {s.name}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="error" style={{ margin: 0 }}>
              <strong>Notice: </strong> {stageInfo.description}
            </div>
          )}
        </section>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: "2rem", alignItems: "start" }}>
          <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
            {/* GCash Proof Section */}
            {payment?.method === "MANUAL_GCASH" && (
              <section style={{ width: "100%", maxWidth: "none", background: "var(--surface)", border: "1px solid var(--line)", borderRadius: "var(--radius)", padding: "1.5rem" }}>
                <h2 style={{ fontSize: "1.15rem", fontWeight: 700, margin: "0 0 1rem" }}>Manual GCash Payment Verification</h2>

                {payment.status === "UNPAID" && (
                  <div style={{ background: "rgba(56, 189, 248, 0.08)", border: "1px solid rgba(56, 189, 248, 0.25)", borderRadius: "var(--radius-sm)", padding: "1.25rem", marginBottom: "1.25rem" }}>
                    <h3 style={{ fontSize: "0.95rem", fontWeight: 700, color: "#38bdf8", margin: "0 0 0.5rem" }}>Payment Instructions</h3>
                    <p style={{ margin: "0 0 0.5rem", fontSize: "0.9rem" }}>
                      Please transfer <strong>{formatMinorUnitsToPHP(order.total_minor)}</strong> to our official GCash account:
                    </p>
                    <p style={{ fontSize: "1.05rem", fontWeight: 700, margin: "0 0 0.5rem" }}>
                      GCash: <span style={{ color: "var(--ink)" }}>0917-1968-CLOTHING (1968 Clothing Official)</span>
                    </p>
                    <p style={{ fontSize: "0.8rem", color: "var(--muted)", margin: 0 }}>
                      After sending, take a screenshot of your payment receipt and upload it below.
                    </p>
                  </div>
                )}

                {payment.status === "SUBMITTED" && (
                  <div className="notice" style={{ background: "rgba(245, 158, 11, 0.1)", borderColor: "rgba(245, 158, 11, 0.3)", color: "#fbbf24", margin: "1rem 0" }}>
                    <strong>Proof Under Review: </strong>
                    We have received your GCash receipt. Our team is verifying your payment.
                  </div>
                )}

                {payment.status === "PAID" && (
                  <div className="notice" style={{ margin: "1rem 0" }}>
                    <strong>Payment Verified: </strong>
                    Your GCash payment has been approved and confirmed.
                  </div>
                )}

                {payment.status === "REJECTED" && (
                  <div className="error" style={{ margin: "1rem 0" }}>
                    <strong>Payment Rejected: </strong>
                    Previous payment submission was rejected. Please review details and upload a corrected receipt.
                  </div>
                )}

                {canSubmitProof && (
                  <form action={submitGcashProof} style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
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
                        style={{ marginTop: "0.5rem" }}
                      />
                    </div>

                    <button type="submit" className="btn btn-primary">
                      Submit GCash Proof &rarr;
                    </button>
                  </form>
                )}

                {/* Submissions Evidence History */}
                {submissions.length > 0 && (
                  <div style={{ marginTop: "1.5rem", borderTop: "1px solid var(--line)", paddingTop: "1rem" }}>
                    <h3 style={{ fontSize: "0.95rem", fontWeight: 700, margin: "0 0 0.75rem" }}>Payment Submission Evidence</h3>
                    {submissions.map((sub, idx) => (
                      <div key={sub.id} style={{ padding: "0.75rem", background: "var(--paper-bright)", borderRadius: "var(--radius-sm)", marginBottom: "0.5rem", fontSize: "0.85rem" }}>
                        <div>
                          <strong>Submission #{submissions.length - idx}</strong> —{" "}
                          {new Date(sub.created_at).toLocaleDateString("en-PH", {
                            year: "numeric",
                            month: "short",
                            day: "numeric",
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </div>
                        {sub.reference_number && <div style={{ color: "var(--muted)", marginTop: "0.2rem" }}>Ref: {sub.reference_number}</div>}
                        {idx === 0 && latestSignedUrl && (
                          <div style={{ marginTop: "0.4rem" }}>
                            <a
                              href={latestSignedUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              style={{ color: "var(--accent-soft)", textDecoration: "underline" }}
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

            {/* Purchased Items */}
            <section style={{ width: "100%", maxWidth: "none", background: "var(--surface)", border: "1px solid var(--line)", borderRadius: "var(--radius)", padding: "1.5rem" }}>
              <h2 style={{ fontSize: "1.15rem", fontWeight: 700, margin: "0 0 1rem" }}>Purchased Items</h2>
              <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
                {items.map((item) => (
                  <article key={item.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "0.75rem 0", borderBottom: "1px solid var(--line)" }}>
                    <div>
                      <h3 style={{ fontSize: "0.95rem", fontWeight: 700, margin: "0 0 0.25rem" }}>{item.product_name}</h3>
                      {item.variant_name && <p style={{ fontSize: "0.8rem", color: "var(--accent-soft)", margin: 0 }}>{item.variant_name}</p>}
                      <p style={{ fontSize: "0.8rem", color: "var(--muted)", margin: 0 }}>SKU: {item.sku} | Qty: {item.quantity}</p>
                    </div>
                    <span style={{ fontWeight: 700 }}>
                      {formatMinorUnitsToPHP(item.line_total_minor)}
                    </span>
                  </article>
                ))}
              </div>
            </section>

            {/* Delivery Address */}
            <section style={{ width: "100%", maxWidth: "none", background: "var(--surface)", border: "1px solid var(--line)", borderRadius: "var(--radius)", padding: "1.5rem" }}>
              <h2 style={{ fontSize: "1.15rem", fontWeight: 700, margin: "0 0 0.75rem" }}>Delivery Address</h2>
              <p style={{ fontSize: "0.9rem", color: "var(--ink)", margin: 0, lineHeight: 1.6 }}>
                <strong>{order.recipient_name}</strong> ({order.recipient_phone})<br />
                {order.address_line1}
                {order.address_line2 && <>, {order.address_line2}</>}
                {order.barangay && <>, Brgy. {order.barangay}</>}<br />
                {order.city_municipality}, {order.province} {order.postal_code}
              </p>
            </section>
          </div>

          {/* Side Summary */}
          <aside style={{ padding: "1.5rem", background: "var(--surface-card)", border: "1px solid var(--line)", borderRadius: "var(--radius)" }}>
            <h2 style={{ fontSize: "1.2rem", fontWeight: 700, margin: "0 0 1rem" }}>Payment Summary</h2>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.95rem", marginBottom: "0.75rem" }}>
              <span style={{ color: "var(--muted)" }}>Method</span>
              <strong>{payment?.method === "MANUAL_GCASH" ? "Manual GCash" : "Cash on Delivery (COD)"}</strong>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.95rem", marginBottom: "1rem" }}>
              <span style={{ color: "var(--muted)" }}>Payment Status</span>
              <span className="status-pill status-confirmed">{payment?.status ?? "UNPAID"}</span>
            </div>

            <hr style={{ margin: "1rem 0", borderColor: "var(--line)" }} />

            <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.95rem", marginBottom: "0.5rem" }}>
              <span style={{ color: "var(--muted)" }}>Subtotal</span>
              <span>{formatMinorUnitsToPHP(order.subtotal_minor)}</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.95rem", marginBottom: "1rem" }}>
              <span style={{ color: "var(--muted)" }}>Shipping</span>
              <span>{formatMinorUnitsToPHP(order.shipping_minor)}</span>
            </div>
            <div style={{ borderTop: "1px solid var(--line)", paddingTop: "1rem", marginBottom: "1.5rem" }}>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: "1.2rem" }}>
                <span>Total Amount</span>
                <strong style={{ color: "var(--ink)" }}>{formatMinorUnitsToPHP(order.total_minor)}</strong>
              </div>
            </div>

            <Link href="/orders" className="btn btn-secondary" style={{ width: "100%", justifyContent: "center" }}>
              View All Orders
            </Link>
          </aside>
        </div>
      </div>
    </main>
  );
}
