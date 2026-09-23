"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import { logServerError } from "@/lib/server-log";
import { safeCustomerRedirectPath } from "@/lib/auth/redirect";
import { cartAddErrorMessage, parseCartQuantity } from "@/lib/cart/validation";

export type AddToCartResult =
  | { success: true; itemCount: number; lineQuantity: number }
  | { success: false; error: string };

export interface CartItemDetail {
  id: string;
  variant_id: string;
  quantity: number;
  variant_name: string | null;
  sku: string;
  price_minor: number;
  product_id: string;
  product_name: string;
  product_slug: string;
  image_path?: string | null;
  line_total_minor: number;
}

export interface CartDetail {
  id: string;
  user_id: string;
  items: CartItemDetail[];
  subtotal_minor: number;
  item_count: number;
}

export async function getOrCreateCart(): Promise<CartDetail | null> {
  const supabase = await createClient();
  const { data: claimsData } = await supabase.auth.getClaims();
  const userId = claimsData?.claims?.sub;
  if (!userId) return null;

  // 1. Ensure user has a cart
  const { data: existingCart, error: cartError } = await supabase
    .from("carts")
    .select("id, user_id")
    .eq("user_id", userId)
    .maybeSingle();

  if (cartError) {
    logServerError("cart.read", "database_failure");
    throw new Error("CART_UNAVAILABLE");
  }
  let cart = existingCart;
  if (!cart) {
    const { data: newCart, error: insertError } = await supabase
      .from("carts")
      .insert({ user_id: userId })
      .select("id, user_id")
      .single();

    if (insertError) {
      logServerError("cart.create", "database_failure");
      throw new Error("CART_UNAVAILABLE");
    }
    cart = newCart;
  }

  // 2. Fetch cart items
  const { data: items, error: itemsError } = await supabase
    .from("cart_items")
    .select(`
      id,
      variant_id,
      quantity,
      product_variants (
        id,
        sku,
        name,
        price_minor,
        product_id,
        products (
          id,
          name,
          slug,
          product_images (
            storage_path,
            position
          )
        )
      )
    `)
    .eq("cart_id", cart.id)
    .order("created_at", { ascending: true });

  if (itemsError) {
    logServerError("cart.items.read", "database_failure");
    throw new Error("CART_UNAVAILABLE");
  }

  let subtotal = 0;
  let totalCount = 0;

  const itemDetails: CartItemDetail[] = (items ?? []).map((item) => {
    const variant = item.product_variants;
    const product = variant?.products;
    const price = variant?.price_minor ?? 0;
    const lineTotal = price * item.quantity;

    subtotal += lineTotal;
    totalCount += item.quantity;

    type RawImage = { storage_path?: string; position?: number };
    const rawImages: RawImage[] = ((product as unknown as { product_images?: RawImage[] })?.product_images || []);
    const sortedImages = [...rawImages].sort((a, b) => (a.position ?? 0) - (b.position ?? 0));
    const rawPath = sortedImages[0]?.storage_path;
    const imagePath = rawPath
      ? rawPath.startsWith("/") || rawPath.startsWith("http")
        ? rawPath
        : `/images/${rawPath.split("/").pop()}`
      : "/images/1968%20CLOTHING%20V1.webp";

    return {
      id: item.id,
      variant_id: item.variant_id,
      quantity: item.quantity,
      variant_name: variant?.name ?? null,
      sku: variant?.sku ?? "",
      price_minor: price,
      product_id: variant?.product_id ?? "",
      product_name: product?.name ?? "Unknown Product",
      product_slug: product?.slug ?? "",
      image_path: imagePath,
      line_total_minor: lineTotal,
    };
  });

  return {
    id: cart.id,
    user_id: cart.user_id,
    items: itemDetails,
    subtotal_minor: subtotal,
    item_count: totalCount,
  };
}

export async function addToCart(formData: FormData): Promise<AddToCartResult | never> {
  const variantId = formData.get("variant_id") as string;
  const quantity = parseCartQuantity(formData.get("quantity"));
  const returnToRaw = formData.get("return_to") as string | null;
  const stay = formData.get("stay") === "true";
  const safeReturnTo = safeCustomerRedirectPath(returnToRaw, "/cart");

  const fail = (message: string, code: string): AddToCartResult | never => {
    if (stay) return { success: false, error: message };
    redirect(`/cart?error=${encodeURIComponent(code)}`);
  };

  if (!variantId) {
    return fail("Select an available product option.", "variant_unavailable");
  }
  if (quantity === null) {
    return fail("Enter a valid quantity.", "invalid_quantity");
  }

  const supabase = await createClient();
  const { data: claimsData } = await supabase.auth.getClaims();
  const userId = claimsData?.claims?.sub;
  if (!userId) {
    redirect(`/login?next=${encodeURIComponent(safeReturnTo)}`);
  }

  const { data, error } = await supabase.rpc("add_authenticated_cart_item", {
    p_variant_id: variantId,
    p_quantity: quantity,
  });
  if (error) {
    logServerError("cart.item.write", "database_failure");
    return fail(cartAddErrorMessage(error.message), "cart_update_failed");
  }

  const result = data as { item_count?: number; line_quantity?: number } | null;
  if (
    !result ||
    !Number.isSafeInteger(result.item_count) ||
    !Number.isSafeInteger(result.line_quantity) ||
    (result.item_count ?? 0) <= 0 ||
    (result.line_quantity ?? 0) <= 0
  ) {
    logServerError("cart.item.write", "invalid_database_response");
    return fail("We could not confirm your bag update. Please try again.", "cart_update_failed");
  }
  const itemCount = result.item_count as number;
  const lineQuantity = result.line_quantity as number;

  revalidatePath("/cart");
  revalidatePath("/", "layout");  // update header CartBadge across all pages

  if (stay) {
    return {
      success: true,
      itemCount,
      lineQuantity,
    };
  }

  redirect("/cart");
}

export async function updateCartItemQuantity(formData: FormData) {
  const itemId = formData.get("item_id") as string;
  const quantityRaw = Number(formData.get("quantity") ?? 1);
  const quantity = Number.isInteger(quantityRaw) ? quantityRaw : 1;

  if (!itemId) redirect("/cart");

  const supabase = await createClient();
  const { data: claimsData } = await supabase.auth.getClaims();
  const userId = claimsData?.claims?.sub;
  if (!userId) redirect("/login?next=/cart");

  let mutationError;
  if (quantity <= 0) {
    const { error } = await supabase.from("cart_items").delete().eq("id", itemId);
    mutationError = error;
  } else {
    const { error } = await supabase
      .from("cart_items")
      .update({ quantity: Math.min(99, quantity) })
      .eq("id", itemId);
    mutationError = error;
  }
  if (mutationError) {
    logServerError("cart.item.quantity", "database_failure");
    redirect("/cart?error=cart_update_failed");
  }

  revalidatePath("/cart");
  revalidatePath("/", "layout");  // update header CartBadge
  redirect("/cart");
}

export async function removeCartItem(formData: FormData) {
  const itemId = formData.get("item_id") as string;
  if (!itemId) redirect("/cart");

  const supabase = await createClient();
  const { data: claimsData } = await supabase.auth.getClaims();
  const userId = claimsData?.claims?.sub;
  if (!userId) redirect("/login?next=/cart");

  const { error } = await supabase.from("cart_items").delete().eq("id", itemId);
  if (error) {
    logServerError("cart.item.remove", "database_failure");
    redirect("/cart?error=cart_update_failed");
  }

  revalidatePath("/cart");
  revalidatePath("/", "layout");  // update header CartBadge
  redirect("/cart");
}
