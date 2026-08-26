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
      <div className="catalog-container">
        <header className="admin-page-header">
          <p className="eyebrow">My Account</p>
          <h1>Order History</h1>
          <p style={{ color: "var(--muted)", margin: "0.25rem 0 0" }}>View and track all your 1968 Clothing streetwear orders.</p>
        </header>

        {orderList.length === 0 ? (
          <div style={{ textAlign: "center", padding: "4rem 1.5rem", background: "var(--surface)", border: "1px solid var(--line)", borderRadius: "var(--radius)" }}>
            <div style={{ display: "inline-flex", justifyContent: "center", marginBottom: "1rem", color: "var(--muted)" }}>
              <PackageIcon size={44} />
            </div>
            <h2>No orders found</h2>
            <p style={{ color: "var(--muted)", margin: "0.5rem 0 1.5rem" }}>You haven&apos;t placed any orders yet.</p>
            <Link href="/products" className="btn btn-primary" style={{ gap: "0.5rem" }}>
              <span>Explore Collection</span>
              <ArrowRightIcon size={16} />
            </Link>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
            {orderList.map((order) => {
              const stageInfo = deriveCustomerFulfillmentStage(order.status);
              return (
                <article key={order.id} style={{ padding: "1.5rem", background: "var(--surface)", border: "1px solid var(--line)", borderRadius: "var(--radius)" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "0.5rem", marginBottom: "1rem" }}>
                    <div>
                      <h2 style={{ fontSize: "1.15rem", fontWeight: 700, margin: "0 0 0.25rem" }}>
                        <Link href={`/orders/${order.id}`}>Order #{order.order_number}</Link>
                      </h2>
                      <p style={{ fontSize: "0.85rem", color: "var(--muted)", margin: 0 }}>
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

                  <p style={{ fontSize: "0.9rem", color: "var(--muted)", margin: "0 0 1.25rem" }}>{stageInfo.description}</p>

                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderTop: "1px solid var(--line)", paddingTop: "1rem", flexWrap: "wrap", gap: "0.75rem" }}>
                    <div>
                      <span style={{ fontSize: "0.85rem", color: "var(--muted)" }}>Total: </span>
                      <strong style={{ fontSize: "1.1rem" }}>
                        {formatMinorUnitsToPHP(order.total_minor)}
                      </strong>
                    </div>
                    <Link href={`/orders/${order.id}`} className="btn btn-secondary small-btn" style={{ gap: "0.4rem" }}>
                      <span>View Order Details &amp; Tracking</span>
                      <ArrowRightIcon size={14} />
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
