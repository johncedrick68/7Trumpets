import { redirect } from "next/navigation";

import { getAdminAuthContext } from "@/lib/admin/auth";
import { logServerError } from "@/lib/server-log";
import { createServiceClient } from "@/lib/supabase/server";
import { Badge } from "@/components/ui/badge";
import { OrdersWorkspace, AdminOrderSummary } from "@/components/admin/orders-workspace";
import { AdminPageHeader } from "@/components/admin/admin-page-header";

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
      recipient_phone,
      address_line1,
      city_municipality,
      province,
      status,
      total_minor,
      placed_at,
      payments (
        method,
        status,
        payment_submissions (
          reference_number
        )
      ),
      shipments (
        tracking_number,
        provider
      ),
      order_items (
        id,
        product_name,
        variant_name,
        quantity,
        line_total_minor
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
    } else if (statusFilter !== "ALL") {
      query = query.eq("status", statusFilter);
    }
  }

  const { data: orders, error: ordersError } = await query;

  if (ordersError) {
    logServerError("admin.orders.list", "database_failure");
    throw new Error("ADMIN_ORDERS_UNAVAILABLE");
  }

  const orderList = (orders || []) as unknown as AdminOrderSummary[];

  return (
    <div className="space-y-6">
      <AdminPageHeader
        eyebrow="Operations"
        title="Orders & Fulfillment"
        description="Filter, inspect, and safely move orders through fulfillment."
        actions={<Badge variant="outline" className="font-mono text-xs">{orderList.length} orders loaded</Badge>}
      />

      <OrdersWorkspace orders={orderList} initialStatusFilter={statusFilter || "ALL"} />
    </div>
  );
}
