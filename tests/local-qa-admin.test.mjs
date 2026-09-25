import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { assertLocalSupabaseUrl } from "../scripts/local-qa-admin.mjs";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

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
