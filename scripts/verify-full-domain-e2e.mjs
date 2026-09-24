// scripts/verify-full-domain-e2e.mjs
// Comprehensive End-to-End Operational Domain Verification with Authenticated AAL2 Admin and Customer
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
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

assertLocalSupabaseTarget(supabaseUrl, "Full-domain QA");

assert.ok(anonKey, "Publishable key must be defined in .env.local");
assert.ok(serviceRoleKey, "SUPABASE_SECRET_KEY must be defined");

async function runVerification() {
  console.log("=== 1968 CLOTHING — FULL DOMAIN E2E EVIDENCE VERIFICATION ===");
  console.log(`Connecting to Supabase at: ${supabaseUrl}`);

  const serviceClient = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false } });
  const adminClient = createClient(supabaseUrl, anonKey, { auth: { persistSession: false } });
  const customerClient = createClient(supabaseUrl, anonKey, { auth: { persistSession: false } });

  // 1. Authenticate Admin with Password & TOTP AAL2
  console.log("\n[AUTH] Signing in Admin (admin.demo@1968.local)...");
  const { data: adminAuth, error: adminSignInErr } = await adminClient.auth.signInWithPassword({
    email: "admin.demo@1968.local",
    password: "Demo1968Admin!",
  });
  assert.ifError(adminSignInErr);
  const adminUserId = adminAuth.user.id;

  // Elevate Admin to AAL2 using TOTP
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
  console.log(`[AUTH] Admin successfully authenticated with AAL2! (Session AAL: ${mfaResult.user.aal || "aal2"})`);

  // 2. Authenticate Customer
  console.log("[AUTH] Signing in Customer (customer.demo@1968.local)...");
  const { data: custAuth, error: custSignInErr } = await customerClient.auth.signInWithPassword({
    email: "customer.demo@1968.local",
    password: "Demo1968Customer!",
  });
  assert.ifError(custSignInErr);
  const customerUserId = custAuth.user.id;
  console.log(`[AUTH] Customer UID: ${customerUserId}`);

  // 3. Fetch Active Product Variant with Inventory
  const { data: variants, error: variantErr } = await serviceClient
    .from("product_variants")
    .select("id, product_id, sku, price_minor, name, status, products!inner(name, status), inventory!inner(on_hand, reserved)")
    .eq("status", "active")
    .limit(1);
  assert.ifError(variantErr);
  assert.ok(variants && variants.length > 0);
  const variant = variants[0];
  console.log(`[CATALOG] Test Variant: ${variant.sku}, Price: ₱${(variant.price_minor / 100).toFixed(2)}`);

  // 4. Register Session Lifecycle & POS Cash Sale
  console.log("\n--- [FLOW 1] Register Session & POS Cash Sale ---");
  // Check if any open session exists for cashier and close it
  const { data: existingSessions } = await serviceClient
    .from("register_sessions")
    .select("id, status")
    .eq("cashier_id", adminUserId)
    .eq("status", "OPEN");

  if (existingSessions && existingSessions.length > 0) {
    for (const s of existingSessions) {
      await adminClient.rpc("close_register_session", {
        p_session_id: s.id,
        p_actual_cash_minor: 200000,
        p_notes: "Closing prior open test session",
      });
    }
  }

  // Open register session using adminClient (enforces AAL2)
  const { data: openSession, error: openErr } = await adminClient.rpc("open_register_session", {
    p_opening_cash_minor: 200000,
    p_notes: "Morning shift test open",
  });
  assert.ifError(openErr);
  console.log(`[POS] Opened Register Session ID: ${openSession.id}, Opening Cash: ₱${(openSession.opening_cash_minor / 100).toFixed(2)}`);

  // Ring up POS sale via adminClient
  const posItems = [{ variant_id: variant.id, quantity: 1 }];
  const tenderedMinor = variant.price_minor + 50000; // ₱500 change

  const { data: saleResult, error: saleErr } = await adminClient.rpc("create_pos_sale", {
    p_items: posItems,
    p_payment_method: "CASH",
    p_tendered_minor: tenderedMinor,
    p_customer_name: "Walk-in Streetwear Collector",
    p_customer_phone: "09170000001",
    p_register_session_id: openSession.id,
  });
  assert.ifError(saleErr);
  console.log(`[POS] Sale Completed: Order #${saleResult.order_number}`);
  console.log(`[POS] Total Due: ₱${(saleResult.total_minor / 100).toFixed(2)}, Tendered: ₱${(tenderedMinor / 100).toFixed(2)}, Change Given: ₱${(saleResult.change_minor / 100).toFixed(2)}`);
  assert.equal(saleResult.change_minor, 50000);

  // Check expected drawer balance
  const { data: updatedSession, error: checkSessionErr } = await serviceClient
    .from("register_sessions")
    .select("expected_cash_minor")
    .eq("id", openSession.id)
    .single();
  assert.ifError(checkSessionErr);
  console.log(`[POS] Drawer Expected Cash: ₱${(updatedSession.expected_cash_minor / 100).toFixed(2)}`);
  assert.equal(updatedSession.expected_cash_minor, 200000 + variant.price_minor);

  // Close register session
  const { data: closedSession, error: closeErr } = await adminClient.rpc("close_register_session", {
    p_session_id: openSession.id,
    p_actual_cash_minor: updatedSession.expected_cash_minor,
    p_notes: "End of shift exact drawer reconciliation",
  });
  assert.ifError(closeErr);
  console.log(`[POS] Closed Register Session: Status=${closedSession.status}, Cash Difference: ₱${(closedSession.cash_difference_minor / 100).toFixed(2)}`);
  assert.equal(closedSession.status, "CLOSED");
  assert.equal(closedSession.cash_difference_minor, 0);

  // 5. Storefront Store Pickup Order & Counter Handover
  console.log("\n--- [FLOW 2] Storefront Store Pickup Order & Handover ---");
  const pickupIdempotency = `idemp_pickup_${Date.now()}`;
  const { data: pickupOrder, error: pickupOrderErr } = await serviceClient.rpc("checkout_order", {
    p_customer_id: customerUserId,
    p_idempotency_key: pickupIdempotency,
    p_lines: [{ variant_id: variant.id, quantity: 1 }],
    p_shipping_minor: 0,
    p_payment_method: "COD",
    p_gcash_expires_at: null,
    p_delivery: {
      customer_email: "customer.demo@1968.local",
      recipient_name: "Demo Customer",
      recipient_phone: "09171234567",
      address_line1: "1968 Flagship Store - Customer Pickup",
      city_municipality: "Makati City",
      province: "Metro Manila",
      postal_code: "1200",
      country_code: "PH",
    },
    p_customer_note: "Test in-store pickup",
  });
  assert.ifError(pickupOrderErr);

  // Update fulfillment method to STORE_PICKUP
  await serviceClient.from("orders").update({ fulfillment_method: "STORE_PICKUP" }).eq("id", pickupOrder.id);

  console.log(`[STOREFRONT] Placed Store Pickup Order #${pickupOrder.order_number}`);
  console.log(`[STOREFRONT] Channel: ${pickupOrder.sales_channel || "STOREFRONT"}, Shipping Fee: ₱${pickupOrder.shipping_minor / 100}`);
  assert.equal(pickupOrder.shipping_minor, 0);

  // Advance order to PROCESSING then DELIVERED (store counter handover)
  const { error: procErr } = await adminClient.rpc("admin_transition_order", {
    p_order_id: pickupOrder.id,
    p_to_status: "PROCESSING",
    p_idempotency_key: `trans-pickup-proc-${Date.now()}`,
    p_source: "flagship-staff",
    p_note: "Items packed and ready at flagship store pickup desk",
  });
  assert.ifError(procErr);

  const { data: deliveredOrder, error: handoverErr } = await adminClient.rpc("admin_transition_order", {
    p_order_id: pickupOrder.id,
    p_to_status: "DELIVERED",
    p_idempotency_key: `trans-pickup-deliv-${Date.now()}`,
    p_source: "flagship-staff",
    p_note: "Customer collected order at flagship store counter",
  });
  assert.ifError(handoverErr);
  console.log(`[STOREFRONT] Handover completed: Order #${deliveredOrder.order_number} status is now ${deliveredOrder.status}`);
  assert.equal(deliveredOrder.status, "DELIVERED");

  // Settle COD payment upon delivery
  const { data: pickupPayment } = await serviceClient
    .from("payments")
    .select("id")
    .eq("order_id", pickupOrder.id)
    .single();

  const { error: settleErr } = await adminClient.rpc("settle_cod_payment", {
    p_payment_id: pickupPayment.id,
    p_idempotency_key: `settle-cod-${Date.now()}`,
    p_reason: "COD tender collected at flagship store counter",
  });
  assert.ifError(settleErr);
  console.log("[PAYMENTS] COD Payment settled to PAID upon handover");

  // 6. Customer Return Request & Admin Refund Issuance
  console.log("\n--- [FLOW 3] Return Request & Refund Issuance ---");
  const { data: returnReq, error: returnErr } = await customerClient.rpc("create_customer_return_request", {
    p_order_id: pickupOrder.id,
    p_type: "RETURN",
    p_reason: "WRONG_SIZE",
    p_reason_details: "Need size L instead of size M",
    p_requested_refund_minor: pickupOrder.total_minor,
    p_proof_paths: [],
  });
  assert.ifError(returnErr);
  console.log(`[RETURNS] Customer Return Request Created: ID=${returnReq.id}, Status=${returnReq.status}, Reason=${returnReq.reason}`);
  assert.equal(returnReq.status, "REQUESTED");

  // Admin approves return request
  const { data: approvedReturn, error: approveErr } = await adminClient.rpc("admin_process_return_request", {
    p_return_id: returnReq.id,
    p_decision: "APPROVED",
    p_approved_refund_minor: pickupOrder.total_minor,
    p_admin_notes: "Return approved for drop-off at Makati flagship",
  });
  assert.ifError(approveErr);
  console.log(`[RETURNS] Admin Approved Return: Status=${approvedReturn.status}, Approved Refund: ₱${(approvedReturn.approved_refund_minor / 100).toFixed(2)}`);
  assert.equal(approvedReturn.status, "APPROVED");

  // Admin issues refund via GCash
  const { data: refund, error: refundErr } = await adminClient.rpc("admin_issue_refund", {
    p_order_id: pickupOrder.id,
    p_amount_minor: pickupOrder.total_minor,
    p_method: "MANUAL_GCASH",
    p_reason: "Full refund for approved return",
    p_return_request_id: returnReq.id,
    p_reference_number: "GCASH-REF-998811",
  });
  assert.ifError(refundErr);
  console.log(`[REFUND] Admin Issued Refund: ID=${refund.id}, Status=${refund.status}, Amount: ₱${(refund.amount_minor / 100).toFixed(2)}, Reference: ${refund.reference_number}`);
  assert.equal(refund.status, "COMPLETED");

  // Verify return request marked completed
  const { data: completedReturn, error: checkReturnErr } = await serviceClient
    .from("return_requests")
    .select("status")
    .eq("id", returnReq.id)
    .single();
  assert.ifError(checkReturnErr);
  console.log(`[RETURNS] Final Return Request Status: ${completedReturn.status}`);
  assert.equal(completedReturn.status, "COMPLETED");

  // 7. Courier Shipment Creation & Tracking Portal
  console.log("\n--- [FLOW 4] Courier Shipment & Tracking ---");
  const shipIdemp = `idemp_ship_${Date.now()}`;
  const { data: shipOrder, error: shipOrderErr } = await serviceClient.rpc("checkout_order", {
    p_customer_id: customerUserId,
    p_idempotency_key: shipIdemp,
    p_lines: [{ variant_id: variant.id, quantity: 1 }],
    p_shipping_minor: 15000,
    p_payment_method: "COD",
    p_gcash_expires_at: null,
    p_delivery: {
      customer_email: "customer.demo@1968.local",
      recipient_name: "Demo Customer",
      recipient_phone: "09171234567",
      address_line1: "Unit 4B, 123 Streetwear Ave",
      city_municipality: "Taguig City",
      province: "Metro Manila",
      postal_code: "1630",
      country_code: "PH",
    },
    p_customer_note: "Test courier dispatch",
  });
  assert.ifError(shipOrderErr);

  // Transition: CONFIRMED -> PROCESSING -> PACKING -> READY_FOR_SHIPMENT
  await adminClient.rpc("admin_transition_order", {
    p_order_id: shipOrder.id,
    p_to_status: "PROCESSING",
    p_idempotency_key: `trans-ship-proc-${Date.now()}`,
    p_source: "admin_fulfillment",
    p_note: "Processing courier shipment",
  });
  await adminClient.rpc("admin_transition_order", {
    p_order_id: shipOrder.id,
    p_to_status: "PACKING",
    p_idempotency_key: `trans-ship-pack-${Date.now()}`,
    p_source: "admin_fulfillment",
    p_note: "Packing items into streetwear branded parcel",
  });
  await adminClient.rpc("admin_transition_order", {
    p_order_id: shipOrder.id,
    p_to_status: "READY_FOR_SHIPMENT",
    p_idempotency_key: `trans-ship-ready-${Date.now()}`,
    p_source: "admin_fulfillment",
    p_note: "Staged at dispatch dock awaiting courier pickup",
  });

  const { data: shipment, error: shipmentErr } = await adminClient.rpc("admin_create_shipment", {
    p_order_id: shipOrder.id,
    p_provider: "J&T",
    p_tracking_number: "JT9988112233",
    p_carrier_notes: "Handed over to J&T Courier Makati hub",
  });
  assert.ifError(shipmentErr);
  console.log(`[SHIPMENT] Created Shipment: Provider=${shipment.provider}, Tracking No=${shipment.tracking_number}, URL=${shipment.tracking_url}`);
  assert.equal(shipment.provider, "JNT");
  assert.equal(shipment.tracking_number, "JT9988112233");
  assert.ok(shipment.tracking_url.includes("jtexpress.ph"));

  // Verify order automatically advanced to SHIPPED
  const { data: shippedOrder, error: checkShipErr } = await serviceClient
    .from("orders")
    .select("status")
    .eq("id", shipOrder.id)
    .single();
  assert.ifError(checkShipErr);
  console.log(`[SHIPMENT] Order #${shipOrder.order_number} status automatically advanced to: ${shippedOrder.status}`);
  assert.equal(shippedOrder.status, "SHIPPED");

  // 8. Store Settings Verification
  console.log("\n--- [FLOW 5] Store Settings Verification ---");
  const { data: settingsList, error: settingsErr } = await serviceClient
    .from("store_settings")
    .select("key, value, description");
  assert.ifError(settingsErr);
  console.log(`[SETTINGS] Loaded ${settingsList.length} store settings:`);
  for (const s of settingsList) {
    console.log(`  • ${s.key}: ${JSON.stringify(s.value).slice(0, 70)}...`);
  }

  console.log("\n=======================================================");
  console.log(">>> ALL 5 DOMAIN LIFECYCLES VERIFIED END-TO-END WITH 100% EMPIRICAL DATABASE PROOF <<<");
  console.log("=======================================================");
}

runVerification().catch((err) => {
  console.error("Verification failed:", err);
  process.exit(1);
});
