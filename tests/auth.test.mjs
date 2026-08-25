import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { safeRedirectPath } from "../src/lib/auth/redirect.ts";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("redirects accept only internal paths", () => {
  assert.strictEqual(safeRedirectPath("/account"), "/account");
  assert.strictEqual(safeRedirectPath("/update-password?complete=1"), "/update-password?complete=1");
  assert.strictEqual(safeRedirectPath("/"), "/");
  assert.strictEqual(safeRedirectPath("https://evil.example"), "/account");
  assert.strictEqual(safeRedirectPath("//evil.example"), "/account");
  assert.strictEqual(safeRedirectPath("/\\evil.example"), "/account");
  assert.strictEqual(safeRedirectPath("javascript:alert(1)"), "/account");
  assert.strictEqual(safeRedirectPath("data:text/html,test"), "/account");
  assert.strictEqual(safeRedirectPath(null, "/account"), "/account");
});

test("local email templates use the SSR token-hash routes", async () => {
  const confirmation = await read("supabase/templates/confirmation.html");
  const recovery = await read("supabase/templates/recovery.html");
  const config = await read("supabase/config.toml");

  assert.match(config, /\[auth\.email\.template\.confirmation\]/);
  assert.match(config, /\[auth\.email\.template\.recovery\]/);
  assert.match(confirmation, /\/auth\/confirm\?token_hash=\{\{ \.TokenHash \}\}&type=email/);
  assert.match(recovery, /\/auth\/confirm\?token_hash=\{\{ \.TokenHash \}\}&type=recovery&next=\/update-password/);
  assert.doesNotMatch(`${confirmation}${recovery}`, /ConfirmationURL/);
});

test("customer auth keeps identity and profile mutations server-authoritative", async () => {
  const actions = await read("src/lib/auth/actions.ts");
  const account = await read("src/app/account/page.tsx");
  const confirm = await read("src/app/auth/confirm/route.ts");

  assert.match(actions, /signUp/);
  assert.match(actions, /data:\s*\{\s*display_name:\s*displayName/);
  assert.doesNotMatch(actions, /data:.*(?:role|admin|permissions)/);
  assert.match(actions, /auth\.getUser\(\)/);
  assert.match(actions, /\.eq\("id", data\.user\.id\)/);
  assert.doesNotMatch(actions, /formData.*(?:user_id|userId|uid)/);
  assert.doesNotMatch(actions, /SUPABASE_SECRET_KEY|getSession|console\./);
  assert.match(account, /auth\.getClaims\(\)/);
  assert.match(confirm, /auth\.verifyOtp/);
  assert.doesNotMatch(`${account}${confirm}`, /getSession|SUPABASE_SECRET_KEY|console\./);
});
