"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { getOrCreateCart } from "@/lib/cart/actions";
import { executeCheckoutOrder } from "@/lib/checkout/pipeline";
import { getGcashConfig } from "@/lib/payments/config";
import { logServerError } from "@/lib/server-log";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import type { Json } from "@/types/database";

export async function processCheckout(formData: FormData): Promise<never> {
  const addressId = formData.get("address_id") as string;
  const paymentMethod = formData.get("payment_method") as string;
  const idempotencyKey = (formData.get("idempotency_key") as string)?.trim();
  const customerNoteRaw = (formData.get("customer_note") as string)?.trim();
  const customerNote = customerNoteRaw && customerNoteRaw.length > 0 ? customerNoteRaw : undefined;

  if (!addressId || !paymentMethod || !idempotencyKey) {
    redirect("/checkout?error=missing_fields");
  }

  if (idempotencyKey.length < 16 || idempotencyKey.length > 128 || !/^[A-Za-z0-9_.-]+$/.test(idempotencyKey)) {
    redirect("/checkout?error=invalid_idempotency_key");
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

  const gcashConfig = getGcashConfig();
  const serviceClient = createServiceClient();

  // 3. Delegate to unified checkout order orchestration
  return executeCheckoutOrder(
    {
      userId,
      userEmail,
      paymentMethod,
      idempotencyKey,
      customerNote,
      cart: {
        id: cart.id,
        items: cart.items.map((item) => ({
          variant_id: item.variant_id,
          quantity: item.quantity,
        })),
      },
      address,
    },
    {
      gcashConfig,
      invokeCheckoutRpc: async (params) => {
        const { data, error } = await serviceClient.rpc("checkout_order", {
          p_customer_id: params.p_customer_id,
          p_idempotency_key: params.p_idempotency_key,
          p_lines: params.p_lines,
          p_shipping_minor: params.p_shipping_minor,
          p_payment_method: params.p_payment_method,
          p_gcash_expires_at: params.p_gcash_expires_at as unknown as string,
          p_delivery: params.p_delivery as unknown as Json,
          p_customer_note: params.p_customer_note,
        });
        return { data: data as { id: string } | null, error };
      },
      clearCartItems: async (cartId) => {
        const { error } = await supabase.from("cart_items").delete().eq("cart_id", cartId);
        revalidatePath("/cart");
        return { error };
      },
      onRedirect: (url) => {
        revalidatePath("/orders");
        redirect(url);
      },
      onLogServerError: logServerError,
    }
  );
}
