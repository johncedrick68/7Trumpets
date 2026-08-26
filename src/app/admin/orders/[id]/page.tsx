import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { getAdminAuthContext } from "@/lib/admin/auth";
import { settleCodPayment, transitionOrderStatus } from "@/lib/admin/actions";
import { formatMinorUnitsToPHP } from "@/lib/catalog/queries";
import { createServiceClient } from "@/lib/supabase/server";

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
  const { data: order } = await serviceClient
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
    .single();

  if (!order) {
    notFound();
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const payment = (order.payments as any)?.[0];
  const history = order.order_status_history || [];
  // Sort history newest first
  history.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

  // Determine allowed forward transitions based on canonical order status machine
  const allowedTransitions: Array<{ to: string; label: string }> = [];

  if (order.status === "CONFIRMED") {
    // Only allow PROCESSING if payment requirements are satisfied:
    // GCash must be PAID; COD can be UNPAID or PAID
    const canProcess = payment?.method === "COD" || (payment?.method === "MANUAL_GCASH" && payment?.status === "PAID");
    if (canProcess) {
      allowedTransitions.push({ to: "PROCESSING", label: "Start Processing" });
    }
    allowedTransitions.push({ to: "CANCELLED", label: "Cancel Order" });
  } else if (order.status === "PROCESSING") {
    allowedTransitions.push({ to: "PACKING", label: "Mark Packing" });
    allowedTransitions.push({ to: "CANCELLED", label: "Cancel Order" });
  } else if (order.status === "PACKING") {
    allowedTransitions.push({ to: "READY_FOR_SHIPMENT", label: "Ready for Shipment" });
    allowedTransitions.push({ to: "CANCELLED", label: "Cancel Order" });
  } else if (order.status === "READY_FOR_SHIPMENT") {
    allowedTransitions.push({ to: "SHIPPED", label: "Mark Shipped" });
    allowedTransitions.push({ to: "CANCELLED", label: "Cancel Order" });
  } else if (order.status === "SHIPPED") {
    allowedTransitions.push({ to: "IN_TRANSIT", label: "Mark In Transit" });
    allowedTransitions.push({ to: "DELIVERY_FAILED", label: "Delivery Failed" });
  } else if (order.status === "IN_TRANSIT") {
    allowedTransitions.push({ to: "OUT_FOR_DELIVERY", label: "Out for Delivery" });
    allowedTransitions.push({ to: "DELIVERY_FAILED", label: "Delivery Failed" });
  } else if (order.status === "OUT_FOR_DELIVERY") {
    allowedTransitions.push({ to: "DELIVERED", label: "Mark Delivered" });
    allowedTransitions.push({ to: "DELIVERY_FAILED", label: "Delivery Failed" });
  } else if (order.status === "DELIVERED") {
    allowedTransitions.push({ to: "COMPLETED", label: "Complete Order" });
  }

  return (
    <div className="admin-page">
      <header className="admin-page-header">
        <Link href="/admin/orders" className="subtle-text small-text" style={{ display: "block", marginBottom: "0.5rem" }}>
          &larr; Back to Orders List
        </Link>
        <h1>Order #{order.order_number}</h1>
        <p className="subtle-text">Placed {new Date(order.placed_at).toLocaleString()}</p>
      </header>

      {notice && (
        <div className="notice" role="status" style={{ marginBottom: "1.5rem" }}>
          {notice === "status_updated" && "Order status successfully updated."}
          {notice === "cod_settled" && "COD payment successfully settled as PAID."}
        </div>
      )}

      {error && (
        <div className="error" role="alert" style={{ marginBottom: "1.5rem" }}>
          Error: {error}
        </div>
      )}

      <div className="admin-grid-layout">
        <div className="admin-main-col">
          {/* Order Transition Control Card */}
          <div className="admin-card">
            <h2>Fulfillment State Transition</h2>
            <div style={{ margin: "1rem 0" }}>
              Current Status:{" "}
              <span className={`status-pill status-${order.status.toLowerCase()}`}>
                {order.status}
              </span>
            </div>

            {allowedTransitions.length > 0 ? (
              <div className="admin-transition-buttons" style={{ display: "flex", flexWrap: "wrap", gap: "0.75rem", marginTop: "1rem" }}>
                {allowedTransitions.map((t) => (
                  <form key={t.to} action={transitionOrderStatus}>
                    <input type="hidden" name="order_id" value={order.id} />
                    <input type="hidden" name="to_status" value={t.to} />
                    <button
                      type="submit"
                      className={`btn ${t.to === "CANCELLED" || t.to === "DELIVERY_FAILED" ? "btn-secondary btn-danger-tone" : "btn-primary"}`}
                    >
                      {t.label} &rarr;
                    </button>
                  </form>
                ))}
              </div>
            ) : (
              <p className="subtle-text">This order is in a terminal state ({order.status}).</p>
            )}

            {/* COD Settlement action */}
            {payment?.method === "COD" && payment?.status === "UNPAID" && (
              <div style={{ marginTop: "1.5rem", borderTop: "1px solid var(--border)", paddingTop: "1rem" }}>
                <h3>COD Payment Settlement</h3>
                <p className="subtle-text small-text">
                  Collect cash payment at doorstep upon or after delivery.
                </p>
                <form action={settleCodPayment} style={{ marginTop: "0.5rem" }}>
                  <input type="hidden" name="payment_id" value={payment.id} />
                  <input type="hidden" name="reason" value="COD cash collected at delivery by courier/driver" />
                  <button type="submit" className="btn btn-secondary">
                    Settle COD Payment (Mark PAID)
                  </button>
                </form>
              </div>
            )}
          </div>

          {/* Historical Items Snapshot */}
          <div className="admin-card">
            <h2>Order Items Snapshot</h2>
            <div className="admin-table-wrapper">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>Item</th>
                    <th>SKU</th>
                    <th>Price</th>
                    <th>Qty</th>
                    <th>Total</th>
                  </tr>
                </thead>
                <tbody>
                  {order.order_items.map((item) => (
                    <tr key={item.id}>
                      <td>
                        <strong>{item.product_name}</strong>
                        {item.variant_name && <div className="subtle-text small-text">{item.variant_name}</div>}
                      </td>
                      <td><code>{item.sku}</code></td>
                      <td>{formatMinorUnitsToPHP(item.unit_price_minor)}</td>
                      <td>{item.quantity}</td>
                      <td><strong>{formatMinorUnitsToPHP(item.line_total_minor)}</strong></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div style={{ marginTop: "1rem", textAlign: "right" }}>
              <div>Subtotal: <strong>{formatMinorUnitsToPHP(order.subtotal_minor)}</strong></div>
              <div>Shipping: <strong>{formatMinorUnitsToPHP(order.shipping_minor)}</strong></div>
              <div style={{ fontSize: "1.2rem", marginTop: "0.5rem" }}>
                Total: <strong>{formatMinorUnitsToPHP(order.total_minor)}</strong>
              </div>
            </div>
          </div>

          {/* Status History */}
          <div className="admin-card">
            <h2>Status Transition History</h2>
            <div className="history-timeline" style={{ marginTop: "1rem" }}>
              {history.map((h) => (
                <div key={h.id} className="history-item" style={{ padding: "0.75rem 0", borderBottom: "1px solid var(--border)" }}>
                  <div>
                    <strong>{h.to_status}</strong>
                    {h.from_status && <span className="subtle-text"> (from {h.from_status})</span>}
                    <span className="subtle-text small-text" style={{ float: "right" }}>
                      {new Date(h.created_at).toLocaleString()}
                    </span>
                  </div>
                  {h.note && <div className="subtle-text small-text" style={{ marginTop: "0.25rem" }}>Note: {h.note}</div>}
                  <div className="subtle-text small-text">Source: {h.source}</div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="admin-side-col">
          {/* Customer and Delivery Snapshot */}
          <div className="admin-card">
            <h2>Customer & Delivery</h2>
            <div style={{ marginTop: "0.75rem" }}>
              <div className="subtle-text small-text">Customer Email</div>
              <div><strong>{order.customer_email}</strong></div>
            </div>

            <div style={{ marginTop: "0.75rem" }}>
              <div className="subtle-text small-text">Recipient</div>
              <div><strong>{order.recipient_name}</strong></div>
              <div>{order.recipient_phone}</div>
            </div>

            <div style={{ marginTop: "0.75rem" }}>
              <div className="subtle-text small-text">Delivery Address</div>
              <div>{order.address_line1}</div>
              {order.address_line2 && <div>{order.address_line2}</div>}
              {order.barangay && <div>{order.barangay}</div>}
              <div>{order.city_municipality}, {order.province} {order.postal_code}</div>
              <div>{order.country_code}</div>
            </div>

            {order.customer_note && (
              <div style={{ marginTop: "0.75rem" }}>
                <div className="subtle-text small-text">Customer Delivery Note</div>
                <div><em>&ldquo;{order.customer_note}&rdquo;</em></div>
              </div>
            )}
          </div>

          {/* Payment Snapshot */}
          <div className="admin-card">
            <h2>Payment Status</h2>
            {payment ? (
              <div style={{ marginTop: "0.75rem" }}>
                <div>Method: <strong>{payment.method === "MANUAL_GCASH" ? "Manual GCash" : "Cash on Delivery"}</strong></div>
                <div style={{ marginTop: "0.5rem" }}>
                  Status:{" "}
                  <span className={`status-pill status-${payment.status.toLowerCase()}`}>
                    {payment.status}
                  </span>
                </div>
                {payment.paid_at && (
                  <div className="subtle-text small-text" style={{ marginTop: "0.5rem" }}>
                    Paid at: {new Date(payment.paid_at).toLocaleString()}
                  </div>
                )}
                {payment.method === "MANUAL_GCASH" && (
                  <div style={{ marginTop: "1rem" }}>
                    <Link href="/admin/payments" className="btn btn-secondary small-btn">
                      View GCash Queue &rarr;
                    </Link>
                  </div>
                )}
              </div>
            ) : (
              <p className="subtle-text">No payment record found.</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
