"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import { logServerError } from "@/lib/server-log";

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
          slug
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

export async function addToCart(formData: FormData) {
  const variantId = formData.get("variant_id") as string;
  const quantityRaw = Number(formData.get("quantity") ?? 1);
  const quantity = Math.max(1, Math.min(99, Number.isInteger(quantityRaw) ? quantityRaw : 1));

  if (!variantId) {
    redirect("/products");
  }

  const supabase = await createClient();
  const { data: claimsData } = await supabase.auth.getClaims();
  const userId = claimsData?.claims?.sub;
  if (!userId) {
    redirect(`/login?next=/cart`);
  }

  // Verify variant exists and is active
  const { data: variant, error: varError } = await supabase
    .from("product_variants")
    .select("id")
    .eq("id", variantId)
    .eq("status", "active")
    .maybeSingle();

  if (varError) {
    logServerError("cart.variant.read", "database_failure");
    redirect("/products?error=catalog_unavailable");
  }
  if (!variant) {
    redirect("/products?error=variant_unavailable");
  }

  // Get or create cart
  const { data: existingCart, error: cartLookupError } = await supabase
    .from("carts")
    .select("id")
    .eq("user_id", userId)
    .maybeSingle();

  if (cartLookupError) {
    logServerError("cart.read", "database_failure");
    redirect("/cart?error=cart_unavailable");
  }
  let cart = existingCart;
  if (!cart) {
    const { data: newCart, error: cartError } = await supabase
      .from("carts")
      .insert({ user_id: userId })
      .select("id")
      .single();

    if (cartError || !newCart) {
      redirect("/cart?error=cart_creation_failed");
    }
    cart = newCart;
  }

  // Check if item already in cart
  const { data: existingItem, error: itemLookupError } = await supabase
    .from("cart_items")
    .select("id, quantity")
    .eq("cart_id", cart.id)
    .eq("variant_id", variantId)
    .maybeSingle();

  if (itemLookupError) {
    logServerError("cart.item.read", "database_failure");
    redirect("/cart?error=cart_unavailable");
  }
  let mutationError;
  if (existingItem) {
    const newQty = Math.min(99, existingItem.quantity + quantity);
    const { error } = await supabase
      .from("cart_items")
      .update({ quantity: newQty })
      .eq("id", existingItem.id);
    mutationError = error;
  } else {
    const { error } = await supabase
      .from("cart_items")
      .insert({
        cart_id: cart.id,
        variant_id: variantId,
        quantity,
      });
    mutationError = error;
  }
  if (mutationError) {
    logServerError("cart.item.write", "database_failure");
    redirect("/cart?error=cart_update_failed");
  }

  revalidatePath("/cart");
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
  redirect("/cart");
}
