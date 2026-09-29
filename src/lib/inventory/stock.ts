/**
 * Canonical Inventory Stock Calculation Rules
 *
 * Authoritative schema source: public.inventory (on_hand, reserved, safety_stock)
 * Database invariant: CHECK (reserved + safety_stock <= on_hand)
 *
 * Purchasable available stock in database RPCs:
 *   v_available = on_hand - reserved - safety_stock
 *
 * Status semantics:
 *   - Out of Stock: available <= 0
 *   - Low Stock: safety_stock > 0 && available > 0 && available <= safety_stock
 *   - In Stock: available > safety_stock (or available > 0 when safety_stock == 0)
 */

export interface InventoryLevels {
  on_hand: number;
  reserved: number;
  safety_stock: number;
}

/**
 * Calculates authoritative available (purchasable) stock:
 * Math.max(0, on_hand - reserved - safety_stock)
 */
export function calculateAvailableStock(inv: InventoryLevels | null | undefined): number {
  if (!inv) return 0;
  return Math.max(
    0,
    Number(inv.on_hand ?? 0) - Number(inv.reserved ?? 0) - Number(inv.safety_stock ?? 0)
  );
}

/**
 * Determines whether an inventory item is Out of Stock (available <= 0).
 */
export function isInventoryOutOfStock(inv: InventoryLevels | null | undefined): boolean {
  if (!inv) return true;
  return calculateAvailableStock(inv) <= 0;
}

/**
 * Determines whether an inventory item is Low Stock:
 * Defined strictly by canonical database safety_stock:
 * Must have a configured safety buffer (safety_stock > 0), and
 * available stock must be strictly positive but <= safety_stock.
 */
export function isInventoryLowStock(inv: InventoryLevels | null | undefined): boolean {
  if (!inv) return false;
  const safety = Number(inv.safety_stock ?? 0);
  if (safety <= 0) return false;
  const available = calculateAvailableStock(inv);
  return available > 0 && available <= safety;
}
