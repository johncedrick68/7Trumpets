// scripts/verify-master-retail-flows.mjs
// Empirical 12-Flow Full Retail Hardening Verification Suite
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { generateTOTP } from "./generate-totp.mjs";
import { assertLocalSupabaseTarget } from "./local-supabase-guard.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));

function loadEnv() {
  try {
    const envPath = resolve(__dirname, "../.env.local");
    const lines = readFileSync(envPath, "utf-8").split("\n");
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const eqIdx = trimmed.indexOf("=");
      if (eqIdx === -1) continue;
      const key = trimmed.slice(0, eqIdx).trim();
      const val = trimmed.slice(eqIdx + 1).trim();
      if (!process.env[key]) process.env[key] = val;
    }
  } catch (err) {
    console.warn("Could not load .env.local", err);
  }
}

loadEnv();

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "http://127.0.0.1:54321";
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const serviceRoleKey = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

assertLocalSupabaseTarget(supabaseUrl, "Retail-flow QA");

assert.ok(anonKey, "Publishable key must be defined");
assert.ok(serviceRoleKey, "Secret key must be defined");

async function runEmpiricalFlows() {
  console.log("================================================================================");
  console.log("  1968 CLOTHING — MASTER RETAIL SYSTEM EMPIRICAL 12-FLOW VERIFICATION SUITE");
  console.log("================================================================================");
  console.log(`Target: ${supabaseUrl}`);

  const serviceClient = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false } });
  const adminClient = createClient(supabaseUrl, anonKey, { auth: { persistSession: false } });
  const customerClient = createClient(supabaseUrl, anonKey, { auth: { persistSession: false } });
  const getPayment = (o) => (Array.isArray(o.payments) ? o.payments[0] : o.payments);

  // 1. Authenticate Admin with Password & TOTP AAL2
  console.log("\n[AUTH] Signing in Admin (admin.demo@1968.local)...");
  const { data: adminAuth, error: adminSignInErr } = await adminClient.auth.signInWithPassword({
    email: "admin.demo@1968.local",
    password: "Demo1968Admin!",
  });
  assert.ifError(adminSignInErr);
  const adminUserId = adminAuth.user.id;

  const { error: aal1ShipmentError } = await adminClient.rpc("admin_create_shipment", {
    p_order_id: "00000000-0000-0000-0000-000000000000",
    p_provider: "J&T",
    p_tracking_number: "AAL1-MUST-BE-DENIED",
  });
  assert.ok(aal1ShipmentError, "AAL1 Admin must be denied direct shipment RPC execution");
  assert.match(aal1ShipmentError.message, /admin role required|aal2 required/i);
  console.log("[AUTH] AAL1 direct shipment RPC correctly denied by PostgreSQL.");

  const totpSecret = process.env.DEMO_ADMIN_TOTP_SECRET;
  assert.ok(totpSecret, "DEMO_ADMIN_TOTP_SECRET must be defined in .env.local for automated local verification");
  const { data: factors, error: factorsErr } = await adminClient.auth.mfa.listFactors();
  assert.ifError(factorsErr);
  const verifiedFactor = factors.totp.find((f) => f.status === "verified");
  assert.ok(verifiedFactor, "Admin must have a verified TOTP factor");

  const totpCode = generateTOTP(totpSecret);
  const { data: mfaResult, error: mfaErr } = await adminClient.auth.mfa.challengeAndVerify({
    factorId: verifiedFactor.id,
    code: totpCode,
  });
  assert.ifError(mfaErr);
  console.log(`[AUTH] Admin elevated to AAL2! (Session AAL: ${mfaResult.user.aal || "aal2"})`);

  // 2. Authenticate Customer
  console.log("[AUTH] Signing in Customer (customer.demo@1968.local)...");
  const { data: custAuth, error: custSignInErr } = await customerClient.auth.signInWithPassword({
    email: "customer.demo@1968.local",
    password: "Demo1968Customer!",
  });
  assert.ifError(custSignInErr);
  const customerUserId = custAuth.user.id;
  console.log(`[AUTH] Customer UID: ${customerUserId}`);

  // 3. Query product variants for testing
  const { data: variantA } = await serviceClient
    .from("product_variants")
    .select("id, sku, name, price_minor, inventory!inner(on_hand, reserved)")
    .eq("sku", "PROD-001-M")
    .single();
  assert.ok(variantA, "Variant A (PROD-001-M) required");

  const { data: variantB } = await serviceClient
    .from("product_variants")
    .select("id, sku, name, price_minor, inventory!inner(on_hand, reserved)")
    .eq("sku", "PROD-001-L")
    .single();
  assert.ok(variantB, "Variant B (PROD-001-L) required");
  assert.equal(variantA.price_minor, variantB.price_minor, "Variant A and B must be same price for size exchange");

  const { data: variantC } = await serviceClient
    .from("product_variants")
    .select("id, sku, name, price_minor, inventory!inner(on_hand, reserved)")
    .eq("sku", "PROD-010-M")
    .single();
  assert.ok(variantC, "Variant C (PROD-010-M) required");
  assert.ok(variantC.price_minor > variantA.price_minor, "Variant C must be higher priced for balance due test");

  console.log(`[CATALOG] Var A: ${variantA.sku} (₱${variantA.price_minor / 100})`);
  console.log(`[CATALOG] Var B: ${variantB.sku} (₱${variantB.price_minor / 100})`);
  console.log(`[CATALOG] Var C: ${variantC.sku} (₱${variantC.price_minor / 100})`);

  // Repeated local verification consumes real stock. Restore only the minimum
  // deterministic headroom through the same audited admin RPC used by the UI.
  for (const variant of [variantA, variantB, variantC]) {
    const inventory = Array.isArray(variant.inventory) ? variant.inventory[0] : variant.inventory;
    const available = Number(inventory?.on_hand ?? 0) - Number(inventory?.reserved ?? 0);
    if (available < 40) {
      const { error: restockError } = await adminClient.rpc("admin_adjust_inventory", {
        p_variant_id: variant.id,
        p_delta: 40 - available,
        p_type: "adjustment",
        p_reason: "Local deterministic QA fixture headroom",
        p_idempotency_key: `qa-restock-${variant.id}-${Date.now()}`,
      });
      assert.ifError(restockError);
    }
  }

  // Close any pre-existing sessions for cashier
  const { data: openSessions } = await serviceClient
    .from("register_sessions")
    .select("id, status")
    .eq("cashier_id", adminUserId)
    .eq("status", "OPEN");
  if (openSessions && openSessions.length > 0) {
    for (const s of openSessions) {
      await adminClient.rpc("close_register_session", {
        p_session_id: s.id,
        p_actual_cash_minor: 0,
        p_notes: "Closing prior open session",
      });
    }
  }

  // =========================================================================
  // FLOW 1: POS Cash + Register Activity + Receipt
  // =========================================================================
  console.log("\n=================================================================");
  console.log(">>> [FLOW 1] POS Cash + Register Activity + Receipt");
  console.log("=================================================================");
  const openFloat = 200000; // ₱2,000.00
  const { data: session1, error: openErr1 } = await adminClient.rpc("open_register_session", {
    p_opening_cash_minor: openFloat,
    p_notes: "Morning shift terminal 1",
  });
  assert.ifError(openErr1);
  console.log(`[POS] Session opened: ID=${session1.id}, Expected Cash=₱${session1.expected_cash_minor / 100}`);

  // Assert OPEN_FLOAT activity logged
  const { data: openActivity1 } = await serviceClient
    .from("register_session_activities")
    .select("*")
    .eq("session_id", session1.id)
    .eq("activity_type", "OPEN_FLOAT")
    .single();
  assert.ok(openActivity1, "Activity OPEN_FLOAT must be logged");
  assert.equal(openActivity1.amount_minor, openFloat);
  assert.equal(openActivity1.running_balance_minor, openFloat);
  console.log(`[AUDIT] Verified register activity: OPEN_FLOAT ₱${openActivity1.amount_minor / 100}`);

  // Ring up POS Cash sale
  const tendered1 = variantA.price_minor + 50000; // ₱500 change
  const { data: sale1, error: saleErr1 } = await adminClient.rpc("create_pos_sale", {
    p_items: [{ variant_id: variantA.id, quantity: 1 }],
    p_payment_method: "CASH",
    p_tendered_minor: tendered1,
    p_customer_name: "Walk-in Collector 1",
    p_customer_phone: "09170000001",
    p_register_session_id: session1.id,
  });
  assert.ifError(saleErr1);
  console.log(`[POS] Sale Completed: Order #${sale1.order_number}, Total=₱${sale1.total_minor / 100}, Change=₱${sale1.change_minor / 100}`);
  assert.equal(sale1.change_minor, 50000);

  // Assert CASH_SALE activity logged
  const { data: cashSaleAct1 } = await serviceClient
    .from("register_session_activities")
    .select("*")
    .eq("session_id", session1.id)
    .eq("activity_type", "CASH_SALE")
    .single();
  assert.ok(cashSaleAct1, "Activity CASH_SALE must be logged");
  assert.equal(cashSaleAct1.amount_minor, variantA.price_minor);
  assert.equal(cashSaleAct1.running_balance_minor, openFloat + variantA.price_minor);
  console.log(`[AUDIT] Verified register activity: CASH_SALE +₱${cashSaleAct1.amount_minor / 100}, Running Balance=₱${cashSaleAct1.running_balance_minor / 100}`);

  // Verify receipt elements (Order details in DB)
  const { data: posOrder1 } = await serviceClient
    .from("orders")
    .select("*, order_items(*), payments(*)")
    .eq("order_number", sale1.order_number)
    .single();
  assert.equal(posOrder1.status, "DELIVERED");
  assert.equal(posOrder1.sales_channel, "POS");
  const pay1 = getPayment(posOrder1);
  assert.equal(pay1.method, "CASH");
  assert.equal(pay1.status, "PAID");
  assert.equal(posOrder1.order_items[0].sku, variantA.sku);
  console.log(`[RECEIPT] Verified receipt data: ${posOrder1.order_number}, SKU=${posOrder1.order_items[0].sku}, Total=₱${posOrder1.total_minor / 100}`);

  // Close session 1
  const { data: closed1, error: closeErr1 } = await adminClient.rpc("close_register_session", {
    p_session_id: session1.id,
    p_actual_cash_minor: openFloat + variantA.price_minor,
    p_notes: "Session 1 balanced reconciliation",
  });
  assert.ifError(closeErr1);
  assert.equal(closed1.cash_difference_minor, 0);

  const { data: closeAct1 } = await serviceClient
    .from("register_session_activities")
    .select("*")
    .eq("session_id", session1.id)
    .eq("activity_type", "CLOSE_FLOAT")
    .single();
  assert.ok(closeAct1, "Activity CLOSE_FLOAT must be logged");
  console.log(`[FLOW 1] ✓ PASSED: POS Cash + Activity History + Receipt Verified`);

  // =========================================================================
  // FLOW 2: POS GCash
  // =========================================================================
  console.log("\n=================================================================");
  console.log(">>> [FLOW 2] POS GCash");
  console.log("=================================================================");
  const { data: session2 } = await adminClient.rpc("open_register_session", {
    p_opening_cash_minor: 100000,
    p_notes: "Shift 2 POS GCash test",
  });

  const { data: sale2, error: saleErr2 } = await adminClient.rpc("create_pos_sale", {
    p_items: [{ variant_id: variantB.id, quantity: 1 }],
    p_payment_method: "MANUAL_GCASH",
    p_tendered_minor: variantB.price_minor,
    p_customer_name: "GCash Store Customer",
    p_customer_phone: "09170000002",
    p_register_session_id: session2.id,
  });
  assert.ifError(saleErr2);

  const { data: posOrder2 } = await serviceClient
    .from("orders")
    .select("*, payments(*)")
    .eq("order_number", sale2.order_number)
    .single();
  assert.equal(posOrder2.status, "DELIVERED");
  const pay2 = getPayment(posOrder2);
  assert.equal(pay2.method, "MANUAL_GCASH");
  assert.equal(pay2.status, "PAID");

  // Drawer expected cash must NOT change for GCash sale
  const { data: sess2Check } = await serviceClient
    .from("register_sessions")
    .select("expected_cash_minor")
    .eq("id", session2.id)
    .single();
  assert.equal(sess2Check.expected_cash_minor, 100000, "GCash must not mutate cash drawer balance");
  console.log(`[POS] Order #${sale2.order_number} paid via GCash. Drawer balance correctly remained ₱1,000.00.`);

  await adminClient.rpc("close_register_session", {
    p_session_id: session2.id,
    p_actual_cash_minor: 100000,
  });
  console.log(`[FLOW 2] ✓ PASSED: POS GCash Verified`);

  // =========================================================================
  // FLOW 3: Store Pickup + Cash
  // =========================================================================
  console.log("\n=================================================================");
  console.log(">>> [FLOW 3] Store Pickup + Cash");
  console.log("=================================================================");
  const idemp3 = `idemp_pickup_cash_${Date.now()}`;
  const { data: order3, error: err3 } = await serviceClient.rpc("checkout_order", {
    p_customer_id: customerUserId,
    p_idempotency_key: idemp3,
    p_lines: [{ variant_id: variantA.id, quantity: 1 }],
    p_shipping_minor: 0,
    p_payment_method: "CASH",
    p_gcash_expires_at: null,
    p_delivery: {
      customer_email: "customer.demo@1968.local",
      recipient_name: "Demo Customer",
      recipient_phone: "09170000001",
      address_line1: "1968 Flagship Store — Makati",
      city_municipality: "Makati City",
      province: "Metro Manila",
      postal_code: "1200",
      country_code: "PH",
    },
    p_customer_note: "Store Pickup paying cash at counter",
  });
  assert.ifError(err3);

  // Assert order fulfillment semantics
  const { data: checkOrder3 } = await serviceClient
    .from("orders")
    .select("*, payments(*)")
    .eq("id", order3.id)
    .single();
  assert.equal(checkOrder3.fulfillment_method, "STORE_PICKUP", "Pickup cash must be STORE_PICKUP");
  assert.equal(checkOrder3.shipping_minor, 0, "Pickup shipping fee must be ₱0");
  const pay3 = getPayment(checkOrder3);
  assert.equal(pay3.method, "CASH", "Payment method must be CASH, not COD");
  assert.equal(pay3.status, "UNPAID", "Pickup cash is UNPAID prior to collection");
  console.log(`[CHECKOUT] Order #${checkOrder3.order_number}: Fulfillment=${checkOrder3.fulfillment_method}, Payment=${pay3.method}, Status=${pay3.status}`);

  // Staff prepares order in store: CONFIRMED -> PROCESSING
  const { error: transErr3 } = await adminClient.rpc("admin_transition_order", {
    p_order_id: order3.id,
    p_to_status: "PROCESSING",
    p_idempotency_key: `trans-proc-${Date.now()}`,
    p_source: "staff_prep",
    p_note: "Items staged at flagship counter",
  });
  assert.ifError(transErr3);

  // Open shift session for counter staff
  const { data: session3 } = await adminClient.rpc("open_register_session", {
    p_opening_cash_minor: 100000,
    p_notes: "Pickup desk shift",
  });

  // Customer collects in person: Staff settles counter cash
  const { data: settleRes3, error: settleErr3 } = await adminClient.rpc("admin_settle_pickup_payment", {
    p_order_id: order3.id,
    p_register_session_id: session3.id,
    p_tendered_minor: order3.total_minor,
  });
  assert.ifError(settleErr3);
  assert.equal(settleRes3.payment_status, "PAID");
  assert.equal(settleRes3.order_status, "DELIVERED");

  // Verify activity logged in session
  const { data: pickAct3 } = await serviceClient
    .from("register_session_activities")
    .select("*")
    .eq("session_id", session3.id)
    .eq("activity_type", "CASH_SALE")
    .single();
  assert.ok(pickAct3, "Activity CASH_SALE must be logged for pickup counter cash settlement");
  assert.equal(pickAct3.amount_minor, order3.total_minor);

  await adminClient.rpc("close_register_session", {
    p_session_id: session3.id,
    p_actual_cash_minor: 100000 + order3.total_minor,
  });
  console.log(`[FLOW 3] ✓ PASSED: Store Pickup + Cash Settled at Counter`);

  // =========================================================================
  // FLOW 4: Store Pickup + GCash
  // =========================================================================
  console.log("\n=================================================================");
  console.log(">>> [FLOW 4] Store Pickup + GCash");
  console.log("=================================================================");
  const idemp4 = `idemp_pickup_gcash_${Date.now()}`;
  const gcashExp4 = new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString();
  const { data: order4, error: err4 } = await serviceClient.rpc("checkout_order", {
    p_customer_id: customerUserId,
    p_idempotency_key: idemp4,
    p_lines: [{ variant_id: variantB.id, quantity: 1 }],
    p_shipping_minor: 0,
    p_payment_method: "MANUAL_GCASH",
    p_gcash_expires_at: gcashExp4,
    p_delivery: {
      customer_email: "customer.demo@1968.local",
      recipient_name: "Demo Customer",
      recipient_phone: "09170000001",
      address_line1: "1968 Flagship Store — Makati",
      city_municipality: "Makati City",
      province: "Metro Manila",
      postal_code: "1200",
      country_code: "PH",
    },
    p_customer_note: "Store Pickup with GCash prepayment",
  });
  assert.ifError(err4);
  assert.equal(order4.fulfillment_method, "STORE_PICKUP");

  const { data: payment4 } = await serviceClient
    .from("payments")
    .select("id")
    .eq("order_id", order4.id)
    .single();

  // Customer uploads and submits payment proof
  const fileUuid4 = randomUUID();
  const receiptPath4 = `${customerUserId}/${order4.id}/${fileUuid4}.png`;
  const dummyPng = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==", "base64");
  const { error: upErr4 } = await customerClient.storage
    .from("payment-receipts")
    .upload(receiptPath4, dummyPng, { contentType: "image/png" });
  assert.ifError(upErr4);

  const resExp4 = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
  const { error: proofErr4 } = await customerClient.rpc("submit_gcash_proof", {
    p_payment_id: payment4.id,
    p_claimed_amount_minor: order4.total_minor,
    p_receipt_storage_path: receiptPath4,
    p_reservation_expires_at: resExp4,
    p_submission_idempotency_key: `proof-sub-4-${Date.now()}`,
    p_event_idempotency_key: `proof-evt-4-${Date.now()}`,
    p_reference_number: "GCASH-PICKUP-8877",
  });
  assert.ifError(proofErr4);

  // Admin reviews and approves GCash
  const { data: sub4 } = await serviceClient.from("payment_submissions").select("id").eq("payment_id", payment4.id).single();
  const { error: appErr4 } = await adminClient.rpc("approve_gcash_submission", {
    p_payment_id: payment4.id,
    p_submission_id: sub4.id,
    p_idempotency_key: `app-sub-4-${Date.now()}`,
    p_reason: "GCash payment verified for in-store pickup",
  });
  assert.ifError(appErr4);

  // Transition to PROCESSING then DELIVERED
  await adminClient.rpc("admin_transition_order", {
    p_order_id: order4.id,
    p_to_status: "PROCESSING",
    p_idempotency_key: `trans-proc-4-${Date.now()}`,
    p_source: "admin",
    p_note: "Packing items for counter pickup",
  });

  const { data: delivOrder4 } = await adminClient.rpc("admin_transition_order", {
    p_order_id: order4.id,
    p_to_status: "DELIVERED",
    p_idempotency_key: `trans-deliv-4-${Date.now()}`,
    p_source: "admin",
    p_note: "Customer received items at counter",
  });
  assert.equal(delivOrder4.status, "DELIVERED");
  console.log(`[FLOW 4] ✓ PASSED: Store Pickup + GCash Collected`);

  // =========================================================================
  // FLOW 5: Shipment + GCash + J&T
  // =========================================================================
  console.log("\n=================================================================");
  console.log(">>> [FLOW 5] Shipment + GCash + J&T");
  console.log("=================================================================");
  const idemp5 = `idemp_ship_jnt_${Date.now()}`;
  const { data: order5, error: err5 } = await serviceClient.rpc("checkout_order", {
    p_customer_id: customerUserId,
    p_idempotency_key: idemp5,
    p_lines: [{ variant_id: variantA.id, quantity: 1 }],
    p_shipping_minor: 15000,
    p_payment_method: "MANUAL_GCASH",
    p_gcash_expires_at: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(),
    p_delivery: {
      customer_email: "customer.demo@1968.local",
      recipient_name: "Demo Customer",
      recipient_phone: "09170000001",
      address_line1: "Unit 12B, High Street Residences",
      city_municipality: "Taguig City",
      province: "Metro Manila",
      postal_code: "1634",
      country_code: "PH",
    },
    p_customer_note: "Courier delivery via J&T",
  });
  assert.ifError(err5);

  const { data: payment5 } = await serviceClient.from("payments").select("id").eq("order_id", order5.id).single();

  const fileUuid5 = randomUUID();
  const receiptPath5 = `${customerUserId}/${order5.id}/${fileUuid5}.png`;
  const { error: upErr5 } = await customerClient.storage
    .from("payment-receipts")
    .upload(receiptPath5, dummyPng, { contentType: "image/png" });
  assert.ifError(upErr5);

  const resExp5 = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
  const { error: proofErr5 } = await customerClient.rpc("submit_gcash_proof", {
    p_payment_id: payment5.id,
    p_claimed_amount_minor: order5.total_minor,
    p_receipt_storage_path: receiptPath5,
    p_reservation_expires_at: resExp5,
    p_submission_idempotency_key: `proof-sub-5-${Date.now()}`,
    p_event_idempotency_key: `proof-evt-5-${Date.now()}`,
    p_reference_number: "GCASH-JNT-5544",
  });
  assert.ifError(proofErr5);

  const { data: sub5 } = await serviceClient.from("payment_submissions").select("id").eq("payment_id", payment5.id).single();
  const { error: appErr5 } = await adminClient.rpc("approve_gcash_submission", {
    p_payment_id: payment5.id,
    p_submission_id: sub5.id,
    p_idempotency_key: `app-sub-5-${Date.now()}`,
    p_reason: "GCash verified",
  });
  assert.ifError(appErr5);

  // Advance to READY_FOR_SHIPMENT
  const { error: tErr5_1 } = await adminClient.rpc("admin_transition_order", {
    p_order_id: order5.id,
    p_to_status: "PROCESSING",
    p_note: "Processing parcel for shipment",
    p_source: "admin",
    p_idempotency_key: `trans-proc-5-${Date.now()}`,
  });
  assert.ifError(tErr5_1);

  const { error: tErr5_2 } = await adminClient.rpc("admin_transition_order", {
    p_order_id: order5.id,
    p_to_status: "PACKING",
    p_note: "Packing parcel",
    p_source: "admin",
    p_idempotency_key: `trans-pack-5-${Date.now()}`,
  });
  assert.ifError(tErr5_2);

  const { error: tErr5_3 } = await adminClient.rpc("admin_transition_order", {
    p_order_id: order5.id,
    p_to_status: "READY_FOR_SHIPMENT",
    p_note: "Ready for courier dispatch",
    p_source: "admin",
    p_idempotency_key: `trans-ready-5-${Date.now()}`,
  });
  assert.ifError(tErr5_3);

  // Dispatch shipment with J&T
  const trackingNumber5 = "JT7766554433PH";
  const { data: shipment5, error: shipErr5 } = await adminClient.rpc("admin_create_shipment", {
    p_order_id: order5.id,
    p_provider: "J&T",
    p_tracking_number: trackingNumber5,
    p_carrier_notes: "Handed over to J&T courier hub",
  });
  assert.ifError(shipErr5);
  assert.equal(shipment5.provider, "JNT", "J&T aliases must be stored as canonical JNT");
  console.log(`[SHIPMENT] Provider: ${shipment5.provider}, Tracking: ${shipment5.tracking_number}`);
  console.log(`[SHIPMENT] URL: ${shipment5.tracking_url}`);

  // CRITICAL P0 ASSERTION: Current official tracking URL
  const expectedUrl5 = `https://www.jtexpress.ph/track-and-trace?waybillNo=${encodeURIComponent(trackingNumber5)}`;
  assert.equal(shipment5.tracking_url, expectedUrl5, "J&T tracking URL must match the current official Philippine waybill URL");

  const { data: checkOrder5 } = await serviceClient.from("orders").select("status").eq("id", order5.id).single();
  assert.equal(checkOrder5.status, "SHIPPED", "Order must auto-advance to SHIPPED");
  console.log(`[FLOW 5] ✓ PASSED: Shipment + GCash + Official J&T Tracking URL`);

  // =========================================================================
  // FLOW 6: Shipment + COD
  // =========================================================================
  console.log("\n=================================================================");
  console.log(">>> [FLOW 6] Shipment + COD");
  console.log("=================================================================");
  const idemp6 = `idemp_ship_cod_${Date.now()}`;
  const { data: order6, error: err6 } = await serviceClient.rpc("checkout_order", {
    p_customer_id: customerUserId,
    p_idempotency_key: idemp6,
    p_lines: [{ variant_id: variantA.id, quantity: 1 }],
    p_shipping_minor: 15000,
    p_payment_method: "COD",
    p_gcash_expires_at: null,
    p_delivery: {
      customer_email: "customer.demo@1968.local",
      recipient_name: "Demo Customer",
      recipient_phone: "09170000001",
      address_line1: "Unit 8A, Quezon Ave",
      city_municipality: "Quezon City",
      province: "Metro Manila",
      postal_code: "1100",
      country_code: "PH",
    },
  });
  assert.ifError(err6);

  // Progressive delivery transitions
  for (const st of ["PROCESSING", "PACKING", "READY_FOR_SHIPMENT", "SHIPPED", "OUT_FOR_DELIVERY", "DELIVERED"]) {
    const { error: tErr6 } = await adminClient.rpc("admin_transition_order", {
      p_order_id: order6.id,
      p_to_status: st,
      p_note: `Transitioning to ${st}`,
      p_source: "courier_webhook",
      p_idempotency_key: `trans-cod-${st}-${Date.now()}`,
    });
    assert.ifError(tErr6);
  }

  const { data: payment6 } = await serviceClient.from("payments").select("id, status").eq("order_id", order6.id).single();
  assert.equal(payment6.status, "UNPAID");

  // Courier remits collected COD cash
  const { error: codSettleErr6 } = await adminClient.rpc("settle_cod_payment", {
    p_payment_id: payment6.id,
    p_idempotency_key: `settle-cod-remit-${Date.now()}`,
    p_reason: "Courier remitted COD cash for delivery",
  });
  assert.ifError(codSettleErr6);

  const { data: checkPay6 } = await serviceClient.from("payments").select("status").eq("id", payment6.id).single();
  assert.equal(checkPay6.status, "PAID");
  console.log(`[FLOW 6] ✓ PASSED: Shipment + COD Delivered & Settled`);

  // =========================================================================
  // FLOW 7: Cancellation before shipment
  // =========================================================================
  console.log("\n=================================================================");
  console.log(">>> [FLOW 7] Cancellation Before Shipment");
  console.log("=================================================================");
  const { data: invBefore7 } = await serviceClient.from("inventory").select("on_hand, reserved").eq("variant_id", variantA.id).single();

  const idemp7 = `idemp_cancel_${Date.now()}`;
  const { data: order7, error: err7 } = await serviceClient.rpc("checkout_order", {
    p_customer_id: customerUserId,
    p_idempotency_key: idemp7,
    p_lines: [{ variant_id: variantA.id, quantity: 1 }],
    p_shipping_minor: 15000,
    p_payment_method: "COD",
    p_gcash_expires_at: null,
    p_delivery: {
      customer_email: "customer.demo@1968.local",
      recipient_name: "Demo Customer",
      recipient_phone: "09170000001",
      address_line1: "Unit 3, BGC",
      city_municipality: "Taguig City",
      province: "Metro Manila",
      postal_code: "1630",
      country_code: "PH",
    },
  });
  assert.ifError(err7);
  assert.equal(order7.status, "CONFIRMED");

  // Customer cancels order
  const { data: cancelledOrder7, error: cancelErr7 } = await customerClient.rpc("cancel_order", {
    p_order_id: order7.id,
    p_reason: "Customer requested cancellation before shipment",
  });
  assert.ifError(cancelErr7);
  assert.equal(cancelledOrder7.status, "CANCELLED");

  // Inventory restored
  const { data: invAfter7 } = await serviceClient.from("inventory").select("on_hand, reserved").eq("variant_id", variantA.id).single();
  assert.equal(invAfter7.on_hand, invBefore7.on_hand, "Stock must be fully restored upon cancellation");
  console.log(`[INVENTORY] Stock before: ${invBefore7.on_hand}, stock after cancel: ${invAfter7.on_hand} (exact match)`);

  const { data: pay7 } = await serviceClient.from("payments").select("status").eq("order_id", order7.id).single();
  assert.equal(pay7.status, "FAILED", "Unpaid payment must transition to FAILED upon cancellation");
  console.log(`[FLOW 7] ✓ PASSED: Order Cancellation Before Shipment & Stock Restoration`);

  // =========================================================================
  // FLOW 8: Full Return / Refund
  // =========================================================================
  console.log("\n=================================================================");
  console.log(">>> [FLOW 8] Full Return / Refund");
  console.log("=================================================================");
  // Use delivered Order 6 (total: ₱499 + ₱150 = ₱649.00 = 64900 centavos)
  const { data: retReq8, error: retErr8 } = await customerClient.rpc("create_customer_return_request", {
    p_order_id: order6.id,
    p_type: "RETURN",
    p_reason: "DEFECTIVE",
    p_reason_details: "Fabric weave defect on front collar",
    p_requested_refund_minor: order6.total_minor,
    p_proof_paths: [],
  });
  assert.ifError(retErr8);
  assert.equal(retReq8.status, "REQUESTED");

  // Admin approves return
  const { data: appRet8, error: appRetErr8 } = await adminClient.rpc("admin_process_return_request", {
    p_return_id: retReq8.id,
    p_decision: "APPROVED",
    p_approved_refund_minor: order6.total_minor,
    p_admin_notes: "Return approved for return parcel dispatch",
  });
  assert.ifError(appRetErr8);
  assert.equal(appRet8.status, "APPROVED");

  // Admin issues full refund
  const { data: refund8, error: refundErr8 } = await adminClient.rpc("admin_issue_refund", {
    p_order_id: order6.id,
    p_amount_minor: order6.total_minor,
    p_method: "MANUAL_GCASH",
    p_reason: "Full refund for approved defective garment",
    p_return_request_id: retReq8.id,
    p_reference_number: "GCASH-FULL-REFUND-8899",
  });
  assert.ifError(refundErr8);
  assert.equal(refund8.amount_minor, order6.total_minor);
  assert.equal(refund8.status, "COMPLETED");

  const { data: pay8 } = await serviceClient.from("payments").select("status").eq("order_id", order6.id).single();
  assert.equal(pay8.status, "REFUNDED", "Payment status must be REFUNDED on full refund");
  console.log(`[FLOW 8] ✓ PASSED: Full Return & Refund Completed (Status=${pay8.status})`);

  // =========================================================================
  // FLOW 9: Partial Refund
  // =========================================================================
  console.log("\n=================================================================");
  console.log(">>> [FLOW 9] Partial Refund");
  console.log("=================================================================");
  // Create another delivered order with 2 items
  const idemp9 = `idemp_partial_ref_${Date.now()}`;
  const { data: order9, error: err9 } = await serviceClient.rpc("checkout_order", {
    p_customer_id: customerUserId,
    p_idempotency_key: idemp9,
    p_lines: [{ variant_id: variantB.id, quantity: 2 }],
    p_shipping_minor: 15000,
    p_payment_method: "COD",
    p_gcash_expires_at: null,
    p_delivery: {
      customer_email: "customer.demo@1968.local",
      recipient_name: "Demo Customer",
      recipient_phone: "09170000001",
      address_line1: "San Juan",
      city_municipality: "San Juan City",
      province: "Metro Manila",
      postal_code: "1500",
      country_code: "PH",
    },
  });
  assert.ifError(err9);

  const { error: tErr9_1 } = await adminClient.rpc("admin_transition_order", {
    p_order_id: order9.id,
    p_to_status: "PROCESSING",
    p_note: "Processing order 9",
    p_source: "admin",
    p_idempotency_key: `t9-1-${Date.now()}`,
  });
  assert.ifError(tErr9_1);

  const { error: tErr9_2 } = await adminClient.rpc("admin_transition_order", {
    p_order_id: order9.id,
    p_to_status: "DELIVERED",
    p_note: "Delivered order 9",
    p_source: "admin",
    p_idempotency_key: `t9-2-${Date.now()}`,
  });
  assert.ifError(tErr9_2);
  const { data: pay9Rec } = await serviceClient.from("payments").select("id").eq("order_id", order9.id).single();
  const { error: codErr9 } = await adminClient.rpc("settle_cod_payment", {
    p_payment_id: pay9Rec.id,
    p_idempotency_key: `t9-pay-${Date.now()}`,
    p_reason: "Courier remitted COD cash for delivery 9",
  });
  assert.ifError(codErr9);

  // Issue partial refund: ₱300.00 (30000 centavos) out of ₱1,148.00 total
  const partialAmount = 30000;
  const { data: ref9, error: refErr9 } = await adminClient.rpc("admin_issue_refund", {
    p_order_id: order9.id,
    p_amount_minor: partialAmount,
    p_method: "MANUAL_GCASH",
    p_reason: "Partial store credit refund for minor packaging damage",
  });
  assert.ifError(refErr9);
  assert.equal(ref9.amount_minor, partialAmount);

  const { data: pay9After } = await serviceClient.from("payments").select("status").eq("id", pay9Rec.id).single();
  assert.equal(pay9After.status, "PARTIALLY_REFUNDED", "Payment status must transition to PARTIALLY_REFUNDED");
  console.log(`[FLOW 9] ✓ PASSED: Partial Refund Issued (Payment Status: ${pay9After.status})`);

  // =========================================================================
  // FLOW 10: Same-Price Size Exchange
  // =========================================================================
  console.log("\n=================================================================");
  console.log(">>> [FLOW 10] Same-Price Size Exchange");
  console.log("=================================================================");
  // Create delivered order with Variant A (Size M, ₱499.00)
  const idemp10 = `idemp_exch_same_${Date.now()}`;
  const { data: order10 } = await serviceClient.rpc("checkout_order", {
    p_customer_id: customerUserId,
    p_idempotency_key: idemp10,
    p_lines: [{ variant_id: variantA.id, quantity: 1 }],
    p_shipping_minor: 0,
    p_payment_method: "CASH",
    p_gcash_expires_at: null,
    p_delivery: {
      customer_email: "customer.demo@1968.local",
      recipient_name: "Demo Customer",
      recipient_phone: "09170000001",
      address_line1: "Makati Flagship",
      city_municipality: "Makati City",
      province: "Metro Manila",
      postal_code: "1200",
      country_code: "PH",
    },
  });
  const { error: tErr10_1 } = await adminClient.rpc("admin_transition_order", {
    p_order_id: order10.id,
    p_to_status: "PROCESSING",
    p_note: "Processing order 10",
    p_source: "admin",
    p_idempotency_key: `t10-1-${Date.now()}`,
  });
  assert.ifError(tErr10_1);
  await adminClient.rpc("admin_settle_pickup_payment", { p_order_id: order10.id, p_tendered_minor: order10.total_minor });

  // Stock counts before exchange
  const { data: stockA_before } = await serviceClient.from("inventory").select("on_hand").eq("variant_id", variantA.id).single();
  const { data: stockB_before } = await serviceClient.from("inventory").select("on_hand").eq("variant_id", variantB.id).single();

  // Exchange Variant A (Size M) for Variant B (Size L)
  const { data: exch10, error: exchErr10 } = await adminClient.rpc("admin_process_exchange", {
    p_order_id: order10.id,
    p_orig_variant_id: variantA.id,
    p_new_variant_id: variantB.id,
    p_reason: "Customer preferred Size L over Size M",
  });
  assert.ifError(exchErr10);
  assert.equal(exch10.price_diff_minor, 0, "Same price size exchange price diff must be 0");
  assert.equal(exch10.balance_due_minor, 0);
  assert.equal(exch10.refund_due_minor, 0);

  // Assert inventory adjustments
  const { data: stockA_after } = await serviceClient.from("inventory").select("on_hand").eq("variant_id", variantA.id).single();
  const { data: stockB_after } = await serviceClient.from("inventory").select("on_hand").eq("variant_id", variantB.id).single();
  assert.equal(stockA_after.on_hand, stockA_before.on_hand + 1, "Returned variant A must be restocked +1");
  assert.equal(stockB_after.on_hand, stockB_before.on_hand - 1, "Replacement variant B must be deducted -1");

  // Assert order item updated
  const { data: item10 } = await serviceClient.from("order_items").select("sku").eq("order_id", order10.id).single();
  assert.equal(item10.sku, variantB.sku, "Order item must now reflect replacement variant B");
  console.log(`[FLOW 10] ✓ PASSED: Same-Price Size Exchange (${variantA.sku} -> ${variantB.sku})`);

  // =========================================================================
  // FLOW 11: Exchange with Balance Due
  // =========================================================================
  console.log("\n=================================================================");
  console.log(">>> [FLOW 11] Exchange with Balance Due");
  console.log("=================================================================");
  // Order 10 now has Variant B (₱499.00). Customer wants to upgrade to Variant C (₱550.00).
  // Price diff = 55000 - 49900 = +5100 centavos (₱51.00 balance due).
  const expectedDiff11 = variantC.price_minor - variantB.price_minor;
  assert.equal(expectedDiff11, 5100);

  // Open cashier register session
  const { data: session11 } = await adminClient.rpc("open_register_session", {
    p_opening_cash_minor: 100000,
    p_notes: "Exchange balance desk",
  });

  const tendered11 = 10000; // Customer hands ₱100.00 cash for ₱51.00 balance -> ₱49.00 change
  const { data: exch11, error: exchErr11 } = await adminClient.rpc("admin_process_exchange", {
    p_order_id: order10.id,
    p_orig_variant_id: variantB.id,
    p_new_variant_id: variantC.id,
    p_reason: "Upgrade to premium collection piece",
    p_register_session_id: session11.id,
    p_cash_tendered_minor: tendered11,
  });
  assert.ifError(exchErr11);
  assert.equal(exch11.price_diff_minor, expectedDiff11);
  assert.equal(exch11.balance_due_minor, expectedDiff11);
  assert.equal(exch11.change_minor, tendered11 - expectedDiff11);
  console.log(`[EXCHANGE] Balance Due: ₱${exch11.balance_due_minor / 100}, Tendered: ₱${tendered11 / 100}, Change Given: ₱${exch11.change_minor / 100}`);

  // Assert register activity logged
  const { data: exchAct11 } = await serviceClient
    .from("register_session_activities")
    .select("*")
    .eq("session_id", session11.id)
    .eq("activity_type", "EXCHANGE_BALANCE_COLLECTED")
    .single();
  assert.ok(exchAct11, "EXCHANGE_BALANCE_COLLECTED activity must be logged");
  assert.equal(exchAct11.amount_minor, expectedDiff11);

  // Drawer expected cash updated
  const { data: checkSess11 } = await serviceClient.from("register_sessions").select("expected_cash_minor").eq("id", session11.id).single();
  assert.equal(checkSess11.expected_cash_minor, 100000 + expectedDiff11);

  await adminClient.rpc("close_register_session", {
    p_session_id: session11.id,
    p_actual_cash_minor: checkSess11.expected_cash_minor,
  });
  console.log(`[FLOW 11] ✓ PASSED: Exchange with Balance Due (Collected ₱${expectedDiff11 / 100})`);

  // =========================================================================
  // FLOW 12: Exchange with Refund Due
  // =========================================================================
  console.log("\n=================================================================");
  console.log(">>> [FLOW 12] Exchange with Refund Due");
  console.log("=================================================================");
  // Order 10 now has Variant C (₱550.00). Customer downgrades back to Variant A (₱499.00).
  // Price diff = 49900 - 55000 = -5100 centavos (₱51.00 refund due).
  const expectedRefund12 = variantC.price_minor - variantA.price_minor;

  const { data: session12 } = await adminClient.rpc("open_register_session", {
    p_opening_cash_minor: 100000,
    p_notes: "Exchange refund desk",
  });

  const { data: exch12, error: exchErr12 } = await adminClient.rpc("admin_process_exchange", {
    p_order_id: order10.id,
    p_orig_variant_id: variantC.id,
    p_new_variant_id: variantA.id,
    p_reason: "Downgrade to tee with cash difference refunded",
    p_register_session_id: session12.id,
  });
  assert.ifError(exchErr12);
  assert.equal(exch12.price_diff_minor, -expectedRefund12);
  assert.equal(exch12.refund_due_minor, expectedRefund12);
  assert.equal(exch12.balance_due_minor, 0);

  // Assert refund record created
  const { data: refundRec12 } = await serviceClient
    .from("refunds")
    .select("*")
    .eq("order_id", order10.id)
    .order("created_at", { ascending: false })
    .limit(1)
    .single();
  assert.ok(refundRec12, "Refund record must be created for exchange price difference");
  assert.equal(refundRec12.amount_minor, expectedRefund12);
  assert.equal(refundRec12.method, "CASH");

  // Assert register activity logged for refund paid
  const { data: exchAct12 } = await serviceClient
    .from("register_session_activities")
    .select("*")
    .eq("session_id", session12.id)
    .eq("activity_type", "EXCHANGE_REFUND_PAID")
    .single();
  assert.ok(exchAct12, "EXCHANGE_REFUND_PAID activity must be logged");
  assert.equal(exchAct12.amount_minor, -expectedRefund12);

  // Drawer expected cash decreased by refund amount
  const { data: checkSess12 } = await serviceClient.from("register_sessions").select("expected_cash_minor").eq("id", session12.id).single();
  assert.equal(checkSess12.expected_cash_minor, 100000 - expectedRefund12);

  await adminClient.rpc("close_register_session", {
    p_session_id: session12.id,
    p_actual_cash_minor: checkSess12.expected_cash_minor,
  });
  console.log(`[FLOW 12] ✓ PASSED: Exchange with Refund Due (Refunded ₱${expectedRefund12 / 100})`);

  console.log("\n================================================================================");
  console.log("  >>> ALL 12 EMPIRICAL RETAIL FLOWS VERIFIED WITH 100% DATABASE EVIDENCE <<<");
  console.log("================================================================================");
}

runEmpiricalFlows().catch((err) => {
  console.error("Empirical flows verification failed:", err);
  process.exit(1);
});
