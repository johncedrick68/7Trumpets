import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("cart and address actions keep database authority and server-side pricing", async () => {
  const cartActions = await read("src/lib/cart/actions.ts");
  const addressActions = await read("src/lib/addresses/actions.ts");

  // Cart assertions
  assert.match(cartActions, /from\("carts"\)/);
  assert.match(cartActions, /from\("cart_items"\)/);
  assert.match(cartActions, /from\("product_variants"\)/);
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
