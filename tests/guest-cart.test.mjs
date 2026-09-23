import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  parseGuestCartCookie,
  serializeGuestCartCookie,
  MAX_LINE_QUANTITY,
} from "../src/lib/cart/guest-cookie-schema.ts";
import { createClient } from "@supabase/supabase-js";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

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
      { variant_id: "a0000000-0000-4000-8000-000000000001", quantity: 2 },
    ],
  });

  const parsed = parseGuestCartCookie(payload);
  assert.strictEqual(parsed.items.length, 1);
  assert.strictEqual(parsed.items[0].variant_id, "a0000000-0000-4000-8000-000000000001");
  assert.strictEqual(parsed.items[0].quantity, 2);
});

test("guest cookie parser drops zero, negative, and non-integer quantities and caps extreme values", () => {
  const validUuid1 = "a0000000-0000-4000-8000-000000000001";
  const validUuid2 = "a0000000-0000-4000-8000-000000000002";
  const validUuid3 = "a0000000-0000-4000-8000-000000000003";

  const payload = JSON.stringify({
    version: 1,
    items: [
      { variant_id: validUuid1, quantity: 0 },
      { variant_id: validUuid1, quantity: -5 },
      { variant_id: validUuid1, quantity: 2.7 },
      { variant_id: validUuid1, quantity: "NaN" },
      { variant_id: validUuid2, quantity: 3 },
      { variant_id: validUuid3, quantity: 9999 },
    ],
  });

  const parsed = parseGuestCartCookie(payload);
  assert.strictEqual(parsed.items.length, 2);
  assert.strictEqual(parsed.items.find((i) => i.variant_id === validUuid2)?.quantity, 3);
  assert.strictEqual(parsed.items.find((i) => i.variant_id === validUuid3)?.quantity, MAX_LINE_QUANTITY);
});

test("guest cookie parser combines duplicate variant entries up to maximum allowed quantity", () => {
  const validUuid = "a0000000-0000-4000-8000-000000000001";

  const payload = JSON.stringify({
    version: 1,
    items: [
      { variant_id: validUuid, quantity: 2 },
      { variant_id: validUuid, quantity: 3 },
      { variant_id: validUuid, quantity: 4 },
    ],
  });

  const parsed = parseGuestCartCookie(payload);
  assert.strictEqual(parsed.items.length, 1);
  assert.strictEqual(parsed.items[0].variant_id, validUuid);
  assert.strictEqual(parsed.items[0].quantity, 9);
});

test("guest cookie serializer normalizes and clamps payload", () => {
  const serialized = serializeGuestCartCookie({
    version: 1,
    items: [
      { variant_id: "A0000000-0000-4000-8000-000000000001", quantity: 25 },
      { variant_id: "b0000000-0000-4000-8000-000000000002", quantity: 0.5 },
    ],
  });

  const parsed = JSON.parse(serialized);
  assert.strictEqual(parsed.version, 1);
  assert.strictEqual(parsed.items[0].variant_id, "a0000000-0000-4000-8000-000000000001");
  assert.strictEqual(parsed.items[0].quantity, MAX_LINE_QUANTITY);
  assert.strictEqual(parsed.items[1].quantity, 1);
});

test("guest cart cookie never stores prices, titles, subtotals, or PII", async () => {
  const cookieModule = await read("src/lib/cart/guest-cookie.ts");
  const actionsModule = await read("src/lib/cart/actions.ts");

  assert.doesNotMatch(cookieModule, /price_minor|subtotal|line_total|customer_email|recipient_name|phone/i);
  assert.doesNotMatch(actionsModule, /saveGuestCart\([^)]*(?:price|subtotal|total)/);
});

test("guest cart prices are resolved authoritatively from database and ignore any client tampering", async () => {
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

test("logout clears guest cart cookie to prevent leaking previous user session", async () => {
  const authActions = await read("src/lib/auth/actions.ts");

  const signOutBlock = authActions.slice(authActions.indexOf("export async function signOut"));
  assert.match(signOutBlock, /await clearGuestCart\(\)/);
  assert.match(signOutBlock, /await supabase\.auth\.signOut\(\)/);
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

test("reconcileGuestCart preserves unmerged items on failure instead of destroying guest cart", async () => {
  const actionsModule = await read("src/lib/cart/actions.ts");

  const reconcileFn = actionsModule.slice(
    actionsModule.indexOf("export async function reconcileGuestCart"),
    actionsModule.indexOf("export async function getOrCreateCart")
  );

  assert.match(reconcileFn, /unmergedItems\.push\(item\)/);
  assert.match(reconcileFn, /if \(unmergedItems\.length === 0\) \{\s*await clearGuestCart\(\);/);
  assert.match(reconcileFn, /else if \(unmergedItems\.length < guestCart\.items\.length\) \{\s*await saveGuestCart\(\{ version: 1, items: unmergedItems \}\);/);
});

test("cart page provides accessible stepper controls with min 44px touch targets", async () => {
  const cartPage = await read("src/app/cart/page.tsx");

  assert.match(cartPage, /aria-label=\{`Decrease quantity for/);
  assert.match(cartPage, /aria-label=\{`Increase quantity for/);
  assert.match(cartPage, /min-h-\[44px\]/);
  assert.match(cartPage, /min-w-\[44px\]/);
  assert.match(cartPage, /quantity_exceeds_stock/);
  assert.match(cartPage, /params\.error === "quantity_exceeds_stock"/);
});

test("quantity update action checks stock availability before increasing quantity", async () => {
  const actionsModule = await read("src/lib/cart/actions.ts");

  const updateFn = actionsModule.slice(
    actionsModule.indexOf("export async function updateCartItemQuantity"),
    actionsModule.indexOf("export async function removeCartItem")
  );

  assert.match(updateFn, /get_public_variant_availability/);
  assert.match(updateFn, /redirect\("\/cart\?error=quantity_exceeds_stock"\)/);
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
    p_variant_id: "00000000-0000-4000-8000-000000000001",
    p_quantity: 1,
  });
  assert.ok(rpcError, "Anon client must not be permitted to execute add_authenticated_cart_item RPC");
});

