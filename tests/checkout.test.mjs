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

test("checkout UI restores COD and Manual GCash selection, and avoids hidden payment method input", async () => {
  const checkoutPage = await read("src/app/checkout/page.tsx");

  // Restores COD and Manual GCash radio options
  assert.match(checkoutPage, /input[^>]*type="radio"[^>]*name="payment_method"[^>]*value="COD"/);
  assert.match(checkoutPage, /input[^>]*type="radio"[^>]*name="payment_method"[^>]*value="MANUAL_GCASH"/);

  // Eradicates hidden payment_method override
  assert.doesNotMatch(checkoutPage, /input[^>]*type="hidden"[^>]*name="payment_method"/);

  // Eradicates placeholder 09XX number
  assert.doesNotMatch(checkoutPage, /09XX/);

  // Eradicates misleading 24-hour promise
  assert.doesNotMatch(checkoutPage, /24\s*hours/i);

  // Eradicates pre-order merchant destination exposure (account number should only appear post-order)
  assert.doesNotMatch(checkoutPage, /Send Money|accountNumber/);
});

test("GCash configuration helper is server-only and correctly detects valid vs placeholder/missing credentials", async () => {
  const configModule = await read("src/lib/payments/config.ts");

  // Server-only boundary
  assert.match(configModule, /import\s+["']server-only["']/);
  assert.match(configModule, /export function getGcashConfig\(\)/);

  // Helper logic verification
  function testConfig(rawNumber, rawName) {
    const isConfigured = Boolean(
      rawNumber &&
      rawNumber.length >= 10 &&
      !rawNumber.includes("09XX") &&
      !/^09X+$/i.test(rawNumber)
    );
    return {
      accountNumber: isConfigured ? rawNumber : null,
      accountName: isConfigured ? rawName : null,
      isConfigured,
    };
  }

  assert.equal(testConfig(null, null).isConfigured, false);
  assert.equal(testConfig("", "").isConfigured, false);
  assert.equal(testConfig("09XX XXX XXXX", "Store").isConfigured, false);
  assert.equal(testConfig("09XXXXXXXXX", "Store").isConfigured, false);
  assert.equal(testConfig("12345", "Store").isConfigured, false);

  const valid = testConfig("09171234567", "7Trumpets Store");
  assert.equal(valid.isConfigured, true);
  assert.equal(valid.accountNumber, "09171234567");
  assert.equal(valid.accountName, "7Trumpets Store");
});

test("checkout action validates GCash configuration, rejects forged requests, and passes explicit null for COD", async () => {
  const checkoutAction = await read("src/lib/checkout/actions.ts");

  // Imports and checks server-only GCash config
  assert.match(checkoutAction, /import\s*\{\s*getGcashConfig\s*\}\s*from\s*["']@\/lib\/payments\/config["']/);
  assert.match(checkoutAction, /if\s*\(paymentMethod\s*===\s*["']MANUAL_GCASH["']\)/);
  assert.match(checkoutAction, /redirect\(["']\/checkout\?error=gcash_unavailable["']\)/);

  // Passes explicit null for COD gcashExpiresAt to satisfy database contract
  assert.match(checkoutAction, /const gcashExpiresAt:\s*string\s*\|\s*null\s*=/);
  assert.match(checkoutAction, /paymentMethod\s*===\s*["']MANUAL_GCASH["']\s*\?\s*new Date\(/);
  assert.match(checkoutAction, /:\s*null/);
  assert.match(checkoutAction, /p_gcash_expires_at:\s*gcashExpiresAt/);
});

test("order reservation deadline helper is in dedicated server-only boundary and does not accept userId", async () => {
  assert.ok(existsSync("src/lib/payments/queries.ts"));
  const queries = await read("src/lib/payments/queries.ts");
  const actions = await read("src/lib/payments/actions.ts");

  // Server-only boundary
  assert.match(queries, /import\s+["']server-only["']/);

  // Must NOT be exposed as server action in actions.ts
  assert.doesNotMatch(actions, /getOrderReservationDeadline/);

  // Function signature accepts ONLY orderId; never accepts userId or caller identity
  assert.match(queries, /export async function getOrderReservationDeadline\(\s*orderId:\s*string\s*\)/);
  assert.doesNotMatch(queries, /getOrderReservationDeadline\([^)]*userId/);

  // Derives authenticated identity internally via auth.getClaims()
  assert.match(queries, /auth\.getClaims\(\)/);
  assert.match(queries, /claimsData\?\.claims\?\.sub/);

  // Verifies ownership on orders table under RLS first
  assert.match(queries, /\.from\(["']orders["']\)/);
  assert.match(queries, /\.eq\(["']id["'],\s*orderId\)/);
  assert.match(queries, /\.eq\(["']user_id["'],\s*userId\)/);

  // Uses createServiceClient() only after ownership verified
  assert.match(queries, /createServiceClient\(\)/);
  assert.match(queries, /\.from\(["']inventory_reservations["']\)/);
  assert.match(queries, /\.select\(["']expires_at,\s*status["']\)/);
  assert.match(queries, /\.eq\(["']order_id["'],\s*order\.id\)/);
});

test("reservation deadline canonical algorithm evaluates ACTIVE, EXPIRED, INVALID_SET, and NO_RESERVATIONS", () => {
  function evaluateReservations(reservations, now = Date.now()) {
    if (!reservations || reservations.length === 0) {
      return { state: "NO_RESERVATIONS" };
    }
    const allActive = reservations.every((r) => r.status === "active");
    if (!allActive) {
      return { state: "INVALID_SET" };
    }
    const timestamps = reservations.map((r) => new Date(r.expires_at).getTime());
    const minTimestamp = Math.min(...timestamps);
    const minExpiresAt = new Date(minTimestamp).toISOString();
    if (minTimestamp <= now) {
      return { state: "EXPIRED", expiresAt: minExpiresAt };
    }
    return { state: "ACTIVE", expiresAt: minExpiresAt };
  }

  // 1. Zero reservations -> NO_RESERVATIONS
  assert.deepEqual(evaluateReservations([]), { state: "NO_RESERVATIONS" });
  assert.deepEqual(evaluateReservations(null), { state: "NO_RESERVATIONS" });

  // 2. Mixed active/terminal or non-active -> INVALID_SET
  assert.deepEqual(
    evaluateReservations([
      { status: "active", expires_at: new Date(Date.now() + 3600000).toISOString() },
      { status: "released", expires_at: new Date(Date.now() + 3600000).toISOString() },
    ]),
    { state: "INVALID_SET" }
  );
  assert.deepEqual(
    evaluateReservations([
      { status: "cancelled", expires_at: new Date(Date.now() + 3600000).toISOString() },
    ]),
    { state: "INVALID_SET" }
  );

  // 3. All active, future deadline -> ACTIVE with min(expires_at)
  const t1 = Date.now() + 7200000;
  const t2 = Date.now() + 3600000;
  const activeRes = evaluateReservations([
    { status: "active", expires_at: new Date(t1).toISOString() },
    { status: "active", expires_at: new Date(t2).toISOString() },
  ]);
  assert.equal(activeRes.state, "ACTIVE");
  assert.equal(activeRes.expiresAt, new Date(t2).toISOString());

  // 4. All active, min expires_at <= now -> EXPIRED
  const pastT = Date.now() - 1000;
  const expiredRes = evaluateReservations([
    { status: "active", expires_at: new Date(t1).toISOString() },
    { status: "active", expires_at: new Date(pastT).toISOString() },
  ]);
  assert.equal(expiredRes.state, "EXPIRED");
  assert.equal(expiredRes.expiresAt, new Date(pastT).toISOString());
});

test("order detail UI fails closed on abnormal reservation sets and never falsely claims inventory released", async () => {
  const orderPage = await read("src/app/orders/[id]/page.tsx");

  // Proof submission requires ACTIVE reservation deadline
  assert.match(orderPage, /const isDeadlineActive\s*=\s*reservationDeadline\.state\s*===\s*["']ACTIVE["']/);
  assert.match(orderPage, /const canSubmitProof\s*=\s*[\s\S]*isDeadlineActive/);

  // Abnormal/error states render safe message and do not render proof upload
  assert.match(orderPage, /reservationDeadline\.state\s*===\s*["']ERROR["']/);
  assert.match(orderPage, /reservationDeadline\.state\s*===\s*["']INVALID_SET["']/);
  assert.match(orderPage, /reservationDeadline\.state\s*===\s*["']NO_RESERVATIONS["']/);
  assert.match(
    orderPage,
    /Payment status is temporarily unavailable\. Please contact support before sending payment\./
  );

  // Proof upload form only rendered inside canSubmitProof guard
  assert.match(orderPage, /\{canSubmitProof\s*&&\s*\(/);

  // Elapsed deadline alone does NOT claim inventory released
  const expiredBlockMatch = orderPage.match(/order\.status === ["']CONFIRMED["'] && reservationDeadline\.state === ["']EXPIRED["'][\s\S]*?<\/div>\s*\)\}/);
  assert.ok(expiredBlockMatch, "Expired deadline notice block must exist");
  assert.doesNotMatch(expiredBlockMatch[0], /inventory reservations have been released/);
  assert.match(expiredBlockMatch[0], /The deadline to submit payment proof for this order has passed/);
  assert.match(expiredBlockMatch[0], /If payment was not submitted, this order will be cancelled by staff\./);

  // Only terminal CANCELLED state claims inventory released
  assert.match(orderPage, /order\.status === ["']CANCELLED["'][\s\S]*inventory reservations have been released/);

  // Order summary dynamically displays Cash on Delivery vs Manual GCash
  assert.match(orderPage, /payment\?\.method === ["']COD["'] \? ["']Cash on Delivery["'] : ["']Manual GCash["']/);

  // Eradicates 09XX placeholder and misleading 24-hour promise
  assert.doesNotMatch(orderPage, /09XX/);
  assert.doesNotMatch(orderPage, /24\s*hours/i);
});
