import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("Admin Functional Audit: Order detail renders shipment tracking, courier portal link, and carrier notes", async () => {
  const orderDetailSource = await read("src/app/admin/orders/[id]/page.tsx");

  assert.match(orderDetailSource, /Shipment &amp; Tracking/);
  assert.match(orderDetailSource, /getCourierDisplayName\(s\.provider\)/);
  assert.match(orderDetailSource, /getCourierTrackingUrl\(s\.provider,\s*s\.tracking_number\)/);
  assert.match(orderDetailSource, /s\.tracking_number/);
  assert.match(orderDetailSource, /s\.carrier_notes/);
  assert.match(orderDetailSource, /Track on Official Courier Portal/);
});

test("Admin Functional Audit: Order detail renders return requests, refunds, and payment data integrity alert", async () => {
  const orderDetailSource = await read("src/app/admin/orders/[id]/page.tsx");

  assert.match(orderDetailSource, /return_requests \(/);
  assert.match(orderDetailSource, /refunds \(/);
  assert.match(orderDetailSource, /Returns &amp; Refunds/);
  assert.match(orderDetailSource, /Data Integrity Issue: Payment Missing/);
});

test("Admin Functional Audit: Orders workspace queries and searches tracking, phone, and GCash references", async () => {
  const pageSource = await read("src/app/admin/orders/page.tsx");
  const workspaceSource = await read("src/components/admin/orders-workspace.tsx");

  assert.match(pageSource, /shipments \(\s*tracking_number/);
  assert.match(pageSource, /payment_submissions \(\s*reference_number/);

  assert.match(workspaceSource, /trackingMatches/);
  assert.match(workspaceSource, /referenceMatches/);
  assert.match(workspaceSource, /recipient_phone/);
  assert.match(workspaceSource, /Courier Dispatch/);
});

test("Admin Functional Audit: Payment review workspace computes accurate count badges for all queues", async () => {
  const workspaceSource = await read("src/components/admin/payment-review-workspace.tsx");

  assert.match(workspaceSource, /const approvedCount = submissions\.filter/);
  assert.match(workspaceSource, /const rejectedCount = submissions\.filter/);
  assert.match(workspaceSource, /const totalSubmissionsCount = submissions\.length/);
  assert.match(workspaceSource, /\{totalSubmissionsCount\}/);
  assert.match(workspaceSource, /\{approvedCount\}/);
  assert.match(workspaceSource, /\{rejectedCount\}/);
  assert.match(workspaceSource, /\{pendingCount\}/);
});

test("Admin Functional Audit: Google OAuth configured in config.toml with env substitution and localhost redirects", async () => {
  const config = await read("supabase/config.toml");
  const envExample = await read(".env.example");

  assert.match(config, /\[auth\.external\.google\]/);
  assert.match(config, /enabled = true/);
  assert.match(config, /client_id = "env\(SUPABASE_AUTH_EXTERNAL_GOOGLE_CLIENT_ID\)"/);
  assert.match(config, /secret = "env\(SUPABASE_AUTH_EXTERNAL_GOOGLE_CLIENT_SECRET\)"/);
  assert.match(config, /"http:\/\/localhost:3000\/auth\/confirm"/);
  assert.match(config, /"http:\/\/localhost:3000\/update-password"/);

  assert.match(envExample, /SUPABASE_AUTH_EXTERNAL_GOOGLE_CLIENT_ID=/);
  assert.match(envExample, /SUPABASE_AUTH_EXTERNAL_GOOGLE_CLIENT_SECRET=/);
  // Ensure no secret values leaked in .env.example
  assert.doesNotMatch(envExample, /SUPABASE_AUTH_EXTERNAL_GOOGLE_CLIENT_ID=.+/);
  assert.doesNotMatch(envExample, /SUPABASE_AUTH_EXTERNAL_GOOGLE_CLIENT_SECRET=.+/);
});
