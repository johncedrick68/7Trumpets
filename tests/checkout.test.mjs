import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { checkoutRenderFixture, checkoutSubmitGuardFixture } from "../scripts/checkout-render-fixtures.mjs";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("server-rendered COD quotes allow below/exact limit and disable one centavo above", async () => {
  for (const [subtotal, disabled] of [[84999, false], [85000, false], [85001, true]]) {
    const { props, html } = await checkoutRenderFixture({ subtotal });
    assert.equal(props.quotes[0].totalMinor, subtotal + 15000);
    assert.equal(props.quotes[0].payments.find(p => p.value === 'COD').disabled, disabled);
    assert.match(html, /name="payment_method"/);
  }
});

test("checkout read failures render operational errors, not empty/default checkout", async () => {
  for (const option of ['settingsError', 'addressError', 'cartError']) {
    const { html } = await checkoutRenderFixture({ [option]: true });
    assert.match(html, /temporarily unavailable/);
    assert.doesNotMatch(html, /name="payment_method"|PLACE ORDER/);
  }
});

test("checkout pending presentation disables CTA and announces progress", async () => {
  const {html} = await checkoutRenderFixture({pending:true});
  assert.match(html, /type="submit" disabled=""/);
  assert.match(html, /PLACING ORDER/);
  assert.match(html, /aria-live="polite"/);
});

test("actual checkout submit guard permits first valid intent and blocks duplicate/invalid intent", async () => {
  const {props} = await checkoutRenderFixture();
  let blocked=0;
  const event={preventDefault:()=>blocked++};
  const submit=checkoutSubmitGuardFixture(props);
  submit(event); assert.equal(blocked,0);
  submit(event); assert.equal(blocked,1);
  const missing=await checkoutRenderFixture({noAddress:true});
  checkoutSubmitGuardFixture(missing.props)(event); assert.equal(blocked,2);
});

test("checkout missing address, no eligible payment, and stale stock disable order placement", async () => {
  for (const options of [{noAddress:true}, {noPayment:true,subtotal:85001}, {staleStock:true}]) {
    const { html } = await checkoutRenderFixture(options);
    assert.match(html, /type="submit" disabled=""/);
  }
});

test("checkout has native named radios, safe summary and no client financial recalculation", async () => {
  const { html } = await checkoutRenderFixture();
  assert.match(html, /<fieldset/);
  assert.match(html, /<legend>Payment/);
  assert.match(html, /name="address_id"/);
  assert.match(html, /name="fulfillment_method"/);
  assert.match(html, /<dl/);
  const client = await read('src/app/checkout/checkout-form-client.tsx');
  assert.doesNotMatch(client, /calculateShippingMinor|cod_max_minor|createServiceClient|SUPABASE_SECRET_KEY/);
  assert.match(client, /useFormStatus/);
  assert.match(client, /submitted\.current/);
  assert.match(client, /errorRef\.current\?\.focus/);
});

test("checkout action uses trusted database RPC checkout_order and service client", async () => {
  const checkoutAction = await read("src/lib/checkout/actions.ts");

  assert.match(checkoutAction, /createServiceClient/);
  assert.match(checkoutAction, /\.rpc\("checkout_order",/);
  assert.match(checkoutAction, /p_customer_id/);
  assert.match(checkoutAction, /p_idempotency_key/);
  assert.match(checkoutAction, /p_lines/);
  assert.match(checkoutAction, /p_shipping_minor/);
  assert.match(checkoutAction, /p_payment_method/);
  assert.match(checkoutAction, /p_fulfillment_method/);
  assert.match(checkoutAction, /p_delivery/);
  assert.match(checkoutAction, /loadCheckoutSettings/);
  assert.doesNotMatch(checkoutAction, /\.from\("orders"\)\s*\.update\(\{ fulfillment_method/);

  // Assert no browser-provided financial or pricing overrides
  assert.doesNotMatch(checkoutAction, /formData.*(?:price|subtotal|grand_total|total_minor)/i);
});

test("fulfillment is committed atomically with checkout", async () => {
  const migration = await read("supabase/migrations/20260920011000_transactional_fulfillment_checkout.sql");
  assert.match(migration, /p_fulfillment_method text/);
  assert.match(migration, /update public\.orders[\s\S]*set fulfillment_method = p_fulfillment_method/);
  assert.match(migration, /revoke all on function public\.checkout_order.*from public, anon/);
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

test("checkout and orders flow does not include admin mutations or admin fulfillment actions in customer UI", async () => {
  const checkoutAction = await read("src/lib/checkout/actions.ts");
  const orderPage = await read("src/app/orders/[id]/page.tsx");

  assert.doesNotMatch(checkoutAction, /transition_order|approve_gcash_submission|settle_cod_payment/);
  assert.doesNotMatch(orderPage, /transition_order|approve_gcash_submission|settle_cod_payment|reject_gcash_submission/);
});

test("service role client is never exposed to browser or client components", async () => {
  const serverLib = await read("src/lib/supabase/server.ts");
  const clientLib = await read("src/lib/supabase/client.ts");
  const proxyLib = await read("src/lib/supabase/proxy.ts");

  assert.match(serverLib, /createServiceClient/);
  assert.doesNotMatch(clientLib, /createServiceClient|SUPABASE_SECRET_KEY/);
  assert.doesNotMatch(proxyLib, /createServiceClient|SUPABASE_SECRET_KEY/);
});
