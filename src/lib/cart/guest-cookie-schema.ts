export const GUEST_CART_COOKIE_NAME = "guest_cart";
export const MAX_COOKIE_BYTES = 2048;
export const MAX_CART_ITEMS = 20;
export const MAX_LINE_QUANTITY = 10;

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export interface GuestCartItem {
  variant_id: string;
  quantity: number;
}

export interface GuestCart {
  version: 1;
  items: GuestCartItem[];
}

/**
 * Validates untrusted cookie data string and parses it into a sanitized GuestCart.
 * Fails safely to an empty cart on any malformed, oversized, or tampered payload.
 */
export function parseGuestCartCookie(raw: string | undefined | null): GuestCart {
  const empty: GuestCart = { version: 1, items: [] };

  if (!raw || typeof raw !== "string" || raw.length === 0 || raw.length > MAX_COOKIE_BYTES) {
    return empty;
  }

  try {
    let jsonStr = raw;
    if (jsonStr.startsWith("%") || jsonStr.includes("%22") || jsonStr.includes("%7B")) {
      try {
        jsonStr = decodeURIComponent(jsonStr);
      } catch {
        // preserve original if decoding fails
      }
    }
    const parsed = JSON.parse(jsonStr);
    if (!parsed || typeof parsed !== "object" || parsed.version !== 1 || !Array.isArray(parsed.items)) {
      return empty;
    }

    const mergedItems = new Map<string, number>();

    for (const item of parsed.items) {
      if (!item || typeof item !== "object") continue;

      const variantId = typeof item.variant_id === "string" ? item.variant_id.trim().toLowerCase() : "";
      if (!UUID_REGEX.test(variantId)) continue;

      const qtyRaw = Number(item.quantity);
      if (!Number.isSafeInteger(qtyRaw) || qtyRaw <= 0) continue;

      const validQty = Math.min(MAX_LINE_QUANTITY, qtyRaw);
      const existing = mergedItems.get(variantId) ?? 0;
      mergedItems.set(variantId, Math.min(MAX_LINE_QUANTITY, existing + validQty));

      if (mergedItems.size >= MAX_CART_ITEMS) break;
    }

    const items: GuestCartItem[] = [];
    for (const [variant_id, quantity] of mergedItems.entries()) {
      items.push({ variant_id, quantity });
    }

    return { version: 1, items };
  } catch {
    return empty;
  }
}

/**
 * Serializes a sanitized GuestCart object for cookie storage.
 */
export function serializeGuestCartCookie(cart: GuestCart): string {
  const sanitized: GuestCart = {
    version: 1,
    items: cart.items.slice(0, MAX_CART_ITEMS).map((i) => ({
      variant_id: i.variant_id.toLowerCase(),
      quantity: Math.max(1, Math.min(MAX_LINE_QUANTITY, Math.floor(i.quantity))),
    })),
  };
  return JSON.stringify(sanitized);
}
