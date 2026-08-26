import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { formatMinorUnitsToPHP } from "@/lib/catalog/queries";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function OrderConfirmationPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

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

  // 2. Fetch order items & payment
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

  return (
    <main className="catalog-main">
      <div className="catalog-container">
        <header className="catalog-header">
          <p className="eyebrow">Order Placed Successfully</p>
          <h1>Order #{order.order_number}</h1>
          <p className="summary">Thank you for your order with 7Trumpets.</p>
        </header>

        <div className="order-details-layout">
          <div className="order-main-info">
            <section className="order-status-card" aria-labelledby="order-status-heading">
              <h2 id="order-status-heading">Order Status: <span className="status-badge">{order.status}</span></h2>
              <p>
                Placed on {new Date(order.placed_at).toLocaleDateString("en-PH", {
                  year: "numeric",
                  month: "long",
                  day: "numeric",
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </p>
            </section>

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
              <h2>Payment Details</h2>
              <div className="summary-row">
                <span>Method</span>
                <strong>{payment?.method === "MANUAL_GCASH" ? "Manual GCash" : "Cash on Delivery (COD)"}</strong>
              </div>
              <div className="summary-row">
                <span>Payment Status</span>
                <span className="payment-status-badge">{payment?.status ?? "UNPAID"}</span>
              </div>
              
              {payment?.method === "MANUAL_GCASH" && (
                <div className="gcash-instructions-box">
                  <h3>GCash Instructions</h3>
                  <p>
                    Send <strong>{formatMinorUnitsToPHP(order.total_minor)}</strong> to official GCash: <strong>0917-7TRUMPETS</strong>.
                  </p>
                  <p className="small-note">Keep your transaction screenshot/SMS reference number for payment verification.</p>
                </div>
              )}

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
                <Link href="/products" className="button-link secondary" style={{ width: "100%", textAlign: "center" }}>
                  Continue Shopping
                </Link>
              </div>
            </div>
          </aside>
        </div>
      </div>
    </main>
  );
}
