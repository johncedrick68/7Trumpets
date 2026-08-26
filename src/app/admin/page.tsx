import Link from "next/link";
import { redirect } from "next/navigation";

import { getAdminAuthContext } from "@/lib/admin/auth";
import { createServiceClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function AdminDashboardPage() {
  const adminCtx = await getAdminAuthContext();
  if (!adminCtx) {
    redirect("/login?next=/admin");
  }

  const serviceClient = createServiceClient();

  // Fetch operational summary counts
  const [{ count: pendingGcashCount }, { count: unfulfilledOrdersCount }] = await Promise.all([
    serviceClient
      .from("payments")
      .select("*", { count: "exact", head: true })
      .eq("method", "MANUAL_GCASH")
      .eq("status", "SUBMITTED"),
    serviceClient
      .from("orders")
      .select("*", { count: "exact", head: true })
      .in("status", ["CONFIRMED", "PROCESSING", "PACKING", "READY_FOR_SHIPMENT", "SHIPPED", "IN_TRANSIT", "OUT_FOR_DELIVERY"]),
  ]);

  return (
    <div className="admin-page">
      <header className="admin-page-header">
        <h1>Operations Dashboard</h1>
        <p className="subtle-text">Authoritative operations for 7Trumpets commerce platform.</p>
      </header>

      <div className="admin-grid-metrics">
        <div className="admin-card metric-card">
          <h3>Pending GCash Review</h3>
          <p className="metric-value">{pendingGcashCount ?? 0}</p>
          <Link href="/admin/payments" className="btn btn-secondary">
            Review Payments &rarr;
          </Link>
        </div>

        <div className="admin-card metric-card">
          <h3>Active Fulfillment Orders</h3>
          <p className="metric-value">{unfulfilledOrdersCount ?? 0}</p>
          <Link href="/admin/orders" className="btn btn-secondary">
            Manage Orders &rarr;
          </Link>
        </div>
      </div>

      <div className="admin-card quick-actions-card">
        <h2>Operations Shortcuts</h2>
        <div className="button-group" style={{ marginTop: "1rem" }}>
          <Link href="/admin/orders" className="btn btn-primary">
            Order Fulfillment
          </Link>
          <Link href="/admin/payments" className="btn btn-primary">
            Manual GCash Queue
          </Link>
          <Link href="/admin/catalog" className="btn btn-secondary">
            Catalog Status
          </Link>
          <Link href="/admin/audit" className="btn btn-secondary">
            Audit Logs
          </Link>
          {adminCtx.role === "super_admin" && (
            <Link href="/admin/users" className="btn btn-secondary">
              User Roles & AAL2
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}
