import Link from "next/link";
import { redirect } from "next/navigation";

import { getAdminAuthContext } from "@/lib/admin/auth";
import { logServerError } from "@/lib/server-log";
import { createServiceClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function AdminDashboardPage() {
  const adminCtx = await getAdminAuthContext();
  if (!adminCtx) {
    redirect("/login?next=/admin");
  }

  const serviceClient = createServiceClient();

  // Fetch all canonical operational metrics in parallel
  const [
    pendingGcashRes,
    confirmedOrdersRes,
    processingOrdersRes,
    readyOrdersRes,
    inTransitOrdersRes,
    failedDeliveryRes,
    completedOrdersRes,
    inventoryRes,
    recentAuditRes,
  ] = await Promise.all([
    // 1. Pending GCash Reviews
    serviceClient
      .from("payments")
      .select("*", { count: "exact", head: true })
      .eq("method", "MANUAL_GCASH")
      .eq("status", "SUBMITTED"),

    // 2. Confirmed Orders
    serviceClient
      .from("orders")
      .select("*", { count: "exact", head: true })
      .eq("status", "CONFIRMED"),

    // 3. Processing Orders (PROCESSING, PACKING)
    serviceClient
      .from("orders")
      .select("*", { count: "exact", head: true })
      .in("status", ["PROCESSING", "PACKING"]),

    // 4. Ready for Shipment Orders
    serviceClient
      .from("orders")
      .select("*", { count: "exact", head: true })
      .eq("status", "READY_FOR_SHIPMENT"),

    // 5. In Transit Orders (SHIPPED, IN_TRANSIT, OUT_FOR_DELIVERY)
    serviceClient
      .from("orders")
      .select("*", { count: "exact", head: true })
      .in("status", ["SHIPPED", "IN_TRANSIT", "OUT_FOR_DELIVERY"]),

    // 6. Delivery Failures
    serviceClient
      .from("orders")
      .select("*", { count: "exact", head: true })
      .eq("status", "DELIVERY_FAILED"),

    // 7. Completed / Delivered Orders
    serviceClient
      .from("orders")
      .select("*", { count: "exact", head: true })
      .in("status", ["DELIVERED", "COMPLETED"]),

    // 8 & 9. Inventory Levels for Low Stock & Out of Stock counts
    serviceClient
      .from("inventory")
      .select("variant_id, on_hand, reserved, safety_stock"),

    // 10. Recent Admin Activity from append-only audit_logs
    serviceClient
      .from("audit_logs")
      .select("id, action, entity, actor_role, created_at")
      .order("created_at", { ascending: false })
      .limit(8),
  ]);

  if (
    pendingGcashRes.error ||
    confirmedOrdersRes.error ||
    processingOrdersRes.error ||
    readyOrdersRes.error ||
    inTransitOrdersRes.error ||
    failedDeliveryRes.error ||
    completedOrdersRes.error ||
    inventoryRes.error ||
    recentAuditRes.error
  ) {
    logServerError("admin.dashboard", "database_failure");
    throw new Error("ADMIN_DASHBOARD_UNAVAILABLE");
  }

  const pendingGcashCount = pendingGcashRes.count ?? 0;
  const confirmedCount = confirmedOrdersRes.count ?? 0;
  const processingCount = processingOrdersRes.count ?? 0;
  const readyCount = readyOrdersRes.count ?? 0;
  const inTransitCount = inTransitOrdersRes.count ?? 0;
  const deliveryFailedCount = failedDeliveryRes.count ?? 0;
  const completedCount = completedOrdersRes.count ?? 0;

  // Calculate low stock and out of stock
  let lowStockCount = 0;
  let outOfStockCount = 0;
  for (const inv of inventoryRes.data || []) {
    const available = inv.on_hand - inv.reserved;
    if (available <= 0) {
      outOfStockCount++;
    } else if (available <= inv.safety_stock) {
      lowStockCount++;
    }
  }

  const recentLogs = recentAuditRes.data || [];

  return (
    <div className="admin-page">
      <header className="admin-page-header">
        <h1>Operations Dashboard</h1>
        <p className="subtle-text">
          Live database-backed queues for 7Trumpets commerce operations.
        </p>
      </header>

      {/* Primary Alert Queues */}
      <section aria-labelledby="urgent-queues-title" style={{ marginBottom: "2rem" }}>
        <h2 id="urgent-queues-title" className="admin-section-heading">
          Urgent Action Queues
        </h2>
        <div className="admin-grid-metrics">
          <div className={`admin-card metric-card ${pendingGcashCount > 0 ? "card-highlight" : ""}`}>
            <h3>Pending GCash Reviews</h3>
            <p className="metric-value">{pendingGcashCount}</p>
            <Link href="/admin/payments" className="btn btn-secondary small-btn">
              Review Submissions &rarr;
            </Link>
          </div>

          <div className={`admin-card metric-card ${deliveryFailedCount > 0 ? "card-warning" : ""}`}>
            <h3>Delivery Failures</h3>
            <p className="metric-value">{deliveryFailedCount}</p>
            <Link href="/admin/orders?status=DELIVERY_FAILED" className="btn btn-secondary small-btn">
              Investigate Failures &rarr;
            </Link>
          </div>

          <div className={`admin-card metric-card ${outOfStockCount > 0 ? "card-warning" : ""}`}>
            <h3>Out of Stock Items</h3>
            <p className="metric-value">{outOfStockCount}</p>
            <Link href="/admin/catalog" className="btn btn-secondary small-btn">
              Manage Inventory &rarr;
            </Link>
          </div>

          <div className="admin-card metric-card">
            <h3>Low Stock Warnings</h3>
            <p className="metric-value">{lowStockCount}</p>
            <Link href="/admin/catalog" className="btn btn-secondary small-btn">
              Check Stock &rarr;
            </Link>
          </div>
        </div>
      </section>

      {/* Fulfillment Pipeline Queues */}
      <section aria-labelledby="fulfillment-pipeline-title" style={{ marginBottom: "2rem" }}>
        <h2 id="fulfillment-pipeline-title" className="admin-section-heading">
          Fulfillment Lifecycle Pipeline
        </h2>
        <div className="admin-grid-metrics">
          <div className="admin-card metric-card">
            <h3>Confirmed Orders</h3>
            <p className="metric-value">{confirmedCount}</p>
            <Link href="/admin/orders?status=CONFIRMED" className="btn btn-secondary small-btn">
              View Confirmed &rarr;
            </Link>
          </div>

          <div className="admin-card metric-card">
            <h3>Processing &amp; Packing</h3>
            <p className="metric-value">{processingCount}</p>
            <Link href="/admin/orders?status=PROCESSING" className="btn btn-secondary small-btn">
              View Processing &rarr;
            </Link>
          </div>

          <div className="admin-card metric-card">
            <h3>Ready for Shipment</h3>
            <p className="metric-value">{readyCount}</p>
            <Link href="/admin/orders?status=READY_FOR_SHIPMENT" className="btn btn-secondary small-btn">
              Dispatch Orders &rarr;
            </Link>
          </div>

          <div className="admin-card metric-card">
            <h3>In Transit &amp; Arriving</h3>
            <p className="metric-value">{inTransitCount}</p>
            <Link href="/admin/orders?status=IN_TRANSIT" className="btn btn-secondary small-btn">
              Track Shipments &rarr;
            </Link>
          </div>

          <div className="admin-card metric-card">
            <h3>Delivered / Completed</h3>
            <p className="metric-value">{completedCount}</p>
            <Link href="/admin/orders?status=COMPLETED" className="btn btn-secondary small-btn">
              View History &rarr;
            </Link>
          </div>
        </div>
      </section>

      <div className="admin-grid-layout">
        {/* Recent Admin Activity Log */}
        <div className="admin-main-col">
          <div className="admin-card">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <h2>Recent Administrative Activity</h2>
              <Link href="/admin/audit" className="small-text subtle-text">
                View Full Audit Log &rarr;
              </Link>
            </div>
            {recentLogs.length === 0 ? (
              <p className="subtle-text" style={{ padding: "1rem 0" }}>
                No recent activity recorded.
              </p>
            ) : (
              <div className="admin-table-wrapper" style={{ marginTop: "1rem" }}>
                <table className="admin-table">
                  <thead>
                    <tr>
                      <th>Action</th>
                      <th>Entity</th>
                      <th>Role</th>
                      <th>Time</th>
                    </tr>
                  </thead>
                  <tbody>
                    {recentLogs.map((log) => (
                      <tr key={log.id}>
                        <td><code>{log.action}</code></td>
                        <td>{log.entity}</td>
                        <td>
                          <span className="status-pill status-confirmed">
                            {log.actor_role || "system"}
                          </span>
                        </td>
                        <td>{new Date(log.created_at).toLocaleTimeString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        {/* Shortcuts Card */}
        <div className="admin-side-col">
          <div className="admin-card">
            <h2>Operations Shortcuts</h2>
            <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem", marginTop: "1rem" }}>
              <Link href="/admin/orders" className="btn btn-primary">
                All Orders &amp; Fulfillment
              </Link>
              <Link href="/admin/payments" className="btn btn-primary">
                Manual GCash Queue
              </Link>
              <Link href="/admin/catalog" className="btn btn-secondary">
                Catalog &amp; Inventory Management
              </Link>
              <Link href="/admin/audit" className="btn btn-secondary">
                Immutable Audit Logs
              </Link>
              {adminCtx.role === "super_admin" && (
                <Link href="/admin/users" className="btn btn-secondary">
                  User Roles &amp; AAL2 Access
                </Link>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
