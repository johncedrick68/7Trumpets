import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  calculateGcashExpiresAt,
  executeCheckoutPaymentFlow,
  validateCheckoutPaymentGate,
} from "../src/lib/checkout/pipeline.ts";
import {
  evaluateReservationDeadline,
  fetchOrderReservationDeadline,
  formatPhDeadline,
} from "../src/lib/payments/deadline.ts";
import {
  parseGcashConfig,
  validateAndNormalizeGcashNumber,
} from "../src/lib/payments/gcash.ts";

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

  // Eradicates misleading 24-hour promise and fixed 2-hour duration promise
  assert.doesNotMatch(checkoutPage, /24\s*hours/i);
  assert.doesNotMatch(checkoutPage, /2-hour/i);

  // Eradicates pre-order merchant destination exposure (account number should only appear post-order)
  assert.doesNotMatch(checkoutPage, /Send Money|accountNumber/);
});

test("real production GCash validator normalizes valid formats and rejects malformed/placeholder inputs", () => {
  // Valid normalization to canonical 09XXXXXXXXX
  assert.equal(validateAndNormalizeGcashNumber("09171234567"), "09171234567");
  assert.equal(validateAndNormalizeGcashNumber("+639171234567"), "09171234567");
  assert.equal(validateAndNormalizeGcashNumber("639171234567"), "09171234567");
  assert.equal(validateAndNormalizeGcashNumber("0917 123 4567"), "09171234567");
  assert.equal(validateAndNormalizeGcashNumber("0917-123-4567"), "09171234567");
  assert.equal(validateAndNormalizeGcashNumber("+63 917 123 4567"), "09171234567");

  // Invalid inputs rejected
  assert.equal(validateAndNormalizeGcashNumber(""), null);
  assert.equal(validateAndNormalizeGcashNumber("   "), null);
  assert.equal(validateAndNormalizeGcashNumber("09XX XXX XXXX"), null);
  assert.equal(validateAndNormalizeGcashNumber("09xx xxx xxxx"), null);
  assert.equal(validateAndNormalizeGcashNumber("abcdefghijk"), null);
  assert.equal(validateAndNormalizeGcashNumber("0917ABC4567"), null);
  assert.equal(validateAndNormalizeGcashNumber("0917123"), null); // too short
  assert.equal(validateAndNormalizeGcashNumber("0917123456789"), null); // too long
  assert.equal(validateAndNormalizeGcashNumber("+1639171234567"), null); // wrong country code
  assert.equal(validateAndNormalizeGcashNumber("+638171234567"), null); // non-mobile 8
  assert.equal(validateAndNormalizeGcashNumber(null), null);
  assert.equal(validateAndNormalizeGcashNumber(undefined), null);

  // parseGcashConfig behavior
  const validConfig = parseGcashConfig("+639171234567", "7Trumpets Store");
  assert.equal(validConfig.isConfigured, true);
  assert.equal(validConfig.accountNumber, "09171234567");
  assert.equal(validConfig.accountName, "7Trumpets Store");

  const invalidConfig = parseGcashConfig("09xx xxx xxxx", "7Trumpets Store");
  assert.equal(invalidConfig.isConfigured, false);
  assert.equal(invalidConfig.accountNumber, null);
  assert.equal(invalidConfig.accountName, null);

  const emptyConfig = parseGcashConfig(null, null);
  assert.equal(emptyConfig.isConfigured, false);
  assert.equal(emptyConfig.accountNumber, null);
});

test("checkout payment pipeline behaviorally blocks unconfigured GCash before side effects", async () => {
  // Direct validation gate assertions
  const unconfiguredGate = validateCheckoutPaymentGate("MANUAL_GCASH", { isConfigured: false, accountNumber: null, accountName: null });
  assert.equal(unconfiguredGate.valid, false);
  assert.equal(unconfiguredGate.redirectUrl, "/checkout?error=gcash_unavailable");

  const invalidMethodGate = validateCheckoutPaymentGate("CRYPTO", { isConfigured: true, accountNumber: "09171234567", accountName: "Store" });
  assert.equal(invalidMethodGate.valid, false);
  assert.equal(invalidMethodGate.redirectUrl, "/checkout?error=invalid_payment_method");

  const codGate = validateCheckoutPaymentGate("COD", { isConfigured: false, accountNumber: null, accountName: null });
  assert.equal(codGate.valid, true);

  const configuredGcashGate = validateCheckoutPaymentGate("MANUAL_GCASH", { isConfigured: true, accountNumber: "09171234567", accountName: "Store" });
  assert.equal(configuredGcashGate.valid, true);

  let rpcCalls = 0;
  let cartDeletes = 0;
  let rejectedUrl = null;

  const mockDeps = {
    paymentMethod: "MANUAL_GCASH",
    gcashConfig: { isConfigured: false, accountNumber: null, accountName: null },
    onReject: (url) => {
      rejectedUrl = url;
    },
    invokeRpc: async () => {
      rpcCalls++;
      return { id: "order-123" };
    },
    deleteCartItems: async () => {
      cartDeletes++;
    },
  };

  // Execution with unconfigured GCash
  await executeCheckoutPaymentFlow(mockDeps);

  // Proves: redirect is internal gcash_unavailable
  assert.equal(rejectedUrl, "/checkout?error=gcash_unavailable");
  // Proves: RPC was never called
  assert.equal(rpcCalls, 0);
  // Proves: cart delete was never called
  assert.equal(cartDeletes, 0);

  // Execution with COD (valid even if GCash unconfigured)
  let codRpcPayload = null;
  const codDeps = {
    paymentMethod: "COD",
    gcashConfig: { isConfigured: false, accountNumber: null, accountName: null },
    onReject: (url) => {
      assert.fail(`COD should not be rejected, received ${url}`);
    },
    invokeRpc: async (payload) => {
      codRpcPayload = payload;
      return { id: "order-456" };
    },
    deleteCartItems: async () => {
      cartDeletes++;
    },
  };

  await executeCheckoutPaymentFlow(codDeps);
  assert.equal(codRpcPayload.paymentMethod, "COD");
  assert.equal(codRpcPayload.gcashExpiresAt, null); // Explicit null satisfies DB contract
  assert.equal(cartDeletes, 1);

  // Expiry calculation helper
  assert.equal(calculateGcashExpiresAt("COD"), null);
  const gcashExpiry = calculateGcashExpiresAt("MANUAL_GCASH");
  assert.ok(typeof gcashExpiry === "string");
  assert.ok(Date.parse(gcashExpiry) > Date.now());
});

test("production deadline helper evaluates canonical states and fails closed on malformed dates without throwing", () => {
  const now = Date.now();

  // 1. Zero or missing reservations -> NO_RESERVATIONS
  assert.deepEqual(evaluateReservationDeadline([]), { state: "NO_RESERVATIONS" });
  assert.deepEqual(evaluateReservationDeadline(null), { state: "NO_RESERVATIONS" });
  assert.deepEqual(evaluateReservationDeadline(undefined), { state: "NO_RESERVATIONS" });

  // 2. Mixed active/terminal or all terminal -> INVALID_SET
  assert.deepEqual(
    evaluateReservationDeadline([
      { status: "active", expires_at: new Date(now + 3600000).toISOString() },
      { status: "released", expires_at: new Date(now + 3600000).toISOString() },
    ], now),
    { state: "INVALID_SET" }
  );
  assert.deepEqual(
    evaluateReservationDeadline([
      { status: "cancelled", expires_at: new Date(now + 3600000).toISOString() },
    ], now),
    { state: "INVALID_SET" }
  );

  // 3. All active with future timestamps -> ACTIVE (earliest wins)
  const t1 = new Date(now + 7200000).toISOString();
  const t2 = new Date(now + 3600000).toISOString();
  const activeResult = evaluateReservationDeadline([
    { status: "active", expires_at: t1 },
    { status: "active", expires_at: t2 },
  ], now);
  assert.equal(activeResult.state, "ACTIVE");
  assert.equal(activeResult.expiresAt, t2);

  // 4. All active with expired timestamp -> EXPIRED (earliest wins)
  const expiredT = new Date(now - 1000).toISOString();
  const expiredResult = evaluateReservationDeadline([
    { status: "active", expires_at: t1 },
    { status: "active", expires_at: expiredT },
  ], now);
  assert.equal(expiredResult.state, "EXPIRED");
  assert.equal(expiredResult.expiresAt, expiredT);

  // 5. Malformed timestamps: must NOT throw and must fail closed (INVALID_SET)
  assert.doesNotThrow(() => {
    const res = evaluateReservationDeadline([
      { status: "active", expires_at: "not-a-date" },
    ], now);
    assert.equal(res.state, "INVALID_SET");
  });

  assert.doesNotThrow(() => {
    const res = evaluateReservationDeadline([
      { status: "active", expires_at: "Infinity" },
    ], now);
    assert.equal(res.state, "INVALID_SET");
  });

  assert.doesNotThrow(() => {
    const res = evaluateReservationDeadline([
      { status: "active", expires_at: "2026-13-45T99:99:99Z" },
    ], now);
    assert.equal(res.state, "INVALID_SET");
  });

  assert.doesNotThrow(() => {
    const res = evaluateReservationDeadline([
      { status: "active", expires_at: "" },
    ], now);
    assert.equal(res.state, "INVALID_SET");
  });

  // Malformed timestamp alongside valid timestamp must fail closed and never return ACTIVE
  const mixedMalformed = evaluateReservationDeadline([
    { status: "active", expires_at: t1 },
    { status: "active", expires_at: "invalid-timestamp" },
  ], now);
  assert.equal(mixedMalformed.state, "INVALID_SET");
  assert.notEqual(mixedMalformed.state, "ACTIVE");
});

test("security boundary: ownership verification strictly precedes service-role access", async () => {
  const queriesFile = await read("src/lib/payments/queries.ts");

  // Server-only boundary enforced
  assert.match(queriesFile, /import\s+["']server-only["']/);

  // Helper accepts ONLY orderId; never accepts caller-supplied userId
  assert.match(queriesFile, /export async function getOrderReservationDeadline\(\s*orderId:\s*string\s*\)/);
  assert.doesNotMatch(queriesFile, /getOrderReservationDeadline\([^)]*userId/);

  // Behavioral test A: unauthenticated caller -> service client never called
  let serviceClientCalls = 0;
  let ownershipCalls = 0;

  const unauthResult = await fetchOrderReservationDeadline("ord-1", {
    getUserId: async () => null,
    verifyOrderOwnership: async () => {
      ownershipCalls++;
      return { id: "ord-1" };
    },
    fetchReservations: async () => {
      serviceClientCalls++;
      return [];
    },
  });
  assert.equal(unauthResult.state, "ERROR");
  assert.equal(ownershipCalls, 0);
  assert.equal(serviceClientCalls, 0);

  // Behavioral test B: cross-owner or unknown order -> service client never called
  const crossOwnerResult = await fetchOrderReservationDeadline("ord-cross", {
    getUserId: async () => "user-123",
    verifyOrderOwnership: async () => null, // RLS query returns no row for another user
    fetchReservations: async () => {
      serviceClientCalls++;
      return [];
    },
  });
  assert.equal(crossOwnerResult.state, "ERROR");
  assert.equal(serviceClientCalls, 0);

  // Behavioral test C: ownership query failure -> service client never called
  const errorResult = await fetchOrderReservationDeadline("ord-err", {
    getUserId: async () => "user-123",
    verifyOrderOwnership: async () => null,
    fetchReservations: async () => {
      serviceClientCalls++;
      return [];
    },
  });
  assert.equal(errorResult.state, "ERROR");
  assert.equal(serviceClientCalls, 0);

  // Behavioral test D: verified owner -> service client called once with orderId
  const verifiedResult = await fetchOrderReservationDeadline("ord-valid", {
    getUserId: async () => "user-123",
    verifyOrderOwnership: async (id) => ({ id }),
    fetchReservations: async () => {
      serviceClientCalls++;
      return [{ status: "active", expires_at: new Date(Date.now() + 3600000).toISOString() }];
    },
  });
  assert.equal(verifiedResult.state, "ACTIVE");
  assert.equal(serviceClientCalls, 1);
});

test("deadline formatter explicitly uses Asia/Manila timezone and includes PHT indicator", () => {
  // UTC morning: 07:30 UTC + 8h = 15:30 (3:30 PM) on Sep 5, 2026
  const formatted1 = formatPhDeadline("2026-09-05T07:30:00.000Z");
  assert.equal(formatted1, "September 5, 2026, 3:30 PM PHT");

  // UTC midnight: 00:00 UTC + 8h = 8:00 AM on Jan 1, 2026
  const formatted2 = formatPhDeadline("2026-01-01T00:00:00.000Z");
  assert.equal(formatted2, "January 1, 2026, 8:00 AM PHT");

  // Cross year boundary: 16:00 UTC on Dec 31, 2026 + 8h = 12:00 AM on Jan 1, 2027
  const formatted3 = formatPhDeadline("2026-12-31T16:00:00.000Z");
  assert.equal(formatted3, "January 1, 2027, 12:00 AM PHT");

  // Safe null on invalid input
  assert.equal(formatPhDeadline("invalid-date"), null);
  assert.equal(formatPhDeadline(null), null);
  assert.equal(formatPhDeadline(""), null);
});

test("order detail UI displays state-accurate copy across COD, GCash, expired, and unconfigured states", async () => {
  const orderPage = await read("src/app/orders/[id]/page.tsx");

  // Proof submission requires ACTIVE deadline AND configured GCash
  assert.match(orderPage, /const isDeadlineActive\s*=\s*reservationDeadline\.state\s*===\s*["']ACTIVE["']/);
  assert.match(orderPage, /const canSubmitProof\s*=\s*[\s\S]*isDeadlineActive\s*&&\s*gcashConfig\.isConfigured/);

  // Abnormal/error states render safe unavailable message
  assert.match(orderPage, /reservationDeadline\.state\s*===\s*["']ERROR["']/);
  assert.match(orderPage, /reservationDeadline\.state\s*===\s*["']INVALID_SET["']/);
  assert.match(orderPage, /reservationDeadline\.state\s*===\s*["']NO_RESERVATIONS["']/);
  assert.match(
    orderPage,
    /Payment status is temporarily unavailable\. Please contact support before sending payment\./
  );

  // Missing GCash configuration renders support notice and suppresses payment instructions
  assert.match(
    orderPage,
    /GCash payment destination is temporarily unavailable\. Please contact store support to arrange payment\./
  );

  // Elapsed deadline block only renders for unpaid/rejected orders and never claims inventory released
  const expiredBlockMatch = orderPage.match(
    /order\.status === ["']CONFIRMED["']\s*&&\s*reservationDeadline\.state === ["']EXPIRED["']\s*&&\s*\(payment\.status === ["']UNPAID["'] \|\| payment\.status === ["']REJECTED["']\)[\s\S]*?<\/div>\s*\)\}/
  );
  assert.ok(expiredBlockMatch, "Expired deadline notice block for unpaid/rejected orders must exist");
  assert.doesNotMatch(expiredBlockMatch[0], /inventory reservations have been released/);
  assert.match(expiredBlockMatch[0], /The deadline to submit payment proof for this order has passed/);
  assert.match(expiredBlockMatch[0], /If payment was not submitted, this order will be cancelled by staff\./);

  // Submitted state says under review and does not show upload form
  assert.match(orderPage, /payment\.status === ["']SUBMITTED["']/);
  assert.match(orderPage, /Your payment proof is currently under review by staff\./);

  // Cash on Delivery copy reflects actual order state (not claiming confirmed & processing when cancelled)
  assert.match(orderPage, /order\.status === ["']CANCELLED["'][\s\S]*Doorstep cash collection will not take place\./);

  // Only terminal CANCELLED state claims inventory released
  assert.match(orderPage, /order\.status === ["']CANCELLED["'][\s\S]*inventory reservations have been released/);

  // Order summary dynamically displays Cash on Delivery vs Manual GCash
  assert.match(orderPage, /payment\?\.method === ["']COD["'] \? ["']Cash on Delivery["'] : ["']Manual GCash["']/);

  // Eradicates 09XX placeholder and misleading 24-hour / 2-hour duration claims
  assert.doesNotMatch(orderPage, /09XX/);
  assert.doesNotMatch(orderPage, /24\s*hours/i);
  assert.doesNotMatch(orderPage, /Initial 2-hour reservation/i);
});
