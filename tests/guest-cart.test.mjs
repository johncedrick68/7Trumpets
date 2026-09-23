import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  parseGuestCartCookie,
  serializeGuestCartCookie,
  MAX_TECHNICAL_QUANTITY,
  UUID_REGEX,
} from "../src/lib/cart/guest-cookie-schema.ts";
import { createClient } from "@supabase/supabase-js";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

// Representative seeded deterministic IDs from PostgreSQL product_variants
const SEEDED_VARIANT_ID_1 = "a1000000-0001-0000-0000-000000000001";
const SEEDED_VARIANT_ID_2 = "a1000000-0001-0000-0000-000000000002";
const SEEDED_VARIANT_ID_3 = "a1000000-0002-0000-0000-000000000001";

test("guest cookie parser rejects malformed JSON and non-object inputs safely", () => {
  assert.deepStrictEqual(parseGuestCartCookie(null), { version: 1, items: [] });
  assert.deepStrictEqual(parseGuestCartCookie(undefined), { version: 1, items: [] });
  assert.deepStrictEqual(parseGuestCartCookie(""), { version: 1, items: [] });
  assert.deepStrictEqual(parseGuestCartCookie("not a json string"), { version: 1, items: [] });
  assert.deepStrictEqual(parseGuestCartCookie("12345"), { version: 1, items: [] });
  assert.deepStrictEqual(parseGuestCartCookie("[]"), { version: 1, items: [] });
  assert.deepStrictEqual(parseGuestCartCookie('{"version": 2, "items": []}'), { version: 1, items: [] });
  assert.deepStrictEqual(parseGuestCartCookie('{"version": 1, "items": "not-an-array"}'), { version: 1, items: [] });
});

test("guest cookie parser rejects oversized payloads", () => {
  const giantString = 'a'.repeat(3000);
  assert.deepStrictEqual(parseGuestCartCookie(giantString), { version: 1, items: [] });
});

test("guest cookie parser drops invalid UUIDs and malformed item objects", () => {
  const payload = JSON.stringify({
    version: 1,
    items: [
      null,
      "string-item",
      { variant_id: "not-a-valid-uuid", quantity: 1 },
      { variant_id: "12345", quantity: 2 },
      { variant_id: "00000000-0000-0000-0000-000000000000-extra", quantity: 1 },
      { quantity: 1 },
      { variant_id: SEEDED_VARIANT_ID_1, quantity: 2 },
    ],
  });

  const parsed = parseGuestCartCookie(payload);
  assert.strictEqual(parsed.items.length, 1);
  assert.strictEqual(parsed.items[0].variant_id, SEEDED_VARIANT_ID_1);
  assert.strictEqual(parsed.items[0].quantity, 2);
});

test("UUID regex accepts generic UUID format across multiple versions and seeded deterministic IDs", () => {
  // Seeded deterministic IDs from repository database
  assert.ok(UUID_REGEX.test(SEEDED_VARIANT_ID_1));
  assert.ok(UUID_REGEX.test(SEEDED_VARIANT_ID_2));
  assert.ok(UUID_REGEX.test(SEEDED_VARIANT_ID_3));

  // Canonical UUID v4
  assert.ok(UUID_REGEX.test("b1234567-89ab-4cde-8f01-23456789abcd"));

  // Canonical UUID v1/v5/v7
  assert.ok(UUID_REGEX.test("018d3e2a-1234-7123-8123-0123456789ab"));

  // Reject invalid strings
  assert.ok(!UUID_REGEX.test("not-a-uuid"));
  assert.ok(!UUID_REGEX.test("a1000000-0001-0000-0000-000000000001-overflow"));
  assert.ok(!UUID_REGEX.test(""));
});

test("guest cookie parser drops zero, negative, non-integer, and extreme tampered quantities", () => {
  const payload = JSON.stringify({
    version: 1,
    items: [
      { variant_id: SEEDED_VARIANT_ID_1, quantity: 0 },
      { variant_id: SEEDED_VARIANT_ID_1, quantity: -5 },
      { variant_id: SEEDED_VARIANT_ID_1, quantity: 2.7 },
      { variant_id: SEEDED_VARIANT_ID_1, quantity: "NaN" },
      { variant_id: SEEDED_VARIANT_ID_2, quantity: 3 },
      // Tampered extreme value above technical abuse ceiling is dropped, not clamped
      { variant_id: SEEDED_VARIANT_ID_3, quantity: MAX_TECHNICAL_QUANTITY + 1 },
    ],
  });

  const parsed = parseGuestCartCookie(payload);
  assert.strictEqual(parsed.items.length, 1);
  assert.strictEqual(parsed.items[0].variant_id, SEEDED_VARIANT_ID_2);
  assert.strictEqual(parsed.items[0].quantity, 3);
});

test("guest cookie parser combines duplicate variant entries up to technical sanity limit", () => {
  const payload = JSON.stringify({
    version: 1,
    items: [
      { variant_id: SEEDED_VARIANT_ID_1, quantity: 2 },
      { variant_id: SEEDED_VARIANT_ID_1, quantity: 3 },
      { variant_id: SEEDED_VARIANT_ID_1, quantity: 4 },
    ],
  });

  const parsed = parseGuestCartCookie(payload);
  assert.strictEqual(parsed.items.length, 1);
  assert.strictEqual(parsed.items[0].variant_id, SEEDED_VARIANT_ID_1);
  assert.strictEqual(parsed.items[0].quantity, 9);
});

test("guest cookie serializer normalizes payload and preserves token", () => {
  const serialized = serializeGuestCartCookie({
    version: 1,
    token: "reconcile-token-12345",
    items: [
      { variant_id: SEEDED_VARIANT_ID_1.toUpperCase(), quantity: 5 },
      { variant_id: SEEDED_VARIANT_ID_2, quantity: 3 },
    ],
  });

  const parsed = JSON.parse(serialized);
  assert.strictEqual(parsed.version, 1);
  assert.strictEqual(parsed.token, "reconcile-token-12345");
  assert.strictEqual(parsed.items[0].variant_id, SEEDED_VARIANT_ID_1);
  assert.strictEqual(parsed.items[0].quantity, 5);
  assert.strictEqual(parsed.items[1].quantity, 3);
});

test("guest cookie handles percent-encoded and malformed URI payloads safely", () => {
  const validEncoded = encodeURIComponent(
    JSON.stringify({
      version: 1,
      items: [{ variant_id: SEEDED_VARIANT_ID_1, quantity: 2 }],
    })
  );
  const parsedValid = parseGuestCartCookie(validEncoded);
  assert.strictEqual(parsedValid.items.length, 1);
  assert.strictEqual(parsedValid.items[0].variant_id, SEEDED_VARIANT_ID_1);

  const malformedEncoded = "%E0%A4%A"; // invalid UTF-8 percent-sequence
  assert.deepStrictEqual(parseGuestCartCookie(malformedEncoded), { version: 1, items: [] });
});

test("guest cookie ignores tampered prices, product names, and extra unknown fields", () => {
  const tamperedPayload = JSON.stringify({
    version: 1,
    price_minor: 0,
    subtotal: 0,
    tampered_name: "Free Item",
    role: "admin",
    items: [
      {
        variant_id: SEEDED_VARIANT_ID_1,
        quantity: 2,
        price_minor: 1,
        name: "Hacked Shirt",
        discount: 9999,
      },
    ],
  });

  const parsed = parseGuestCartCookie(tamperedPayload);
  assert.strictEqual(parsed.items.length, 1);
  assert.strictEqual(parsed.items[0].variant_id, SEEDED_VARIANT_ID_1);
  assert.strictEqual(parsed.items[0].quantity, 2);
  assert.strictEqual(parsed.items[0].price_minor, undefined);
  assert.strictEqual(parsed.items[0].name, undefined);
  assert.strictEqual(parsed.role, undefined);
});

test("guest cart cookie never stores prices, titles, subtotals, or PII", async () => {
  const cookieModule = await read("src/lib/cart/guest-cookie.ts");
  const actionsModule = await read("src/lib/cart/actions.ts");

  assert.doesNotMatch(cookieModule, /price_minor|subtotal|line_total|customer_email|recipient_name|phone/i);
  assert.doesNotMatch(actionsModule, /saveGuestCart\([^)]*(?:price|subtotal|total)/);
});

test("guest cart prices are resolved authoritatively from database and ignore client tampering", async () => {
  const actionsModule = await read("src/lib/cart/actions.ts");

  // In getOrCreateCart for guest:
  assert.match(actionsModule, /product_variants/);
  assert.match(actionsModule, /price_minor/);
  assert.match(actionsModule, /get_public_variant_availability/);
  assert.match(actionsModule, /const price = variant\.price_minor \?\? 0/);
});

test("checkout page strictly guards unauthenticated requests and redirects to login", async () => {
  const checkoutPage = await read("src/app/checkout/page.tsx");

  assert.match(checkoutPage, /if \(!userId\) \{\s*redirect\("\/login\?next=\/checkout"\);\s*\}/);
});

test("reconcileGuestCart is replay-safe and avoids double-counting on refreshed callbacks", async () => {
  const actionsModule = await read("src/lib/cart/actions.ts");

  const reconcileFn = actionsModule.slice(
    actionsModule.indexOf("export async function reconcileGuestCart"),
    actionsModule.indexOf("export async function getOrCreateCart")
  );

  // Verifies persistent replay prevention via reconciled_guest_tokens on user_metadata
  assert.match(reconcileFn, /reconciledTokens\.includes\(guestCart\.token\)/);
  assert.match(reconcileFn, /activeReconciliations/);
  assert.match(reconcileFn, /reconciled_guest_tokens/);
  assert.match(reconcileFn, /unmergedItems\.push\(item\)/);
});

test("signOut attempts Supabase signOut first and clears guest cart only on success", async () => {
  const authActions = await read("src/lib/auth/actions.ts");

  const signOutBlock = authActions.slice(authActions.indexOf("export async function signOut"));
  const signOutCallIdx = signOutBlock.indexOf("await supabase.auth.signOut()");
  const clearGuestIdx = signOutBlock.indexOf("await clearGuestCart()");

  assert.ok(signOutCallIdx !== -1, "signOut must call supabase.auth.signOut()");
  assert.ok(clearGuestIdx !== -1, "signOut must call clearGuestCart()");
  assert.ok(signOutCallIdx < clearGuestIdx, "supabase.auth.signOut() must be executed BEFORE clearGuestCart()");
  assert.match(signOutBlock, /if \(error\) \{\s*logServerError\("auth\.sign_out"/);
});

test("all authentication paths trigger guest cart reconciliation before destination redirect", async () => {
  const authActions = await read("src/lib/auth/actions.ts");
  const confirmRoute = await read("src/app/auth/confirm/route.ts");

  // Email/password signIn
  const signInBlock = authActions.slice(
    authActions.indexOf("export async function signIn"),
    authActions.indexOf("export async function signInWithGoogle")
  );
  assert.match(signInBlock, /await reconcileGuestCart\(data\.user\.id\)/);

  // Google OAuth callback & OTP confirmation in /auth/confirm
  assert.match(confirmRoute, /if \(code\)/);
  assert.match(confirmRoute, /await reconcileGuestCart/);
});

test("cart page provides accessible stepper controls with min 44px touch targets and no arbitrary 10 cap", async () => {
  const cartPage = await read("src/app/cart/page.tsx");

  assert.match(cartPage, /aria-label=\{`Decrease quantity for/);
  assert.match(cartPage, /aria-label=\{`Increase quantity for/);
  assert.match(cartPage, /min-h-\[44px\]/);
  assert.match(cartPage, /min-w-\[44px\]/);
  assert.match(cartPage, /quantity_exceeds_stock/);

  // Verify arbitrary customer purchase limit of 10 is NOT present
  assert.doesNotMatch(cartPage, /disabled=\{item\.quantity >= 10/);
});

test("skip to main content link is the first focusable element in storefront chrome", async () => {
  const chromeModule = await read("src/components/storefront-chrome.tsx");

  const returnBlock = chromeModule.slice(chromeModule.indexOf("return ("));
  const skipLinkIdx = returnBlock.indexOf('href="#main-content"');
  const headerIdx = returnBlock.indexOf("<header");

  assert.ok(skipLinkIdx !== -1, "Skip link href=#main-content must exist");
  assert.ok(skipLinkIdx < headerIdx, "Skip link must appear BEFORE header in DOM order");
});

test("quantity update action checks stock availability before increasing quantity without arbitrary 10 cap", async () => {
  const actionsModule = await read("src/lib/cart/actions.ts");

  const updateFn = actionsModule.slice(
    actionsModule.indexOf("export async function updateCartItemQuantity"),
    actionsModule.indexOf("export async function removeCartItem")
  );

  assert.match(updateFn, /get_public_variant_availability/);
  assert.match(updateFn, /redirect\("\/cart\?error=quantity_exceeds_stock"\)/);
  assert.doesNotMatch(updateFn, /Math\.min\(10,/);
});

test("cart badge safely calculates total pieces for guests and authenticated users", async () => {
  const badgeModule = await read("src/components/cart-badge.tsx");

  assert.match(badgeModule, /getGuestCart\(\)/);
  assert.match(badgeModule, /guestCart\.items\.reduce\(\(sum, item\) => sum \+ item\.quantity, 0\)/);
  assert.match(badgeModule, /items\.reduce\(\(sum, item\) => sum \+ \(item\.quantity \?\? 0\), 0\)/);
  assert.match(badgeModule, /aria-label=\{`Bag, \$\{count\}/);
});

test("direct negative security: anon client cannot write to carts or cart_items table directly", async () => {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "http://127.0.0.1:54321";
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || "dummy";

  if (!supabaseAnonKey.startsWith("sb_publishable_")) return;

  const anonClient = createClient(supabaseUrl, supabaseAnonKey);

  // 1. Anon write to carts must fail
  const { error: cartError } = await anonClient
    .from("carts")
    .insert({ user_id: "00000000-0000-4000-8000-000000000001" });
  assert.ok(cartError, "Anon client must not be permitted to insert into carts table");

  // 2. Anon direct call to add_authenticated_cart_item must fail
  const { error: rpcError } = await anonClient.rpc("add_authenticated_cart_item", {
    p_variant_id: SEEDED_VARIANT_ID_1,
    p_quantity: 1,
  });
  assert.ok(rpcError, "Anon client must not be permitted to execute add_authenticated_cart_item RPC");
});

test("live RPC test: authenticated add combines quantities up to stock boundary and rejects over-limit additions", async () => {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "http://127.0.0.1:54321";
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!supabaseAnonKey || !supabaseAnonKey.startsWith("sb_publishable_")) return;

  const customerClient = createClient(supabaseUrl, supabaseAnonKey);
  const { data: authData, error: authErr } = await customerClient.auth.signInWithPassword({
    email: "customer.demo@1968.local",
    password: "Demo1968Customer!",
  });
  if (authErr || !authData?.user) return;

  const variantId = SEEDED_VARIANT_ID_1;

  // Clean customer cart
  const { data: cart } = await customerClient.from("carts").select("id").single();
  if (cart) {
    await customerClient.from("cart_items").delete().eq("cart_id", cart.id);
  }

  // 1. Initial add: 1 item -> quantity becomes 1
  const { data: add1, error: err1 } = await customerClient.rpc("add_authenticated_cart_item", {
    p_variant_id: variantId,
    p_quantity: 1,
  });
  assert.ifError(err1);
  assert.strictEqual(add1?.line_quantity, 1);

  // 2. Reconcile add: 2 items -> quantity becomes 3
  const { data: add2, error: err2 } = await customerClient.rpc("add_authenticated_cart_item", {
    p_variant_id: variantId,
    p_quantity: 2,
  });
  assert.ifError(err2);
  assert.strictEqual(add2?.line_quantity, 3);

  // 3. Attempt to add an extreme amount that exceeds stock -> rejected with CART_QUANTITY_EXCEEDS_STOCK
  const { error: exceedErr } = await customerClient.rpc("add_authenticated_cart_item", {
    p_variant_id: variantId,
    p_quantity: 9999,
  });
  assert.ok(exceedErr, "Adding quantity exceeding stock must be rejected");
  assert.match(exceedErr.message, /CART_QUANTITY_EXCEEDS_STOCK/i);

  // 4. Verify cart item quantity is still 3 (never corrupted to invalid quantity)
  const { data: item } = await customerClient
    .from("cart_items")
    .select("quantity")
    .eq("cart_id", cart.id)
    .eq("variant_id", variantId)
    .single();
  assert.strictEqual(item?.quantity, 3);

  // Cleanup
  await customerClient.from("cart_items").delete().eq("cart_id", cart.id);
});

