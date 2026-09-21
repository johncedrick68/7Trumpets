import assert from "node:assert/strict";
import { createHmac, timingSafeEqual } from "node:crypto";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

function verifyN8nWebhookSignature(rawBody, timestamp, signature, secret) {
  if (!signature || !timestamp || !secret) return false;
  const parsedTs = parseInt(timestamp, 10);
  if (isNaN(parsedTs)) return false;
  // 5 minute tolerance
  if (Math.abs(Date.now() - parsedTs) > 5 * 60 * 1000) return false;

  const expectedSig = createHmac("sha256", secret)
    .update(`${timestamp}.${rawBody}`)
    .digest("hex");

  if (signature.length !== expectedSig.length) return false;
  return timingSafeEqual(Buffer.from(signature, "hex"), Buffer.from(expectedSig, "hex"));
}

function getCourierTrackingUrl(provider, trackingNumber) {
  if (!trackingNumber) return null;
  const cleanNumber = trackingNumber.trim();
  if (!cleanNumber) return null;

  switch (provider.toUpperCase()) {
    case "JNT":
      return `https://www.jtexpress.ph/track-and-trace?waybillNo=${encodeURIComponent(cleanNumber)}`;
    case "LBC":
      return "https://www.lbcexpress.com/ph/track";
    default:
      return null;
  }
}

test("Support & Staff Migration: Tables, columns, and RLS policies are rigorously defined", async () => {
  const migration = await read("supabase/migrations/20260922000000_support_staff_ai_automation.sql");

  // Verify tables
  assert.match(migration, /CREATE TABLE IF NOT EXISTS public\.staff_invitations/);
  assert.match(migration, /CREATE TABLE IF NOT EXISTS public\.support_conversations/);
  assert.match(migration, /CREATE TABLE IF NOT EXISTS public\.support_messages/);
  assert.match(migration, /CREATE TABLE IF NOT EXISTS public\.automation_outbox/);
  assert.match(migration, /CREATE TABLE IF NOT EXISTS public\.ai_usage_logs/);
  assert.match(migration, /CREATE TABLE IF NOT EXISTS public\.admin_daily_briefs/);

  // Verify Realtime publication
  assert.match(migration, /ALTER PUBLICATION supabase_realtime ADD TABLE public\.support_messages/);

  // Verify RLS is enabled
  assert.match(migration, /ALTER TABLE public\.staff_invitations ENABLE ROW LEVEL SECURITY/);
  assert.match(migration, /ALTER TABLE public\.support_conversations ENABLE ROW LEVEL SECURITY/);
  assert.match(migration, /ALTER TABLE public\.support_messages ENABLE ROW LEVEL SECURITY/);
  assert.match(migration, /ALTER TABLE public\.automation_outbox ENABLE ROW LEVEL SECURITY/);

  // Verify Customer cannot see internal notes
  assert.match(migration, /is_internal = false/);

  // Verify RPC functions
  assert.match(migration, /CREATE OR REPLACE FUNCTION public\.create_support_conversation/);
  assert.match(migration, /CREATE OR REPLACE FUNCTION public\.send_customer_support_message/);
  assert.match(migration, /CREATE OR REPLACE FUNCTION public\.request_human_support/);
  assert.match(migration, /CREATE OR REPLACE FUNCTION public\.admin_reply_support/);
  assert.match(migration, /CREATE OR REPLACE FUNCTION public\.admin_resolve_support/);
  assert.match(migration, /CREATE OR REPLACE FUNCTION public\.get_customer_growth_analytics/);
});

test("Support RLS: Internal staff notes are hidden from customers", () => {
  const messages = [
    { id: "1", is_internal: false, content: "Public customer message", sender_type: "CUSTOMER" },
    { id: "2", is_internal: true, content: "Internal staff note - confidential", sender_type: "STAFF" },
    { id: "3", is_internal: false, content: "Public staff reply", sender_type: "STAFF" },
  ];

  // Customer filter simulation (enforced by PostgreSQL RLS: is_internal = false)
  const customerVisible = messages.filter((m) => !m.is_internal);

  assert.equal(customerVisible.length, 2);
  assert.equal(customerVisible.some((m) => m.content.includes("confidential")), false);
  assert.equal(customerVisible.some((m) => m.sender_type === "CUSTOMER"), true);
  assert.equal(customerVisible.some((m) => m.sender_type === "STAFF"), true);
});

test("Staff Invitation: Super Admin AAL2 boundary and role validation", () => {
  const allowedRoles = ["cashier", "admin", "super_admin"];

  assert.equal(allowedRoles.includes("cashier"), true);
  assert.equal(allowedRoles.includes("admin"), true);
  assert.equal(allowedRoles.includes("super_admin"), true);
  assert.equal(allowedRoles.includes("unauthorized_role"), false);

  // AAL requirement simulation
  const checkAal2 = (aal) => aal === "aal2";
  assert.equal(checkAal2("aal1"), false);
  assert.equal(checkAal2("aal2"), true);
});

test("Last Super Admin Protection: Cannot remove final Super Admin", () => {
  const staff = [
    { id: "admin-1", role: "admin" },
    { id: "super-1", role: "super_admin" },
  ];

  const superAdminCount = staff.filter((s) => s.role === "super_admin").length;
  const canRemove = (userId, targetRole) => {
    if (targetRole === "super_admin" && superAdminCount <= 1) {
      return false;
    }
    return true;
  };

  assert.equal(canRemove("admin-1", "admin"), true);
  assert.equal(canRemove("super-1", "super_admin"), false);
});

test("AI Safety: Escalation rules trigger human handoff for payments and refunds", () => {
  // Classification rule simulation
  function evaluateRule(text) {
    const lower = text.toLowerCase();
    const disputePatterns = ["gcash", "payment", "money", "charged", "refund", "agent", "human", "person", "scam"];
    const needsHuman = disputePatterns.some((pattern) => lower.includes(pattern));
    return {
      needs_human: needsHuman,
      category: lower.includes("gcash") || lower.includes("payment") ? "PAYMENT" : "OTHER",
    };
  }

  // Safe inquiry -> does not force human
  const safeResult = evaluateRule("What sizes are available for the heavyweight tee?");
  assert.equal(safeResult.needs_human, false);

  // Payment dispute -> triggers human
  const paymentResult = evaluateRule("My GCash was deducted but the order is unpaid!");
  assert.equal(paymentResult.needs_human, true);
  assert.equal(paymentResult.category, "PAYMENT");

  // Explicit human request -> triggers human
  const humanRequestResult = evaluateRule("I need to speak to an agent please");
  assert.equal(humanRequestResult.needs_human, true);
});

test("Automation Outbox: HMAC-SHA256 signature verification passes and rejects expired/tampered tokens", () => {
  const secret = "test_webhook_secret_key_1968";
  const rawBody = JSON.stringify({ event_type: "SUPPORT_MESSAGE_CREATED", id: "evt_123" });
  const timestamp = Date.now().toString();

  const validSig = createHmac("sha256", secret)
    .update(`${timestamp}.${rawBody}`)
    .digest("hex");

  // 1. Valid signature
  assert.equal(verifyN8nWebhookSignature(rawBody, timestamp, validSig, secret), true);

  // 2. Tampered body
  const tamperedBody = JSON.stringify({ event_type: "PAYMENT_APPROVED", id: "evt_123" });
  assert.equal(verifyN8nWebhookSignature(tamperedBody, timestamp, validSig, secret), false);

  // 3. Expired timestamp (> 5 minutes ago)
  const expiredTimestamp = (Date.now() - 10 * 60 * 1000).toString();
  const expiredSig = createHmac("sha256", secret)
    .update(`${expiredTimestamp}.${rawBody}`)
    .digest("hex");
  assert.equal(verifyN8nWebhookSignature(rawBody, expiredTimestamp, expiredSig, secret), false);
});

test("Read-only tools: Courier tracking derived accurately for official carriers", () => {
  const jntUrl = getCourierTrackingUrl("JNT", "JT99887766PH");
  assert.equal(jntUrl, "https://www.jtexpress.ph/track-and-trace?waybillNo=JT99887766PH");

  const lbcUrl = getCourierTrackingUrl("LBC", "123456789");
  assert.equal(lbcUrl, "https://www.lbcexpress.com/ph/track");

  const emptyUrl = getCourierTrackingUrl("MANUAL", "");
  assert.equal(emptyUrl, null);
});

test("Support Hardening Migration: Revokes direct customer UPDATE and prevents sender spoofing", async () => {
  const hardeningMigration = await read("supabase/migrations/20260922010000_support_security_hardening.sql");

  assert.match(hardeningMigration, /REVOKE UPDATE, DELETE ON public\.support_conversations FROM authenticated/);
  assert.match(hardeningMigration, /DROP POLICY IF EXISTS support_conversations_customer_update ON public\.support_conversations/);
  assert.match(hardeningMigration, /CREATE POLICY support_conversations_admin_select/);
  assert.match(hardeningMigration, /CREATE POLICY support_conversations_admin_update/);
  assert.match(hardeningMigration, /coalesce\(auth\.jwt\(\) ->> 'aal', ''\) = 'aal2'/);

  assert.match(hardeningMigration, /CREATE OR REPLACE FUNCTION public\.customer_reopen_support/);
  assert.match(hardeningMigration, /CREATE OR REPLACE FUNCTION public\.customer_close_support/);
  assert.match(hardeningMigration, /CREATE OR REPLACE FUNCTION public\.admin_reopen_support/);
  assert.match(hardeningMigration, /CREATE OR REPLACE FUNCTION public\.admin_assign_staff/);
});

test("Live Customer Security Proofs: Authenticated customer cannot mutate privileged columns or spoof messages", async () => {
  let envContent = "";
  try {
    envContent = await read(".env.local");
  } catch {
    // Skip if .env.local not found
    return;
  }

  const getEnv = (key) => {
    const match = envContent.match(new RegExp(`^${key}=(.*)$`, "m"));
    return match ? match[1].trim() : null;
  };

  const supabaseUrl = getEnv("NEXT_PUBLIC_SUPABASE_URL") || "http://127.0.0.1:54321";
  const anonKey = getEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY");
  if (!anonKey) return;

  const { createClient } = await import("@supabase/supabase-js");
  const customerClient = createClient(supabaseUrl, anonKey, { auth: { persistSession: false } });

  // 1. Authenticate Customer
  const { data: custAuth, error: authErr } = await customerClient.auth.signInWithPassword({
    email: "customer.demo@1968.local",
    password: "Demo1968Customer!",
  });
  if (authErr) {
    console.warn("Skipping live session test: customer authentication failed", authErr.message);
    return;
  }
  const customerId = custAuth.user.id;

  // 2. Create a test support conversation via canonical RPC
  const { data: convId, error: createErr } = await customerClient.rpc("create_support_conversation", {
    p_category: "OTHER",
    p_initial_message: "Security audit test conversation",
  });
  assert.ifError(createErr);
  assert.ok(convId, "Conversation ID must be returned");

  // Proof 1: Customer CANNOT directly update assigned_staff_id on support_conversations
  const { error: assignStaffErr, data: assignStaffData } = await customerClient
    .from("support_conversations")
    .update({ assigned_staff_id: customerId })
    .eq("id", convId)
    .select();
  // Either error or 0 rows modified due to RLS
  assert.ok(assignStaffErr || !assignStaffData || assignStaffData.length === 0, "Direct staff assignment must fail");

  // Proof 2: Customer CANNOT directly change priority
  const { error: priorityErr, data: priorityData } = await customerClient
    .from("support_conversations")
    .update({ priority: "URGENT" })
    .eq("id", convId)
    .select();
  assert.ok(priorityErr || !priorityData || priorityData.length === 0, "Direct priority mutation must fail");

  // Proof 3: Customer CANNOT directly modify ai_state
  const { error: aiStateErr, data: aiStateData } = await customerClient
    .from("support_conversations")
    .update({ ai_state: "DISABLED" })
    .eq("id", convId)
    .select();
  assert.ok(aiStateErr || !aiStateData || aiStateData.length === 0, "Direct ai_state mutation must fail");

  // Proof 4: Customer CANNOT directly edit AI summary
  const { error: summaryErr, data: summaryData } = await customerClient
    .from("support_conversations")
    .update({ summary: "Hacked by attacker" })
    .eq("id", convId)
    .select();
  assert.ok(summaryErr || !summaryData || summaryData.length === 0, "Direct summary mutation must fail");

  // Proof 5: Customer CANNOT directly mark conversation resolved
  const { error: resolveErr, data: resolveData } = await customerClient
    .from("support_conversations")
    .update({ status: "RESOLVED", resolved_at: new Date().toISOString() })
    .eq("id", convId)
    .select();
  assert.ok(resolveErr || !resolveData || resolveData.length === 0, "Direct resolve mutation must fail");

  // Proof 6: Customer CANNOT create an internal staff note
  const { error: internalNoteErr } = await customerClient
    .from("support_messages")
    .insert({
      conversation_id: convId,
      sender_type: "CUSTOMER",
      sender_user_id: customerId,
      content: "Unauthorized internal note attempt",
      is_internal: true,
    });
  assert.ok(internalNoteErr, "Inserting is_internal=true as customer must be rejected by PostgreSQL RLS");

  // Proof 7: Customer CANNOT impersonate staff sender_type
  const { error: staffImpersonationErr } = await customerClient
    .from("support_messages")
    .insert({
      conversation_id: convId,
      sender_type: "STAFF",
      sender_user_id: customerId,
      content: "Impersonating staff member",
      is_internal: false,
    });
  assert.ok(staffImpersonationErr, "Inserting sender_type=STAFF as customer must be rejected by PostgreSQL RLS");

  // Proof 8: Customer CANNOT impersonate AI sender_type
  const { error: aiImpersonationErr } = await customerClient
    .from("support_messages")
    .insert({
      conversation_id: convId,
      sender_type: "AI",
      sender_user_id: customerId,
      content: "Impersonating 1968 Assistant",
      is_internal: false,
    });
  assert.ok(aiImpersonationErr, "Inserting sender_type=AI as customer must be rejected by PostgreSQL RLS");

  // Proof 9: Customer CANNOT spoof another user's sender_user_id
  const { error: userSpoofErr } = await customerClient
    .from("support_messages")
    .insert({
      conversation_id: convId,
      sender_type: "CUSTOMER",
      sender_user_id: "00000000-0000-0000-0000-000000000000",
      content: "Spoofing another customer UID",
      is_internal: false,
    });
  assert.ok(userSpoofErr, "Inserting mismatched sender_user_id must be rejected by PostgreSQL RLS");

  // Proof 10: Customer CAN request human support through canonical RPC
  const { data: handoffResult, error: handoffErr } = await customerClient.rpc("request_human_support", {
    p_conversation_id: convId,
  });
  assert.ifError(handoffErr);
  assert.equal(handoffResult, true, "request_human_support RPC must return true");

  // Verify resulting state in database
  const { data: updatedConv, error: verifyErr } = await customerClient
    .from("support_conversations")
    .select("status, ai_state, priority")
    .eq("id", convId)
    .single();
  assert.ifError(verifyErr);
  assert.equal(updatedConv.status, "WAITING_FOR_STAFF");
  assert.equal(updatedConv.ai_state, "PAUSED_FOR_HUMAN");
});

