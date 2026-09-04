import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { BagIcon } from "@/components/icons";

/**
 * CartBadge — Server Component
 * Reads the authoritative cart item count from Supabase for the current
 * authenticated user. Falls back to 0 for unauthenticated visitors.
 * Placed in layout so it re-renders on every navigation after mutations
 * that call revalidatePath('/', 'layout').
 */
export async function CartBadge() {
  let count = 0;

  try {
    const supabase = await createClient();
    const { data: claimsData } = await supabase.auth.getClaims();
    const userId = claimsData?.claims?.sub;

    if (userId) {
      // Find cart
      const { data: cart } = await supabase
        .from("carts")
        .select("id")
        .eq("user_id", userId)
        .maybeSingle();

      if (cart) {
        // Count total quantity of items in cart (not distinct lines)
        const { data: items } = await supabase
          .from("cart_items")
          .select("quantity")
          .eq("cart_id", cart.id);

        if (items) {
          count = items.reduce((sum, item) => sum + (item.quantity ?? 0), 0);
        }
      }
    }
  } catch {
    // silently degrade — never crash the layout over cart count
    count = 0;
  }

  return (
    <Link
      href="/cart"
      className="bag-btn"
      aria-label={`Shopping Bag, ${count} ${count === 1 ? "item" : "items"}`}
    >
      <BagIcon size={15} />
      <span>Bag</span>
      <span className="bag-count" aria-live="polite">
        {count}
      </span>
    </Link>
  );
}
