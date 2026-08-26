import Link from "next/link";
import { redirect } from "next/navigation";
import { formatMinorUnitsToPHP } from "@/lib/catalog/queries";
import { deriveCustomerFulfillmentStage } from "@/lib/orders/status";
import { logServerError } from "@/lib/server-log";
import { createClient } from "@/lib/supabase/server";
import { PackageIcon, ArrowRightIcon } from "@/components/icons";

export const dynamic = "force-dynamic";

export default async function OrderHistoryPage() {
  const supabase = await createClient();
  const { data: claimsData } = await supabase.auth.getClaims();
  const userId = claimsData?.claims?.sub;
  if (!userId) {
    redirect("/login?next=/orders");
  }

  // Fetch all orders owned by user, sorted by placed_at descending
  const { data: orders, error: ordersError } = await supabase
    .from("orders")
    .select("id, order_number, status, total_minor, placed_at, shipping_minor")
    .eq("user_id", userId)
    .order("placed_at", { ascending: false });

  if (ordersError) {
    logServerError("orders.list", "database_failure");
    throw new Error("ORDERS_UNAVAILABLE");
  }
  const orderList = orders || [];

  return (
    <main className="catalog-main">
      <div className="catalog-container" style={{ maxWidth: "860px" }}>
        <header style={{ marginBottom: "1.75rem" }}>
          <p className="eyebrow">Customer Account</p>
          <h1 style={{ fontSize: "2rem", fontWeight: 800, margin: "0 0 0.25rem", letterSpacing: "-0.02em" }}>
            Order History
          </h1>
          <p style={{ color: "var(--ink-secondary)", fontSize: "14px", margin: 0 }}>
            View and track your 1968 Clothing archival orders.
          </p>
        </header>

        {/* Account Sub-Navigation Tabs */}
        <nav className="account-tabs" aria-label="Account navigation">
          <Link href="/account" className="account-tab">
            Profile Settings
          </Link>
          <Link href="/orders" className="account-tab active">
            Order History
          </Link>
          <Link href="/account/addresses" className="account-tab">
            Saved Addresses
          </Link>
          <Link href="/update-password" className="account-tab">
            Password &amp; Security
          </Link>
          <Link href="/cart" className="account-tab">
            Shopping Bag
          </Link>
        </nav>

        {orderList.length === 0 ? (
          <div className="card-surface" style={{ textAlign: "center", padding: "4rem 1.5rem" }}>
            <div style={{ display: "inline-flex", justifyContent: "center", marginBottom: "1rem", color: "var(--ink-muted)" }}>
              <PackageIcon size={40} />
            </div>
            <h2 style={{ fontSize: "1.25rem", fontWeight: 700, margin: "0 0 0.5rem" }}>No orders placed yet</h2>
            <p style={{ color: "var(--ink-secondary)", margin: "0 0 1.5rem", fontSize: "14px" }}>
              Explore our current Drop 01 streetwear releases.
            </p>
            <Link href="/products" className="btn btn-primary" style={{ gap: "0.5rem" }}>
              <span>Explore Collection</span>
              <ArrowRightIcon size={14} />
            </Link>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
            {orderList.map((order) => {
              const stageInfo = deriveCustomerFulfillmentStage(order.status);
              return (
                <article key={order.id} className="card-surface" style={{ padding: "1.5rem" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "0.5rem", marginBottom: "0.85rem" }}>
                    <div>
                      <h2 style={{ fontSize: "1.1rem", fontWeight: 700, margin: "0 0 0.25rem" }}>
                        <Link href={`/orders/${order.id}`} style={{ textDecoration: "underline" }}>
                          Order #{order.order_number}
                        </Link>
                      </h2>
                      <p style={{ fontSize: "12px", fontFamily: "var(--font-mono)", color: "var(--ink-muted)", margin: 0 }}>
                        Placed on{" "}
                        {new Date(order.placed_at).toLocaleDateString("en-PH", {
                          year: "numeric",
                          month: "long",
                          day: "numeric",
                        })}
                      </p>
                    </div>
                    <span className="status-pill status-confirmed">
                      {stageInfo.label}
                    </span>
                  </div>

                  <p style={{ fontSize: "13px", color: "var(--ink-secondary)", margin: "0 0 1.25rem" }}>
                    {stageInfo.description}
                  </p>

                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderTop: "1px solid var(--border)", paddingTop: "1rem", flexWrap: "wrap", gap: "0.75rem" }}>
                    <div>
                      <span style={{ fontSize: "12px", color: "var(--ink-muted)", fontFamily: "var(--font-mono)" }}>TOTAL: </span>
                      <strong style={{ fontSize: "1.1rem", fontFamily: "var(--font-mono)" }}>
                        {formatMinorUnitsToPHP(order.total_minor)}
                      </strong>
                    </div>
                    <Link href={`/orders/${order.id}`} className="btn btn-secondary small-btn" style={{ gap: "0.4rem" }}>
                      <span>View Order Details &amp; Tracking</span>
                      <ArrowRightIcon size={12} />
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
