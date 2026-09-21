import { createServiceClient } from "@/lib/supabase/server";
import { formatMinorUnitsToPHP } from "@/lib/money";
import { callGemini } from "@/lib/ai/gemini";

/**
 * Predefined read-only operational tools for Admin "Ask 1968".
 * Gemini interprets these verified database facts; it NEVER generates arbitrary SQL.
 */

export async function getAdminAttentionSummary() {
  const serviceClient = createServiceClient();

  const [gcashRes, unfulfilledRes, supportRes, lowStockRes] = await Promise.all([
    serviceClient.from("payment_submissions").select("id", { count: "exact", head: true }).in("review_status", ["PENDING", "VERIFYING"]),
    serviceClient.from("orders").select("id", { count: "exact", head: true }).in("status", ["CONFIRMED", "PROCESSING", "PACKING", "READY_FOR_SHIPMENT"]),
    serviceClient.from("support_conversations").select("id", { count: "exact", head: true }).in("status", ["OPEN", "WAITING_FOR_STAFF"]),
    serviceClient.from("inventory").select("variant_id, on_hand, reserved"),
  ]);

  const pendingGcash = gcashRes.count || 0;
  const unfulfilledOrders = unfulfilledRes.count || 0;
  const openSupport = supportRes.count || 0;

  const lowStockCount = (lowStockRes.data || []).filter(
    (inv) => (inv.on_hand - inv.reserved) <= 3
  ).length;

  return {
    pending_gcash_verifications: pendingGcash,
    orders_needing_fulfillment: unfulfilledOrders,
    support_tickets_needing_staff: openSupport,
    critical_low_stock_variants: lowStockCount,
  };
}

export async function getSalesSummary(period: "today" | "7d" | "30d" = "today") {
  const serviceClient = createServiceClient();
  const now = new Date();
  let since = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();

  if (period === "7d") {
    since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  } else if (period === "30d") {
    since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
  }

  const { data: orders } = await serviceClient
    .from("orders")
    .select("total_minor, status")
    .gte("placed_at", since)
    .in("status", ["PAID", "DELIVERED", "SHIPPED", "CONFIRMED"]);

  const orderList = orders || [];
  const totalSalesMinor = orderList.reduce((acc, curr) => acc + curr.total_minor, 0);
  const orderCount = orderList.length;
  const aovMinor = orderCount > 0 ? Math.round(totalSalesMinor / orderCount) : 0;

  return {
    period,
    paid_orders_count: orderCount,
    total_sales: formatMinorUnitsToPHP(totalSalesMinor),
    average_order_value: formatMinorUnitsToPHP(aovMinor),
  };
}

export async function getInventoryRisks() {
  const serviceClient = createServiceClient();

  const { data } = await serviceClient
    .from("product_variants")
    .select(`
      sku, name,
      products:product_id (name),
      inventory (on_hand, reserved)
    `)
    .eq("status", "active");

  const atRisk = (data || [])
    .map((v) => {
      const raw = v as unknown as {
        sku: string;
        name: string | null;
        products: { name: string } | null;
        inventory: Array<{ on_hand: number; reserved: number }> | { on_hand: number; reserved: number } | null;
      };
      const inv = Array.isArray(raw.inventory) ? raw.inventory[0] : raw.inventory;
      const onHand = inv?.on_hand || 0;
      const reserved = inv?.reserved || 0;
      const available = onHand - reserved;
      return {
        product: raw.products?.name || "Garment",
        variant: raw.name || raw.sku,
        sku: raw.sku,
        available,
        reserved,
      };
    })
    .filter((v) => v.available <= 5)
    .sort((a, b) => a.available - b.available);

  return {
    total_at_risk_variants: atRisk.length,
    critical_items: atRisk.slice(0, 10),
  };
}

export async function getSupportQueueSummary() {
  const serviceClient = createServiceClient();

  const { data: convs } = await serviceClient
    .from("support_conversations")
    .select("id, category, priority, status, created_at")
    .not("status", "in", '("RESOLVED","CLOSED")');

  const list = convs || [];
  const waitingForStaff = list.filter((c) => c.status === "WAITING_FOR_STAFF" || c.status === "OPEN").length;
  const urgentCount = list.filter((c) => c.priority === "URGENT" || c.priority === "HIGH").length;

  return {
    total_open_tickets: list.length,
    needs_staff_attention: waitingForStaff,
    high_or_urgent_tickets: urgentCount,
  };
}

/**
 * Handle Ask 1968 user inquiry with tool retrieval.
 */
export async function answerAdminInquiry(question: string) {
  // Pre-fetch key operational facts so Gemini can synthesize immediately
  const [attention, salesToday, sales7d, inventory, support] = await Promise.all([
    getAdminAttentionSummary(),
    getSalesSummary("today"),
    getSalesSummary("7d"),
    getInventoryRisks(),
    getSupportQueueSummary(),
  ]);

  const verifiedOperationalFacts = JSON.stringify({
    attention_items: attention,
    sales_today: salesToday,
    sales_last_7_days: sales7d,
    inventory_risks: inventory,
    support_queue: support,
  });

  const systemInstruction = `You are "Ask 1968", the executive intelligence assistant for 1968 Clothing.
Your role is to analyze verified operational data from the store and provide actionable, executive-level summaries for the store operator.
Tone: Concise, data-driven, strategic, and professional.
RULES:
1. Ground your answer ONLY on the verified operational facts provided. Never invent numbers, revenues, or inventory.
2. Highlight immediate bottlenecks (e.g. pending GCash reviews, unfulfilled orders, stockouts).
3. If the user asks about something not in the data, state clearly what data is available.`;

  const prompt = `Verified Operational Facts:
${verifiedOperationalFacts}

Admin Inquiry: "${question}"

Provide an executive briefing:`;

  const geminiRes = await callGemini({
    feature: "ask_1968",
    prompt,
    systemInstruction,
    model: "gemini-3.8-flash",
    temperature: 0.2,
  });

  return geminiRes.text;
}
