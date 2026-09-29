import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { assertLocalSupabaseUrl } from "../scripts/local-qa-admin.mjs";
import { assertLocalCustomerTarget } from "../scripts/local-qa-customer.mjs";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("stock QA uses a local snapshot and canonical inventory instead of hydration rewriting", async () => {
  const helper = await read("scripts/local-qa-tenets-stock.mjs");
  const runner = await read("scripts/storefront-qa.mjs");
  assert.match(helper, /assertLocalCustomerTarget\(value\)/);
  assert.match(helper, /qa-tenets-stock-snapshot\.json/);
  assert.match(helper, /reserved\+i\.safety_stock/);
  assert.match(helper, /LOCAL_STOCK_QA_RESTORE_MISMATCH/);
  assert.match(runner, /finally \{ stockFixture\.restore\(\); \}/);
  assert.doesNotMatch(runner, /route\.fulfill|replaceAll\([^\n]*is_available/);
});

test("customer fixture rejects remote and disguised loopback targets", () => {
  assert.equal(assertLocalCustomerTarget("http://127.0.0.1:54321"), "http://127.0.0.1:54321");
  for (const url of ["https://x.supabase.co", "http://127.0.0.1:54321/other", "http://user@localhost:54321", "http://localhost:54321?remote=1", "http://localhost:8000"]) assert.throws(() => assertLocalCustomerTarget(url));
});

test("local QA bootstrap accepts only the known loopback Supabase API", () => {
  assert.equal(assertLocalSupabaseUrl("http://127.0.0.1:54321"), "http://127.0.0.1:54321");
  assert.equal(assertLocalSupabaseUrl("http://localhost:54321/"), "http://localhost:54321");
  for (const unsafe of [
    "https://example.supabase.co",
    "http://127.0.0.1:8000",
    "https://localhost:54321",
    "http://192.168.1.20:54321",
  ]) {
    assert.throws(() => assertLocalSupabaseUrl(unsafe), /LOCAL_QA_REJECTED/);
  }
});

test("axe bootstrap is ordinary-admin, ephemeral, and contains no secret persistence path", async () => {
  const bootstrap = await read("scripts/local-qa-admin.mjs");
  const runner = await read("scripts/admin-axe.mjs");

  assert.match(bootstrap, /values \('\$\{userId\}', 'admin'\)/);
  assert.doesNotMatch(bootstrap, /super_admin/);
  assert.match(bootstrap, /randomBytes/);
  assert.match(bootstrap, /auth\.admin\.deleteUser/);
  assert.match(runner, /currentLevel !== "aal2"/);
  assert.doesNotMatch(`${bootstrap}\n${runner}`, /writeFile|appendFile|DEMO_ADMIN_PASSWORD|DEMO_ADMIN_TOTP_SECRET/);
});
