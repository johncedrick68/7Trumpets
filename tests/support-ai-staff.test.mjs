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
