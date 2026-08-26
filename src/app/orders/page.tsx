import Link from "next/link";
import { redirect } from "next/navigation";
import { formatMinorUnitsToPHP } from "@/lib/catalog/queries";
import { deriveCustomerFulfillmentStage } from "@/lib/orders/status";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function OrderHistoryPage() {
  const supabase = await createClient();
  const { data: claimsData } = await supabase.auth.getClaims();
  const userId = claimsData?.claims?.sub;
  if (!userId) {
    redirect("/login?next=/orders");
  }

  // Fetch all orders owned by user, sorted by placed_at descending
  const { data: orders } = await supabase
    .from("orders")
    .select("id, order_number, status, total_minor, placed_at, shipping_minor")
    .eq("user_id", userId)
    .order("placed_at", { ascending: false });

  const orderList = orders || [];

  return (
    <main className="catalog-main">
      <div className="catalog-container">
        <header className="catalog-header">
          <p className="eyebrow">My Account</p>
          <h1>Order History</h1>
          <p className="summary">View and track all your 7Trumpets devotional orders.</p>
        </header>

        {orderList.length === 0 ? (
          <section className="catalog-empty">
            <h2>No orders found</h2>
            <p>You haven&apos;t placed any orders yet.</p>
            <div className="hero-actions" style={{ justifyContent: "center" }}>
              <Link href="/products" className="button-link">
                Explore Products
              </Link>
            </div>
          </section>
        ) : (
          <div className="order-history-list">
            {orderList.map((order) => {
              const stageInfo = deriveCustomerFulfillmentStage(order.status);
              return (
                <article key={order.id} className="order-history-card">
                  <div className="order-history-header">
                    <div>
                      <h2 className="order-history-number">
                        <Link href={`/orders/${order.id}`}>Order #{order.order_number}</Link>
                      </h2>
                      <p className="order-history-date">
                        Placed on{" "}
                        {new Date(order.placed_at).toLocaleDateString("en-PH", {
                          year: "numeric",
                          month: "long",
                          day: "numeric",
                        })}
                      </p>
                    </div>
                    <div className="order-history-status-badge">
                      <span className={`status-pill ${stageInfo.isException ? "exception" : ""}`}>
                        {stageInfo.label}
                      </span>
                    </div>
                  </div>

                  <div className="order-history-body">
                    <p className="order-stage-desc">{stageInfo.description}</p>
                  </div>

                  <div className="order-history-footer">
                    <div>
                      <span className="order-total-label">Total Amount: </span>
                      <strong className="order-total-val">
                        {formatMinorUnitsToPHP(order.total_minor)}
                      </strong>
                    </div>
                    <Link href={`/orders/${order.id}`} className="button-link secondary small-btn">
                      View Order Details &amp; Tracking
                    </Link>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </div>
    </main>
  );
}
