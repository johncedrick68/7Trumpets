import Link from "next/link";
import { redirect } from "next/navigation";

import { getAdminAuthContext } from "@/lib/admin/auth";
import { formatMinorUnitsToPHP } from "@/lib/catalog/queries";
import { logServerError } from "@/lib/server-log";
import { createServiceClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

interface SearchParams {
  status?: string;
}

export default async function AdminOrdersListPage({
  searchParams,
}: {
  searchParams?: Promise<SearchParams>;
}) {
  const adminCtx = await getAdminAuthContext();
  if (!adminCtx) {
    redirect("/login?next=/admin/orders");
  }

  const params = searchParams ? await searchParams : {};
  const statusFilter = params.status?.toUpperCase();

  const serviceClient = createServiceClient();

  let query = serviceClient
    .from("orders")
    .select(`
      id,
      order_number,
      customer_email,
      recipient_name,
      status,
      total_minor,
      placed_at,
      payments (
        method,
        status
      )
    `)
    .order("placed_at", { ascending: false })
    .limit(100);

  if (statusFilter) {
    if (statusFilter === "PROCESSING") {
      query = query.in("status", ["PROCESSING", "PACKING"]);
    } else if (statusFilter === "IN_TRANSIT") {
      query = query.in("status", ["SHIPPED", "IN_TRANSIT", "OUT_FOR_DELIVERY"]);
    } else if (statusFilter === "COMPLETED") {
      query = query.in("status", ["DELIVERED", "COMPLETED"]);
    } else {
      query = query.eq("status", statusFilter);
    }
  }

  const { data: orders, error: ordersError } = await query;

  if (ordersError) {
    logServerError("admin.orders.list", "database_failure");
    throw new Error("ADMIN_ORDERS_UNAVAILABLE");
  }
  const orderList = orders || [];

  return (
    <div className="admin-page">
      <header className="admin-page-header">
        <h1>Orders &amp; Fulfillment</h1>
        <p className="subtle-text">Operational order management and status transitions.</p>
      </header>

      {/* Filter Tabs */}
      <nav aria-label="Order status filter" style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem", marginBottom: "1.5rem" }}>
        <Link href="/admin/orders" className={`category-pill ${!statusFilter ? "active" : ""}`}>
          All Orders
        </Link>
        <Link href="/admin/orders?status=CONFIRMED" className={`category-pill ${statusFilter === "CONFIRMED" ? "active" : ""}`}>
          Confirmed
        </Link>
        <Link href="/admin/orders?status=PROCESSING" className={`category-pill ${statusFilter === "PROCESSING" ? "active" : ""}`}>
          Processing / Packing
        </Link>
        <Link href="/admin/orders?status=READY_FOR_SHIPMENT" className={`category-pill ${statusFilter === "READY_FOR_SHIPMENT" ? "active" : ""}`}>
          Ready for Shipment
        </Link>
        <Link href="/admin/orders?status=IN_TRANSIT" className={`category-pill ${statusFilter === "IN_TRANSIT" ? "active" : ""}`}>
          In Transit / Out for Delivery
        </Link>
        <Link href="/admin/orders?status=DELIVERY_FAILED" className={`category-pill ${statusFilter === "DELIVERY_FAILED" ? "active" : ""}`}>
          Delivery Failed
        </Link>
        <Link href="/admin/orders?status=COMPLETED" className={`category-pill ${statusFilter === "COMPLETED" ? "active" : ""}`}>
          Delivered / Completed
        </Link>
      </nav>

      <div className="admin-card">
        <h2>
          {statusFilter ? `${statusFilter} Orders` : "All Orders"} ({orderList.length})
        </h2>

        {orderList.length === 0 ? (
          <p className="subtle-text" style={{ padding: "1.5rem 0" }}>
            No orders found matching the filter criteria.
          </p>
        ) : (
          <div className="admin-table-wrapper">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Order #</th>
                  <th>Date</th>
                  <th>Customer</th>
                  <th>Payment</th>
                  <th>Status</th>
                  <th>Total</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {orderList.map((order) => {
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  const payment = (order.payments as any)?.[0];

                  return (
                    <tr key={order.id}>
                      <td>
                        <strong>{order.order_number}</strong>
                      </td>
                      <td>{new Date(order.placed_at).toLocaleDateString()}</td>
                      <td>
                        <div>{order.recipient_name}</div>
                        <div className="subtle-text small-text">{order.customer_email}</div>
                      </td>
                      <td>
                        {payment ? (
                          <div>
                            <div>{payment.method === "MANUAL_GCASH" ? "Manual GCash" : "Cash on Delivery"}</div>
                            <span className={`status-pill status-${payment.status.toLowerCase()}`}>
                              {payment.status}
                            </span>
                          </div>
                        ) : (
                          <span className="subtle-text">None</span>
                        )}
                      </td>
                      <td>
                        <span className={`status-pill status-${order.status.toLowerCase()}`}>
                          {order.status}
                        </span>
                      </td>
                      <td><strong>{formatMinorUnitsToPHP(order.total_minor)}</strong></td>
                      <td>
                        <Link href={`/admin/orders/${order.id}`} className="btn btn-secondary small-btn">
                          Manage &rarr;
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
