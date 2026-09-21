import { createServiceClient } from "@/lib/supabase/server";
import { getCourierTrackingUrl, getCourierDisplayName } from "@/lib/orders/courier";
import { formatMinorUnitsToPHP } from "@/lib/money";

/**
 * Read-only tool: Get customer order summary.
 * Validates ownership: only returns order facts if order belongs to customerId.
 */
export async function getCustomerOrderSummary(orderId: string, customerId: string) {
  const serviceClient = createServiceClient();

  const { data: order } = await serviceClient
    .from("orders")
    .select(`
      id, order_number, status, total_minor, fulfillment_method, placed_at,
      order_items (product_name, variant_name, quantity, unit_price_minor)
    `)
    .eq("id", orderId)
    .eq("user_id", customerId)
    .single();

  if (!order) {
    return { error: "Order not found or does not belong to this account." };
  }

  return {
    order_number: order.order_number,
    status: order.status,
    fulfillment_method: order.fulfillment_method,
    placed_at: order.placed_at,
    total: formatMinorUnitsToPHP(order.total_minor),
    items: (order.order_items || []).map((item) => {
      const row = item as { product_name: string; variant_name: string | null; quantity: number; unit_price_minor: number };
      return {
        name: row.product_name,
        variant: row.variant_name,
        quantity: row.quantity,
        price: formatMinorUnitsToPHP(row.unit_price_minor),
      };
    }),
  };
}

/**
 * Read-only tool: Get customer order tracking information.
 */
export async function getCustomerTracking(orderId: string, customerId: string) {
  const serviceClient = createServiceClient();

  const { data: order } = await serviceClient
    .from("orders")
    .select("id, order_number, status, user_id")
    .eq("id", orderId)
    .eq("user_id", customerId)
    .single();

  if (!order) {
    return { error: "Order not found or does not belong to this account." };
  }

  const { data: shipment } = await serviceClient
    .from("shipments")
    .select("provider, tracking_number, tracking_url, status, shipped_at, carrier_notes")
    .eq("order_id", orderId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!shipment) {
    return {
      order_number: order.order_number,
      order_status: order.status,
      shipment_status: "Awaiting dispatch / Not yet shipped",
    };
  }

  const trackingUrl = shipment.tracking_url
    ? shipment.tracking_url
    : getCourierTrackingUrl(shipment.provider, shipment.tracking_number);

  return {
    order_number: order.order_number,
    courier: getCourierDisplayName(shipment.provider),
    tracking_number: shipment.tracking_number || "Pending",
    tracking_url: trackingUrl,
    shipment_status: shipment.status,
    shipped_at: shipment.shipped_at,
    carrier_notes: shipment.carrier_notes,
  };
}

/**
 * Read-only tool: Check product stock and variant availability.
 */
export async function getProductAvailability(slugOrId: string) {
  const serviceClient = createServiceClient();

  let { data: product } = await serviceClient
    .from("products")
    .select("id, name, slug, description, status")
    .eq("slug", slugOrId)
    .maybeSingle();

  if (!product) {
    const res = await serviceClient
      .from("products")
      .select("id, name, slug, description, status")
      .eq("id", slugOrId)
      .maybeSingle();
    product = res.data;
  }

  if (!product || product.status !== "active") {
    return { error: "Product not found or currently inactive." };
  }

  const { data: variants } = await serviceClient
    .from("product_variants")
    .select(`
      id, sku, name, price_minor, status,
      inventory (on_hand, reserved)
    `)
    .eq("product_id", product.id)
    .eq("status", "active");

  return {
    product_name: product.name,
    slug: product.slug,
    variants: (variants || []).map((v) => {
      const raw = v as unknown as {
        name: string | null;
        sku: string;
        price_minor: number;
        inventory: Array<{ on_hand: number; reserved: number }> | { on_hand: number; reserved: number } | null;
      };
      const inv = Array.isArray(raw.inventory) ? raw.inventory[0] : raw.inventory;
      const onHand = inv?.on_hand || 0;
      const reserved = inv?.reserved || 0;
      const available = Math.max(onHand - reserved, 0);
      return {
        variant: raw.name || raw.sku,
        sku: raw.sku,
        price: formatMinorUnitsToPHP(Number(raw.price_minor)),
        in_stock: available > 0,
        available_quantity: available,
      };
    }),
  };
}

/**
 * Read-only tool: Retrieve store policies from store_settings.
 */
export async function getStorePolicy(topic: "shipping" | "payment" | "returns" | "pickup") {
  const serviceClient = createServiceClient();

  if (topic === "shipping" || topic === "pickup") {
    const { data } = await serviceClient.from("store_settings").select("value").eq("key", "fulfillment").single();
    const val = data?.value as Record<string, unknown> | null;
    return {
      standard_shipping_fee: val ? formatMinorUnitsToPHP(Number(val.shipping_fee_minor || 15000)) : "₱150.00",
      free_shipping_threshold: val ? formatMinorUnitsToPHP(Number(val.free_shipping_threshold_minor || 350000)) : "₱3,500.00",
      store_pickup_available: Boolean(val?.allow_store_pickup ?? true),
      pickup_address: String(val?.pickup_address || "1968 Flagship Store, Makati City"),
    };
  }

  if (topic === "payment") {
    const { data } = await serviceClient.from("store_settings").select("value").eq("key", "payment").single();
    const val = data?.value as Record<string, unknown> | null;
    return {
      gcash_accepted: Boolean(val?.gcash_enabled ?? true),
      gcash_number: String(val?.gcash_number || "0917-196-8000"),
      gcash_name: String(val?.gcash_account_name || "1968 CLOTHING PH"),
      cod_accepted: Boolean(val?.cod_enabled ?? true),
      instructions: "For GCash, transfer the exact order amount and upload screenshot proof on your order details page.",
    };
  }

  if (topic === "returns") {
    return {
      policy: "1968 Clothing allows size exchanges and returns within 7 calendar days of delivery for unwashed, unworn garments with tags attached.",
      process: "Request return from your Order Details page or chat with support.",
    };
  }

  return { error: "Unknown policy topic" };
}

/**
 * Read-only tool: Check if order is eligible for return.
 */
export async function getReturnEligibility(orderId: string, customerId: string) {
  const serviceClient = createServiceClient();

  const { data: order } = await serviceClient
    .from("orders")
    .select("id, order_number, status, placed_at")
    .eq("id", orderId)
    .eq("user_id", customerId)
    .single();

  if (!order) {
    return { error: "Order not found" };
  }

  if (order.status !== "DELIVERED") {
    return {
      eligible: false,
      reason: `Order is currently in ${order.status} status. Returns can only be requested after delivery.`,
    };
  }

  return {
    eligible: true,
    order_number: order.order_number,
    instructions: "Garment must be in original condition with tags. Submit a return request on your Order Details page.",
  };
}
