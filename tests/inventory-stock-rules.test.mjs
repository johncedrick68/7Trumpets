import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  calculateAvailableStock,
  isInventoryOutOfStock,
  isInventoryLowStock,
} from "../src/lib/inventory/stock.ts";

test("Canonical Inventory: available stock calculation", () => {
  // Available = Math.max(0, on_hand - reserved - safety_stock)
  assert.equal(calculateAvailableStock({ on_hand: 30, reserved: 0, safety_stock: 3 }), 27);
  assert.equal(calculateAvailableStock({ on_hand: 6, reserved: 0, safety_stock: 3 }), 3);
  assert.equal(calculateAvailableStock({ on_hand: 3, reserved: 0, safety_stock: 3 }), 0);
  assert.equal(calculateAvailableStock({ on_hand: 2, reserved: 0, safety_stock: 3 }), 0);
  assert.equal(calculateAvailableStock({ on_hand: 10, reserved: 5, safety_stock: 2 }), 3);
  assert.equal(calculateAvailableStock({ on_hand: 5, reserved: 5, safety_stock: 0 }), 0);
  assert.equal(calculateAvailableStock(null), 0);
  assert.equal(calculateAvailableStock(undefined), 0);
});

test("Canonical Inventory: Out of Stock semantics", () => {
  // Out of stock when available <= 0
  assert.equal(isInventoryOutOfStock({ on_hand: 30, reserved: 0, safety_stock: 3 }), false);
  assert.equal(isInventoryOutOfStock({ on_hand: 4, reserved: 0, safety_stock: 3 }), false);
  assert.equal(isInventoryOutOfStock({ on_hand: 3, reserved: 0, safety_stock: 3 }), true);
  assert.equal(isInventoryOutOfStock({ on_hand: 1, reserved: 0, safety_stock: 3 }), true);
  assert.equal(isInventoryOutOfStock({ on_hand: 0, reserved: 0, safety_stock: 0 }), true);
  assert.equal(isInventoryOutOfStock(null), true);
});

test("Canonical Inventory: Low Stock semantics strictly uses database safety_stock", () => {
  // Low stock requires safety_stock > 0 and available > 0 and available <= safety_stock
  // 1. Healthy: available (27) > safety_stock (3) -> false
  assert.equal(isInventoryLowStock({ on_hand: 30, reserved: 0, safety_stock: 3 }), false);

  // 2. Exactly at safety threshold: on_hand 6, reserved 0, safety 3 => available = 3 (<= safety 3) -> true
  assert.equal(isInventoryLowStock({ on_hand: 6, reserved: 0, safety_stock: 3 }), true);

  // 3. Below safety threshold: on_hand 5, reserved 0, safety 3 => available = 2 (<= safety 3) -> true
  assert.equal(isInventoryLowStock({ on_hand: 5, reserved: 0, safety_stock: 3 }), true);

  // 4. Out of stock: on_hand 3, reserved 0, safety 3 => available = 0 -> false (it is OUT of stock, not low stock)
  assert.equal(isInventoryLowStock({ on_hand: 3, reserved: 0, safety_stock: 3 }), false);

  // 5. Zero safety stock configured: safety_stock = 0 -> cannot be low stock (no buffer configured)
  assert.equal(isInventoryLowStock({ on_hand: 2, reserved: 0, safety_stock: 0 }), false);
  assert.equal(isInventoryLowStock({ on_hand: 1, reserved: 0, safety_stock: 0 }), false);

  // 6. Null/undefined safe
  assert.equal(isInventoryLowStock(null), false);
  assert.equal(isInventoryLowStock(undefined), false);
});

test("Database migration enforces safety_stock constraints", async () => {
  const migration = await readFile(
    new URL("../supabase/migrations/20260824175030_inventory.sql", import.meta.url),
    "utf8"
  );

  // Invariant 1: safety_stock >= 0
  assert.match(migration, /safety_stock INTEGER NOT NULL DEFAULT 0 CHECK \(safety_stock >= 0\)/);

  // Invariant 2: reserved + safety_stock <= on_hand
  assert.match(migration, /CHECK \(reserved \+ safety_stock <= on_hand\)/);

  // Invariant 3: checkout RPC availability deducts safety_stock
  assert.match(migration, /on_hand - v_inventory\.reserved - v_inventory\.safety_stock/);
});
