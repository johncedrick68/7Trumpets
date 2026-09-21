"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { getOrCreateCart } from "@/lib/cart/actions";
import { logServerError } from "@/lib/server-log";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { getStoreSetting } from "@/lib/settings/queries";
import { calculateShippingMinor } from "@/lib/checkout/shipping";

export async function processCheckout(formData: FormData) {
  const addressId = formData.get("address_id") as string;
  const paymentMethod = formData.get("payment_method") as string;
  const idempotencyKey = (formData.get("idempotency_key") as string)?.trim();
  const customerNoteRaw = (formData.get("customer_note") as string)?.trim();
  const customerNote = customerNoteRaw && customerNoteRaw.length > 0 ? customerNoteRaw : undefined;
  const fulfillmentMethod = (formData.get("fulfillment_method") as string)?.trim() || "SHIPMENT";

  if (!addressId || !paymentMethod || !idempotencyKey) {
    redirect("/checkout?error=missing_fields");
  }

  if (idempotencyKey.length < 16 || idempotencyKey.length > 128 || !/^[A-Za-z0-9_.-]+$/.test(idempotencyKey)) {
    redirect("/checkout?error=invalid_idempotency_key");
  }

  if (fulfillmentMethod === "STORE_PICKUP") {
    if (paymentMethod !== "CASH" && paymentMethod !== "MANUAL_GCASH") {
      redirect("/checkout?error=invalid_payment_method");
    }
  } else if (fulfillmentMethod === "SHIPMENT") {
    if (paymentMethod !== "COD" && paymentMethod !== "MANUAL_GCASH") {
      redirect("/checkout?error=invalid_payment_method");
    }
  } else {
    redirect("/checkout?error=invalid_fulfillment_method");
  }

  const supabase = await createClient();
  const { data: claimsData } = await supabase.auth.getClaims();
  const userId = claimsData?.claims?.sub;
  if (!userId) {
    redirect("/login?next=/checkout");
  }

  const { data: userData } = await supabase.auth.getUser();
  const userEmail = userData?.user?.email;
  if (!userEmail) {
    redirect("/login?next=/checkout");
  }

  const { data: checkoutAllowed, error: throttleError } = await supabase.rpc(
    "allow_checkout_attempt",
    { p_idempotency_key: idempotencyKey },
  );
  if (throttleError || !checkoutAllowed) {
    if (throttleError) logServerError("checkout.throttle", "database_failure");
    redirect("/checkout?error=checkout_throttled");
  }

  // 1. Fetch user's cart
  const cart = await getOrCreateCart();
  if (!cart || cart.items.length === 0) {
    redirect("/cart?error=cart_empty");
  }

  // 2. Fetch chosen address owned by user
  const { data: address, error: addressError } = await supabase
    .from("addresses")
    .select("*")
    .eq("id", addressId)
    .eq("user_id", userId)
    .single();

  if (addressError || !address) {
    redirect("/checkout?error=invalid_address");
  }

  // 3. Build canonical RPC input payloads
  const linesPayload = cart.items.map((item) => ({
    variant_id: item.variant_id,
    quantity: item.quantity,
  }));

  const deliveryPayload = {
    customer_email: userEmail,
    recipient_name: address.recipient_name,
    recipient_phone: address.phone,
    address_line1: address.address_line1,
    address_line2: address.address_line2 || undefined,
    barangay: address.barangay || undefined,
    city_municipality: address.city_municipality,
    province: address.province,
    postal_code: address.postal_code,
    country_code: address.country_code || "PH",
  };

  // Re-read the trusted setting during submission; browser totals are never authoritative.
  const fulfillmentSettings = await getStoreSetting<{ shipping_fee_minor: number; free_shipping_threshold_minor?: number }>(
    "fulfillment",
    { shipping_fee_minor: 15000, free_shipping_threshold_minor: 350000 },
  );
  const shippingMinor = calculateShippingMinor(
    cart.subtotal_minor,
    fulfillmentMethod as "SHIPMENT" | "STORE_PICKUP",
    fulfillmentSettings,
  );

  // MANUAL_GCASH expires in 2 hours (120 minutes); COD expires_at is null
  const gcashExpiresAt =
    paymentMethod === "MANUAL_GCASH"
      ? new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString()
      : undefined;

  // 4. Execute atomic RPC via service role client
  const serviceClient = createServiceClient();
  const { data: order, error: rpcError } = await serviceClient.rpc("checkout_order", {
    p_customer_id: userId,
    p_idempotency_key: idempotencyKey,
    p_lines: linesPayload,
    p_shipping_minor: shippingMinor,
    p_payment_method: paymentMethod,
    p_fulfillment_method: fulfillmentMethod,
    p_gcash_expires_at: gcashExpiresAt as unknown as string,
    p_delivery: deliveryPayload,
    p_customer_note: customerNote,
  });

  if (rpcError || !order) {
    redirect("/checkout?error=checkout_failed");
  }

  // 5. Clear the user's cart items upon successful order creation
  const { error: cleanupError } = await supabase.from("cart_items").delete().eq("cart_id", cart.id);
  if (cleanupError) logServerError("checkout.cart_cleanup", "database_failure");

  revalidatePath("/cart");
  revalidatePath("/orders");
  redirect(`/orders/${order.id}`);
}
