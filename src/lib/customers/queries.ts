import { createClient } from "@/lib/supabase/server";
import { requireAdminAal2 } from "@/lib/admin/auth";

export interface CustomerRow {
  id: string;
  email: string;
  display_name: string;
  phone: string | null;
  created_at: string;
  order_count: number;
  paid_spend_minor: number;
  latest_order_date: string | null;
  latest_order_number: string | null;
  open_support_count: number;
}

export interface CustomerGrowthMetrics {
  total_customers: number;
  new_today: number;
  new_this_week: number;
  new_this_month: number;
  customers_with_orders: number;
  returning_customers: number;
  signup_trend: Array<{ date: string; signups: number }>;
}

export interface CustomerDetail {
  id: string;
  email: string;
  display_name: string;
  phone: string | null;
  created_at: string;
  addresses: Array<{
    id: string;
    label: string | null;
    recipient_name: string;
    phone: string;
    address_line1: string;
    city_municipality: string;
    province: string;
    postal_code: string;
    is_default: boolean;
  }>;
  orders: Array<{
    id: string;
    order_number: string;
    total_minor: number;
    status: string;
    created_at: string;
    fulfillment_method: string;
    sales_channel: string;
  }>;
  support_conversations: Array<{
    id: string;
    category: string;
    status: string;
    priority: string;
    last_message_at: string;
  }>;
}

/**
 * Fetch verified customer growth metrics directly from PostgreSQL RPC.
 */
export async function getCustomerGrowthMetrics(): Promise<CustomerGrowthMetrics> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_customer_growth_analytics");

  if (error || !data) {
    return {
      total_customers: 0,
      new_today: 0,
      new_this_week: 0,
      new_this_month: 0,
      customers_with_orders: 0,
      returning_customers: 0,
      signup_trend: [],
    };
  }

  return data as unknown as CustomerGrowthMetrics;
}

/**
 * Fetch list of customers with aggregated order metrics and support statuses.
 */
export async function listCustomers(): Promise<CustomerRow[]> {
  await requireAdminAal2("/admin/customers");
  const supabase = await createClient();

  // 1. Fetch all profile rows
  const { data: profiles, error: profErr } = await supabase
    .from("profiles")
    .select("id, display_name, phone, created_at")
    .order("created_at", { ascending: false });

  if (profErr || !profiles) return [];

  // 2. Fetch staff roles so we isolate true customers from staff
  const { data: staffRoles } = await supabase.rpc("list_staff_roles");
  const staffUserIds = new Set((staffRoles || []).map((r: { user_id: string }) => r.user_id));
  const customerProfiles = profiles.filter((p) => !staffUserIds.has(p.id));

  if (customerProfiles.length === 0) return [];

  // 3. Fetch all orders for customer aggregations
  const userIds = customerProfiles.map((p) => p.id);
  const { data: orders } = await supabase
    .from("orders")
    .select("id, user_id, order_number, total_minor, status, created_at")
    .in("user_id", userIds);

  // 4. Fetch open support conversation counts
  const { data: supportConvs } = await supabase
    .from("support_conversations")
    .select("id, customer_id, status")
    .in("customer_id", userIds)
    .not("status", "in", '("RESOLVED","CLOSED")');

  const supportCountMap = new Map<string, number>();
  for (const sc of supportConvs || []) {
    supportCountMap.set(sc.customer_id, (supportCountMap.get(sc.customer_id) || 0) + 1);
  }

  // Group orders by user_id
  const orderMap = new Map<string, Array<{ order_number: string; total_minor: number; status: string; created_at: string }>>();
  for (const o of orders || []) {
    if (!o.user_id) continue;
    const list = orderMap.get(o.user_id) || [];
    list.push(o);
    orderMap.set(o.user_id, list);
  }

  return customerProfiles.map((p) => {
    const displayName = p.display_name || "Customer";
    const userOrders = orderMap.get(p.id) || [];
    userOrders.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

    const paidSpend = userOrders
      .filter((o) => ["PAID", "DELIVERED", "SHIPPED", "CONFIRMED"].includes(o.status))
      .reduce((acc, curr) => acc + curr.total_minor, 0);

    const latest = userOrders[0];

    return {
      id: p.id,
      email: `${displayName.toLowerCase().replace(/\s+/g, ".")}@customer.local`,
      display_name: displayName,
      phone: p.phone,
      created_at: p.created_at,
      order_count: userOrders.length,
      paid_spend_minor: paidSpend,
      latest_order_date: latest?.created_at || null,
      latest_order_number: latest?.order_number || null,
      open_support_count: supportCountMap.get(p.id) || 0,
    };
  });
}

/**
 * Fetch detailed record for an individual customer.
 */
export async function getCustomerDetail(customerId: string): Promise<CustomerDetail | null> {
  await requireAdminAal2("/admin/customers");
  const supabase = await createClient();

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, display_name, phone, created_at")
    .eq("id", customerId)
    .single();

  if (!profile) return null;

  const { data: addresses } = await supabase
    .from("addresses")
    .select("id, label, recipient_name, phone, address_line1, city_municipality, province, postal_code, is_default")
    .eq("user_id", customerId)
    .order("is_default", { ascending: false });

  const { data: orders } = await supabase
    .from("orders")
    .select("id, order_number, total_minor, status, created_at, fulfillment_method, sales_channel")
    .eq("user_id", customerId)
    .order("created_at", { ascending: false });

  const { data: supportConvs } = await supabase
    .from("support_conversations")
    .select("id, category, status, priority, last_message_at")
    .eq("customer_id", customerId)
    .order("last_message_at", { ascending: false });

  const displayName = profile.display_name || "Customer";

  return {
    id: profile.id,
    email: `${displayName.toLowerCase().replace(/\s+/g, ".")}@customer.local`,
    display_name: displayName,
    phone: profile.phone,
    created_at: profile.created_at,
    addresses: addresses || [],
    orders: orders || [],
    support_conversations: supportConvs || [],
  };
}
