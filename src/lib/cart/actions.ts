"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import { logServerError } from "@/lib/server-log";
import { safeCustomerRedirectPath } from "@/lib/auth/redirect";
import { cartAddErrorMessage, parseCartQuantity } from "@/lib/cart/validation";
import {
  clearGuestCart,
  getGuestCart,
  saveGuestCart,
  GuestCartItem,
  MAX_TECHNICAL_QUANTITY,
} from "@/lib/cart/guest-cookie";

export { clearGuestCart, getGuestCart };

export type AddToCartResult =
  | { success: true; itemCount: number; lineQuantity: number }
  | { success: false; error: string };

export interface ReconciliationOutcome {
  reconciled: boolean;
  itemCount: number;
  mergedCount: number;
  unmergedItems: GuestCartItem[];
  warnings: string[];
}

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
  is_available?: boolean;
}

export interface CartDetail {
  id: string;
  user_id: string;
  items: CartItemDetail[];
  subtotal_minor: number;
  item_count: number;
}

// In-process lock to prevent duplicate concurrent reconciliations
const activeReconciliations = new Set<string>();

/**
 * Reconciles items from the untrusted guest cookie into the authenticated
 * user's database cart via the canonical add_authenticated_cart_item RPC.
 *
 * Replay-safe & Idempotent:
 * 1. Checks in-flight mutex per user/token.
 * 2. Checks persistent user_metadata.reconciled_guest_tokens to reject replays.
 * 3. Preserves unmerged items if stock boundary is exceeded.
 * 4. Records reconciled token in user_metadata upon successful merge.
 */
export async function reconcileGuestCart(userId: string): Promise<ReconciliationOutcome> {
  const emptyOutcome: ReconciliationOutcome = {
    reconciled: false,
    itemCount: 0,
    mergedCount: 0,
    unmergedItems: [],
    warnings: [],
  };

  if (!userId) return emptyOutcome;

  try {
    const guestCart = await getGuestCart();
    if (guestCart.items.length === 0) return emptyOutcome;

    const lockKey = `${userId}:${guestCart.token || "default"}`;
    if (activeReconciliations.has(lockKey)) {
      return {
        ...emptyOutcome,
        warnings: ["Reconciliation currently in progress."],
      };
    }
    activeReconciliations.add(lockKey);

    try {
      const supabase = await createClient();

      // Check persistent replay protection on user_metadata
      const { data: userData } = await supabase.auth.getUser();
      const rawTokens = userData?.user?.user_metadata?.reconciled_guest_tokens;
      const reconciledTokens: string[] = Array.isArray(rawTokens) ? rawTokens : [];

      if (guestCart.token && reconciledTokens.includes(guestCart.token)) {
        // Replayed request detected: already reconciled this exact guest cart token
        await clearGuestCart();
        return {
          ...emptyOutcome,
          warnings: ["Guest cart token was already reconciled."],
        };
      }

      const unmergedItems: GuestCartItem[] = [];
      const warnings: string[] = [];
      let mergedCount = 0;

      for (const item of guestCart.items) {
        const { error } = await supabase.rpc("add_authenticated_cart_item", {
          p_variant_id: item.variant_id,
          p_quantity: item.quantity,
        });

        if (error) {
          logServerError("cart.merge_item", "merge_failure");
          unmergedItems.push(item);
          warnings.push(cartAddErrorMessage(error.message));
        } else {
          mergedCount += item.quantity;
        }
      }

      if (unmergedItems.length === 0) {
        await clearGuestCart();
      } else if (unmergedItems.length < guestCart.items.length) {
        // Partial merge: rotate token and persist remaining unmerged items
        await saveGuestCart({
          version: 1,
          token: randomUUID(),
          items: unmergedItems,
        });
      }

      // Record reconciled token persistently to block subsequent replays
      if (mergedCount > 0 && guestCart.token) {
        const updatedTokens = [...reconciledTokens.slice(-9), guestCart.token];
        try {
          await supabase.auth.updateUser({
            data: { reconciled_guest_tokens: updatedTokens },
          });
        } catch {
          logServerError("cart.reconcile_token_record", "auth_metadata_failure");
        }
      }

      revalidatePath("/cart");
      revalidatePath("/", "layout");

      return {
        reconciled: mergedCount > 0,
        itemCount: guestCart.items.reduce((s, i) => s + i.quantity, 0),
        mergedCount,
        unmergedItems,
        warnings,
      };
    } finally {
      activeReconciliations.delete(lockKey);
    }
  } catch {
    logServerError("cart.reconcile", "reconciliation_failure");
    return emptyOutcome;
  }
}

export async function getOrCreateCart(): Promise<CartDetail | null> {
  const supabase = await createClient();
  const { data: claimsData } = await supabase.auth.getClaims();
  const userId = claimsData?.claims?.sub;

  if (userId) {
    // Reconcile any existing guest items into the authenticated account
    await reconcileGuestCart(userId);

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

    // 2. Fetch authenticated cart items
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

    // 3. Check public availability for item lines
    const variantIds = (items ?? []).map((i) => i.variant_id);
    const availabilityMap = new Map<string, boolean>();
    if (variantIds.length > 0) {
      const { data: availRows } = await supabase.rpc("get_public_variant_availability");
      for (const row of availRows ?? []) {
        availabilityMap.set(row.variant_id, row.is_available);
      }
    }

    let subtotal = 0;
    let totalCount = 0;

    const itemDetails: CartItemDetail[] = (items ?? []).map((item) => {
      const variant = item.product_variants;
      const product = variant?.products;
      const price = variant?.price_minor ?? 0;
      const isAvailable = availabilityMap.get(item.variant_id) === true;
      const lineTotal = price * item.quantity;

      if (isAvailable) {
        subtotal += lineTotal;
      }
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
        is_available: isAvailable,
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

  // --- GUEST CART RESOLUTION ---
  const guestCart = await getGuestCart();
  if (guestCart.items.length === 0) {
    return {
      id: "guest",
      user_id: "",
      items: [],
      subtotal_minor: 0,
      item_count: 0,
    };
  }

  const variantIds = guestCart.items.map((i) => i.variant_id);

  const [{ data: variants, error: variantsError }, { data: availRows }] = await Promise.all([
    supabase
      .from("product_variants")
      .select(`
        id,
        sku,
        name,
        price_minor,
        status,
        product_id,
        products (
          id,
          name,
          slug,
          status,
          product_images (
            storage_path,
            position
          )
        )
      `)
      .in("id", variantIds),
    supabase.rpc("get_public_variant_availability"),
  ]);

  if (variantsError || !variants) {
    logServerError("guest_cart.read", "database_failure");
    return {
      id: "guest",
      user_id: "",
      items: [],
      subtotal_minor: 0,
      item_count: 0,
    };
  }

  const availabilityMap = new Map<string, boolean>();
  for (const row of availRows ?? []) {
    availabilityMap.set(row.variant_id, row.is_available);
  }

  const variantMap = new Map(variants.map((v) => [v.id, v]));

  let subtotal = 0;
  let totalCount = 0;
  const itemDetails: CartItemDetail[] = [];

  for (const guestItem of guestCart.items) {
    const variant = variantMap.get(guestItem.variant_id);
    if (!variant) continue;

    const product = variant.products;
    const isProductPublished = product?.status === "published";
    const isVariantActive = variant.status === "active";
    const isStockAvailable = availabilityMap.get(variant.id) === true;
    const isAvailable = isProductPublished && isVariantActive && isStockAvailable;

    const price = variant.price_minor ?? 0;
    const lineTotal = price * guestItem.quantity;

    if (isAvailable) {
      subtotal += lineTotal;
    }
    totalCount += guestItem.quantity;

    type RawImage = { storage_path?: string; position?: number };
    const rawImages: RawImage[] = ((product as unknown as { product_images?: RawImage[] })?.product_images || []);
    const sortedImages = [...rawImages].sort((a, b) => (a.position ?? 0) - (b.position ?? 0));
    const rawPath = sortedImages[0]?.storage_path;
    const imagePath = rawPath
      ? rawPath.startsWith("/") || rawPath.startsWith("http")
        ? rawPath
        : `/images/${rawPath.split("/").pop()}`
      : "/images/1968%20CLOTHING%20V1.webp";

    itemDetails.push({
      id: guestItem.variant_id,
      variant_id: guestItem.variant_id,
      quantity: guestItem.quantity,
      variant_name: variant.name ?? null,
      sku: variant.sku ?? "",
      price_minor: price,
      product_id: variant.product_id ?? "",
      product_name: product?.name ?? "Unknown Product",
      product_slug: product?.slug ?? "",
      image_path: imagePath,
      line_total_minor: lineTotal,
      is_available: isAvailable,
    });
  }

  return {
    id: "guest",
    user_id: "",
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

  if (userId) {
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
    revalidatePath("/", "layout"); // update header CartBadge across all pages

    if (stay) {
      return {
        success: true,
        itemCount,
        lineQuantity,
      };
    }

    redirect(safeReturnTo);
  }

  // --- GUEST ADD TO BAG ---
  const { data: variant, error: variantError } = await supabase
    .from("product_variants")
    .select("id, status, products!inner(id, status)")
    .eq("id", variantId)
    .eq("status", "active")
    .eq("products.status", "published")
    .maybeSingle();

  if (variantError || !variant) {
    return fail("This product option is no longer available.", "variant_unavailable");
  }

  const { data: availRows } = await supabase.rpc("get_public_variant_availability");
  const isAvailable = (availRows ?? []).some(
    (row) => row.variant_id === variantId && row.is_available === true,
  );
  if (!isAvailable) {
    return fail("This size is currently out of stock.", "out_of_stock");
  }

  const guestCart = await getGuestCart();
  const existingItem = guestCart.items.find((i) => i.variant_id === variantId);
  const existingQty = existingItem ? existingItem.quantity : 0;
  const newQty = existingQty + quantity;

  if (newQty > MAX_TECHNICAL_QUANTITY) {
    return fail("Choose a lower quantity.", "quantity_exceeds_limit");
  }

  if (existingItem) {
    existingItem.quantity = newQty;
  } else {
    guestCart.items.push({ variant_id: variantId, quantity });
  }

  await saveGuestCart(guestCart);

  revalidatePath("/cart");
  revalidatePath("/", "layout");

  const totalCount = guestCart.items.reduce((sum, item) => sum + item.quantity, 0);

  if (stay) {
    return {
      success: true,
      itemCount: totalCount,
      lineQuantity: newQty,
    };
  }

  redirect(safeReturnTo);
}

export async function updateCartItemQuantity(formData: FormData) {
  const itemId = formData.get("item_id") as string;
  const quantityRaw = Number(formData.get("quantity") ?? 1);
  const quantity = Number.isInteger(quantityRaw) ? quantityRaw : 1;

  if (!itemId) redirect("/cart");

  const supabase = await createClient();
  const { data: claimsData } = await supabase.auth.getClaims();
  const userId = claimsData?.claims?.sub;

  if (userId) {
    if (quantity <= 0) {
      const { error } = await supabase.from("cart_items").delete().eq("id", itemId);
      if (error) {
        logServerError("cart.item.quantity", "database_failure");
        redirect("/cart?error=cart_update_failed");
      }
    } else {
      if (quantity > MAX_TECHNICAL_QUANTITY) {
        redirect("/cart?error=quantity_exceeds_stock");
      }
      const targetQty = quantity;

      // Verify stock if increasing
      const { data: cartItem } = await supabase
        .from("cart_items")
        .select("variant_id, quantity")
        .eq("id", itemId)
        .maybeSingle();

      if (cartItem && targetQty > cartItem.quantity) {
        const { data: availRows } = await supabase.rpc("get_public_variant_availability");
        const isAvailable = (availRows ?? []).some(
          (row) => row.variant_id === cartItem.variant_id && row.is_available === true,
        );
        if (!isAvailable) {
          redirect("/cart?error=quantity_exceeds_stock");
        }
      }

      const { error } = await supabase
        .from("cart_items")
        .update({ quantity: targetQty })
        .eq("id", itemId);

      if (error) {
        logServerError("cart.item.quantity", "database_failure");
        redirect("/cart?error=cart_update_failed");
      }
    }
  } else {
    // Guest update: itemId is variant_id
    const guestCart = await getGuestCart();
    if (quantity <= 0) {
      guestCart.items = guestCart.items.filter((i) => i.variant_id !== itemId);
    } else {
      const item = guestCart.items.find((i) => i.variant_id === itemId);
      if (item) {
        if (quantity > MAX_TECHNICAL_QUANTITY) {
          redirect("/cart?error=quantity_exceeds_stock");
        }
        const targetQty = quantity;
        if (targetQty > item.quantity) {
          const { data: availRows } = await supabase.rpc("get_public_variant_availability");
          const isAvailable = (availRows ?? []).some(
            (row) => row.variant_id === itemId && row.is_available === true,
          );
          if (!isAvailable) {
            redirect("/cart?error=quantity_exceeds_stock");
          }
        }
        item.quantity = targetQty;
      }
    }
    await saveGuestCart(guestCart);
  }

  revalidatePath("/cart");
  revalidatePath("/", "layout"); // update header CartBadge
  redirect("/cart");
}

export async function removeCartItem(formData: FormData) {
  const itemId = formData.get("item_id") as string;
  if (!itemId) redirect("/cart");

  const supabase = await createClient();
  const { data: claimsData } = await supabase.auth.getClaims();
  const userId = claimsData?.claims?.sub;

  if (userId) {
    const { error } = await supabase.from("cart_items").delete().eq("id", itemId);
    if (error) {
      logServerError("cart.item.remove", "database_failure");
      redirect("/cart?error=cart_update_failed");
    }
  } else {
    // Guest remove: itemId is variant_id
    const guestCart = await getGuestCart();
    guestCart.items = guestCart.items.filter((i) => i.variant_id !== itemId);
    await saveGuestCart(guestCart);
  }

  revalidatePath("/cart");
  revalidatePath("/", "layout"); // update header CartBadge
  redirect("/cart");
}
