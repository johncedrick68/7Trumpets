import { randomUUID } from "node:crypto";
import { cookies } from "next/headers";
import {
  GUEST_CART_COOKIE_NAME,
  GuestCart,
  parseGuestCartCookie,
  serializeGuestCartCookie,
} from "@/lib/cart/guest-cookie-schema";

export * from "@/lib/cart/guest-cookie-schema";

/**
 * Persistent guest cart lifetime: 30 days (2,592,000 seconds) matching standard
 * streetwear release/drop cycles so returning visitors keep their bag.
 *
 * Defense-in-depth note on __Host- cookie prefix:
 * RFC 6265bis mandates that __Host- cookies MUST be served over HTTPS and reject
 * insecure origins, which breaks local development on http://localhost:3000.
 * Therefore, GUEST_CART_COOKIE_NAME ("guest_cart") is used with explicit httpOnly,
 * sameSite: 'lax', path: '/', and secure: true in production.
 */
export const GUEST_CART_COOKIE_MAX_AGE_SECONDS = 30 * 24 * 60 * 60;

/**
 * Reads and validates the guest cart from current request cookies.
 */
export async function getGuestCart(): Promise<GuestCart> {
  const cookieStore = await cookies();
  const cookie = cookieStore.get(GUEST_CART_COOKIE_NAME);
  return parseGuestCartCookie(cookie?.value);
}

/**
 * Writes the sanitized guest cart to response cookies with an idempotency token.
 */
export async function saveGuestCart(cart: GuestCart): Promise<void> {
  const cookieStore = await cookies();
  if (cart.items.length === 0) {
    cookieStore.delete(GUEST_CART_COOKIE_NAME);
    return;
  }

  const token = cart.token || randomUUID();
  const serialized = serializeGuestCartCookie({ ...cart, token });

  cookieStore.set(GUEST_CART_COOKIE_NAME, serialized, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: GUEST_CART_COOKIE_MAX_AGE_SECONDS,
  });
}

/**
 * Clears the guest cart cookie.
 */
export async function clearGuestCart(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(GUEST_CART_COOKIE_NAME);
}
