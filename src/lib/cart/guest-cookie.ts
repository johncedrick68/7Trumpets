import { cookies } from "next/headers";
import {
  GUEST_CART_COOKIE_NAME,
  GuestCart,
  parseGuestCartCookie,
  serializeGuestCartCookie,
} from "@/lib/cart/guest-cookie-schema";

export * from "@/lib/cart/guest-cookie-schema";

/**
 * Reads and validates the guest cart from current request cookies.
 */
export async function getGuestCart(): Promise<GuestCart> {
  const cookieStore = await cookies();
  const cookie = cookieStore.get(GUEST_CART_COOKIE_NAME);
  return parseGuestCartCookie(cookie?.value);
}

/**
 * Writes the sanitized guest cart to response cookies.
 */
export async function saveGuestCart(cart: GuestCart): Promise<void> {
  const cookieStore = await cookies();
  if (cart.items.length === 0) {
    cookieStore.delete(GUEST_CART_COOKIE_NAME);
    return;
  }

  const serialized = serializeGuestCartCookie(cart);
  cookieStore.set(GUEST_CART_COOKIE_NAME, serialized, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 30 * 24 * 60 * 60, // 30 days
  });
}

/**
 * Clears the guest cart cookie.
 */
export async function clearGuestCart(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(GUEST_CART_COOKIE_NAME);
}
