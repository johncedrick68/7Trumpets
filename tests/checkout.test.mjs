import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("checkout action uses trusted database RPC checkout_order and service client", async () => {
  const checkoutAction = await read("src/lib/checkout/actions.ts");

  assert.match(checkoutAction, /createServiceClient/);
  assert.match(checkoutAction, /\.rpc\("checkout_order",/);
  assert.match(checkoutAction, /p_customer_id/);
  assert.match(checkoutAction, /p_idempotency_key/);
  assert.match(checkoutAction, /p_lines/);
  assert.match(checkoutAction, /p_shipping_minor/);
  assert.match(checkoutAction, /p_payment_method/);
  assert.match(checkoutAction, /p_delivery/);

  // Assert no browser-provided financial or pricing overrides
  assert.doesNotMatch(checkoutAction, /formData.*(?:price|subtotal|grand_total|total_minor)/i);
});

test("checkout action strictly derives customer identity from verified session and validates address ownership", async () => {
  const checkoutAction = await read("src/lib/checkout/actions.ts");

  // Verified auth identity lookup
  assert.match(checkoutAction, /auth\.getClaims\(\)/);
  assert.match(checkoutAction, /claimsData\?\.claims\?\.sub/);
  assert.match(checkoutAction, /auth\.getUser\(\)/);

  // Rejects client-controlled user_id injection
  assert.doesNotMatch(checkoutAction, /formData.*(?:user_id|userId|uid|customer_id)/i);

  // Address lookup must be owner-scoped
  assert.match(checkoutAction, /\.from\("addresses"\)/);
  assert.match(checkoutAction, /\.eq\("id", addressId\)/);
  assert.match(checkoutAction, /\.eq\("user_id", userId\)/);
});

test("checkout form generates stable cryptographically random idempotency key and server action validates it", async () => {
  const checkoutPage = await read("src/app/checkout/page.tsx");
  const checkoutAction = await read("src/lib/checkout/actions.ts");

  // Page generates crypto random idempotency token for form
  assert.match(checkoutPage, /randomUUID\(\)/);
  assert.match(checkoutPage, /name="idempotency_key"/);

  // Server action validates submitted idempotency token and rejects malformed/missing
  assert.match(checkoutAction, /idempotencyKey.*formData\.get\("idempotency_key"\)/);
  assert.match(checkoutAction, /idempotencyKey\.length < 16/);
  assert.match(checkoutAction, /invalid_idempotency_key/);

  // Server action does NOT regenerate key per action call
  assert.doesNotMatch(checkoutAction, /idempotencyKey\s*=\s*`checkout_\${cart\.id}_\${Date\.now\(\)}/);
});

test("order confirmation page enforces authenticated ownership", async () => {
  const orderPage = await read("src/app/orders/[id]/page.tsx");

  assert.match(orderPage, /auth\.getClaims\(\)/);
  assert.match(orderPage, /\.from\("orders"\)/);
  assert.match(orderPage, /\.eq\("id", id\)/);
  assert.match(orderPage, /\.eq\("user_id", userId\)/);
});

test("checkout and order confirmation pages exist and are server components with dynamic rendering", async () => {
  assert.ok(existsSync("src/app/checkout/page.tsx"));
  assert.ok(existsSync("src/app/orders/[id]/page.tsx"));

  const checkoutPage = await read("src/app/checkout/page.tsx");
  const orderPage = await read("src/app/orders/[id]/page.tsx");

  assert.match(checkoutPage, /dynamic = "force-dynamic"/);
  assert.match(orderPage, /dynamic = "force-dynamic"/);

  assert.doesNotMatch(checkoutPage, /"use client"/);
  assert.doesNotMatch(orderPage, /"use client"/);
});

test("checkout and orders flow does not include admin mutations or premature fulfillment UI in Phase 2F", async () => {
  const checkoutAction = await read("src/lib/checkout/actions.ts");
  const orderPage = await read("src/app/orders/[id]/page.tsx");

  assert.doesNotMatch(checkoutAction, /transition_order|approve_gcash_submission|settle_cod_payment/);
  assert.doesNotMatch(orderPage, /approve|reject|fulfill|shipment_tracking/);
});

test("service role client is never exposed to browser or client components", async () => {
  const serverLib = await read("src/lib/supabase/server.ts");
  const clientLib = await read("src/lib/supabase/client.ts");
  const proxyLib = await read("src/lib/supabase/proxy.ts");

  assert.match(serverLib, /createServiceClient/);
  assert.doesNotMatch(clientLib, /createServiceClient|SUPABASE_SECRET_KEY/);
  assert.doesNotMatch(proxyLib, /createServiceClient|SUPABASE_SECRET_KEY/);
});
