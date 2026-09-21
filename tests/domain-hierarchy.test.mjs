import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("Phase 0 & 1: Migration defines explicit sales_channel, fulfillment_method, and register_session on orders", async () => {
  const migration = await read("supabase/migrations/20260920000000_domain_hierarchy_expansion.sql");

  assert.match(migration, /sales_channel TEXT NOT NULL DEFAULT 'STOREFRONT'/);
  assert.match(migration, /CHECK \(sales_channel IN \('STOREFRONT', 'POS'\)\)/);
  assert.match(migration, /fulfillment_method TEXT NOT NULL DEFAULT 'SHIPMENT'/);
  assert.match(migration, /CHECK \(fulfillment_method IN \('SHIPMENT', 'STORE_PICKUP'\)\)/);
  assert.match(migration, /register_session_id UUID/);
});

test("Phase 0 & 1: Payments explicitly support CASH counter payments alongside COD and MANUAL_GCASH", async () => {
  const migration = await read("supabase/migrations/20260920000000_domain_hierarchy_expansion.sql");

  assert.match(migration, /CHECK \(method IN \('COD', 'MANUAL_GCASH', 'CASH'\)\)/);
});

test("Phase 0 & 1: Roles explicitly support cashier role alongside customer, admin, super_admin", async () => {
  const migration = await read("supabase/migrations/20260920000000_domain_hierarchy_expansion.sql");

  assert.match(migration, /CHECK \(role IN \('customer', 'cashier', 'admin', 'super_admin'\)\)/);
  assert.match(migration, /private\.has_role\(required_role text\)/);
});

test("Phase 0 & 1: Register sessions table, shipments, return requests, refunds, and store settings are modeled", async () => {
  const migration = await read("supabase/migrations/20260920000000_domain_hierarchy_expansion.sql");

  assert.match(migration, /CREATE TABLE IF NOT EXISTS public\.register_sessions/);
  assert.match(migration, /CREATE TABLE IF NOT EXISTS public\.shipments/);
  assert.match(migration, /CREATE TABLE IF NOT EXISTS public\.return_requests/);
  assert.match(migration, /CREATE TABLE IF NOT EXISTS public\.refunds/);
  assert.match(migration, /CREATE TABLE IF NOT EXISTS public\.store_settings/);

  // Checks seeded default settings
  assert.match(migration, /'announcement'/);
  assert.match(migration, /'hero'/);
  assert.match(migration, /'fulfillment'/);
  assert.match(migration, /'payment'/);
});

test("Phase 0 & 1: Permitted order transitions support store pickup & counter handover directly to DELIVERED", async () => {
  const migration = await read("supabase/migrations/20260920000000_domain_hierarchy_expansion.sql");

  assert.match(migration, /\('PROCESSING', 'DELIVERED'\)/);
  assert.match(migration, /\('READY_FOR_SHIPMENT', 'DELIVERED'\)/);
});

test("Phase 0 & 1: Transactional RPCs for register sessions, POS cash sales, returns, and refunds are defined", async () => {
  const migration = await read("supabase/migrations/20260920000000_domain_hierarchy_expansion.sql");

  assert.match(migration, /CREATE OR REPLACE FUNCTION public\.open_register_session/);
  assert.match(migration, /CREATE OR REPLACE FUNCTION public\.close_register_session/);
  assert.match(migration, /CREATE OR REPLACE FUNCTION public\.create_pos_sale/);
  assert.match(migration, /CREATE OR REPLACE FUNCTION public\.create_customer_return_request/);
  assert.match(migration, /CREATE OR REPLACE FUNCTION public\.admin_process_return_request/);
  assert.match(migration, /CREATE OR REPLACE FUNCTION public\.admin_issue_refund/);
  assert.match(migration, /CREATE OR REPLACE FUNCTION public\.admin_create_shipment/);
});
