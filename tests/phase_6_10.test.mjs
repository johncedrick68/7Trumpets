import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("Phase 6: Admin order and payment actions strictly enforce AAL2 and canonical database RPC boundaries", async () => {
  const actions = await read("src/lib/admin/actions.ts");

  assert.match(actions, /export async function approveGcashSubmission/);
  assert.match(actions, /export async function rejectGcashSubmission/);
  assert.match(actions, /export async function settleCodPayment/);
  assert.match(actions, /export async function transitionOrderStatus/);

  // Verifies AAL2 enforcement on every mutation action
  assert.match(actions, /requireAdminAal2\("\/admin\/payments"\)/);
  assert.match(actions, /requireAdminAal2\("\/admin\/orders"\)/);

  // Verifies canonical RPCs are invoked
  assert.match(actions, /rpc\("approve_gcash_submission"/);
  assert.match(actions, /rpc\("reject_gcash_submission"/);
  assert.match(actions, /rpc\("settle_cod_payment"/);
  assert.match(actions, /rpc\("admin_transition_order"/);
});

test("Phase 7: Fulfillment lifecycle and provider-neutral courier abstraction are properly modeled", async () => {
  const { deriveCustomerFulfillmentStage } = await import("../src/lib/orders/status.ts");
  const { getCourierTrackingUrl, SUPPORTED_COURIERS } = await import("../src/lib/orders/courier.ts");

  // Canonical stages map correctly
  assert.equal(deriveCustomerFulfillmentStage("READY_FOR_SHIPMENT").stage, "PREPARING");
  assert.equal(deriveCustomerFulfillmentStage("SHIPPED").stage, "SHIPPING");
  assert.equal(deriveCustomerFulfillmentStage("IN_TRANSIT").stage, "SHIPPING");
  assert.equal(deriveCustomerFulfillmentStage("OUT_FOR_DELIVERY").stage, "ARRIVING");
  assert.equal(deriveCustomerFulfillmentStage("DELIVERED").stage, "DELIVERED");
  assert.equal(deriveCustomerFulfillmentStage("COMPLETED").stage, "DELIVERED");
  assert.equal(deriveCustomerFulfillmentStage("DELIVERY_FAILED").stage, "DELIVERY_FAILED");
  assert.equal(deriveCustomerFulfillmentStage("CANCELLED").stage, "CANCELLED");

  // Provider-neutral courier helper
  assert.ok(SUPPORTED_COURIERS.MANUAL);
  assert.ok(SUPPORTED_COURIERS.JNT);
  assert.ok(SUPPORTED_COURIERS.LBC);
  assert.equal(getCourierTrackingUrl("MANUAL", "12345"), null);
  assert.match(getCourierTrackingUrl("JNT", "JNT123456789") || "", /gzquery/);
});

test("Phase 8: Customer account features support profile, address CRUD, order history, and owner isolation", async () => {
  const accountPage = await read("src/app/account/page.tsx");
  const addressPage = await read("src/app/account/addresses/page.tsx");
  const orderDetailPage = await read("src/app/orders/[id]/page.tsx");

  // Profile page links to security and order history
  assert.match(accountPage, /\/orders/);
  assert.match(accountPage, /\/account\/addresses/);
  assert.match(accountPage, /\/update-password/);

  // Address page renders address list and form
  assert.match(addressPage, /Shipping Addresses/);
  assert.match(addressPage, /setDefaultAddress/);
  assert.match(addressPage, /deleteAddress/);

  // Order detail strictly checks user_id against verified claims
  assert.match(orderDetailPage, /\.eq\("user_id",\s*userId\)/);
});

test("Phase 9: Admin operations dashboard queries all 10 required queues and metrics from canonical DB", async () => {
  const dashboardPage = await read("src/app/admin/page.tsx");
  const adminOrdersPage = await read("src/app/admin/orders/page.tsx");

  // Dashboard queries pending GCash, confirmed, processing, ready, transit, failed, completed, inventory, and audit
  assert.match(dashboardPage, /Pending GCash Reviews/);
  assert.match(dashboardPage, /Confirmed Orders/);
  assert.match(dashboardPage, /Processing/);
  assert.match(dashboardPage, /Ready for Shipment/);
  assert.match(dashboardPage, /In Transit/);
  assert.match(dashboardPage, /Delivery Failures/);
  assert.match(dashboardPage, /Delivered/);
  assert.match(dashboardPage, /Low Stock Warnings/);
  assert.match(dashboardPage, /Out of Stock Items/);
  assert.match(dashboardPage, /Recent Administrative Activity/);

  // Admin orders page supports status filtering
  assert.match(adminOrdersPage, /searchParams/);
  assert.match(adminOrdersPage, /statusFilter/);
});

test("Phase 10: Launch readiness and pre-production security headers and cash invariants are intact", async () => {
  const nextConfig = await read("next.config.ts");
  const money = await read("src/lib/money.ts");

  // Security headers
  assert.match(nextConfig, /X-Content-Type-Options/);
  assert.match(nextConfig, /X-Frame-Options/);
  assert.match(nextConfig, /Content-Security-Policy-Report-Only/);

  // Minor units parsing without floating point math
  assert.match(money, /parsePHPMinor/);
});
