import Link from "next/link";
import { redirect } from "next/navigation";

import { getAdminAuthContext } from "@/lib/admin/auth";
import { formatMinorUnitsToPHP } from "@/lib/catalog/queries";
import { createServiceClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function AdminOrdersListPage() {
  const adminCtx = await getAdminAuthContext();
  if (!adminCtx) {
    redirect("/login?next=/admin/orders");
  }

  const serviceClient = createServiceClient();

  const { data: orders } = await serviceClient
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

  const orderList = orders || [];

  return (
    <div className="admin-page">
      <header className="admin-page-header">
        <h1>Orders & Fulfillment</h1>
        <p className="subtle-text">Operational order management and status transitions.</p>
      </header>

      <div className="admin-card">
        <h2>All Orders ({orderList.length})</h2>

        {orderList.length === 0 ? (
          <p className="subtle-text" style={{ padding: "1.5rem 0" }}>
            No orders found in database.
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
