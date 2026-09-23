import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { cartAddErrorMessage, parseCartQuantity } from "../src/lib/cart/validation.ts";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("cart and address actions keep database authority and server-side pricing", async () => {
  const cartActions = await read("src/lib/cart/actions.ts");
  const addressActions = await read("src/lib/addresses/actions.ts");

  // Cart assertions
  assert.match(cartActions, /from\("carts"\)/);
  assert.match(cartActions, /from\("cart_items"\)/);
  assert.match(cartActions, /rpc\("add_authenticated_cart_item"/);
  assert.match(cartActions, /price_minor/);
  assert.doesNotMatch(cartActions, /formData.*(?:price|total|subtotal|amount)/i);
  assert.doesNotMatch(cartActions, /SUPABASE_SECRET_KEY|service_role/i);

  // Address assertions
  assert.match(addressActions, /from\("addresses"\)/);
  assert.match(addressActions, /is_default/);
  assert.match(addressActions, /\.eq\("user_id", userId\)/);
  assert.doesNotMatch(addressActions, /SUPABASE_SECRET_KEY|service_role/i);
});

test("cart and address pages exist and are server components with dynamic rendering", async () => {
  assert.ok(existsSync("src/app/cart/page.tsx"));
  assert.ok(existsSync("src/app/account/addresses/page.tsx"));

  const cartPage = await read("src/app/cart/page.tsx");
  const addressesPage = await read("src/app/account/addresses/page.tsx");

  assert.match(cartPage, /dynamic = "force-dynamic"/);
  assert.match(addressesPage, /dynamic = "force-dynamic"/);

  assert.doesNotMatch(cartPage, /"use client"/);
  assert.doesNotMatch(addressesPage, /"use client"/);
});

test("cart and address flows do not introduce checkout or orders in Phase 2E", async () => {
  const cartActions = await read("src/lib/cart/actions.ts");
  const addressActions = await read("src/lib/addresses/actions.ts");

  assert.doesNotMatch(cartActions, /from\("orders"\)|from\("payments"\)|checkout_order/);
  assert.doesNotMatch(addressActions, /from\("orders"\)|from\("payments"\)|checkout_order/);
});

test("cart add rejects invalid quantities instead of silently clamping them", () => {
  assert.strictEqual(parseCartQuantity("1"), 1);
  assert.strictEqual(parseCartQuantity("11"), 11);
  assert.strictEqual(parseCartQuantity("0"), null);
  assert.strictEqual(parseCartQuantity("-1"), null);
  assert.strictEqual(parseCartQuantity("1.5"), null);
  assert.strictEqual(parseCartQuantity("not-a-number"), null);
  assert.strictEqual(parseCartQuantity(null), null);
});

test("cart add maps authoritative variant and stock failures to customer-safe errors", () => {
  assert.match(cartAddErrorMessage("CART_VARIANT_UNAVAILABLE"), /no longer available/i);
  assert.match(cartAddErrorMessage("CART_OUT_OF_STOCK"), /out of stock/i);
  assert.match(cartAddErrorMessage("CART_QUANTITY_EXCEEDS_STOCK"), /lower quantity/i);
  assert.match(cartAddErrorMessage(undefined), /could not update/i);
});

test("authenticated cart add uses the canonical redirect sanitizer and stock RPC", async () => {
  const actions = await read("src/lib/cart/actions.ts");
  const migration = await read("supabase/migrations/20260923000000_authenticated_cart_add_boundary.sql");
  const addAction = actions.slice(
    actions.indexOf("export async function addToCart"),
    actions.indexOf("export async function updateCartItemQuantity")
  );

  assert.match(actions, /safeCustomerRedirectPath\(returnToRaw, "\/cart"\)/);
  assert.match(actions, /rpc\("add_authenticated_cart_item"/);
  assert.match(actions, /if \(stay\) return \{ success: false, error: message \}/);
  assert.doesNotMatch(addAction, /Math\.min\((?:10|99)/);

  assert.match(migration, /auth\.uid\(\)/);
  assert.match(migration, /products\.status = 'published'/);
  assert.match(migration, /variants\.status = 'active'/);
  assert.match(migration, /on_hand - inventory\.reserved - inventory\.safety_stock/);
  assert.match(migration, /v_line_quantity > v_available/);
  assert.match(migration, /grant execute on function public\.add_authenticated_cart_item\(uuid, integer\) to authenticated/);
  assert.doesNotMatch(migration, /grant execute on function public\.add_authenticated_cart_item\(uuid, integer\) to anon/);
});

test("PDP refreshes the quantity badge only after a confirmed add", async () => {
  const purchaseForm = await read("src/components/product-purchase-form.tsx");
  const successBlock = purchaseForm.slice(
    purchaseForm.indexOf("if (!result.success)"),
    purchaseForm.indexOf("} catch (err")
  );

  assert.match(successBlock, /setValidationError\(result\.error\)/);
  assert.match(successBlock, /else \{[\s\S]*router\.refresh\(\)[\s\S]*setFeedback/);
  assert.doesNotMatch(successBlock.split("else {")[0], /router\.refresh/);
  assert.match(purchaseForm, /quantity: result\.itemCount/);
});
