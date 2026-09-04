import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("GCash Expiration: Migration creates hardened AAL2 admin RPCs and list eligibility function", async () => {
  const migrationPath = "supabase/migrations/20260905010000_close_expired_gcash_payment.sql";
  assert.ok(existsSync(migrationPath), "Migration file must exist");

  const migration = await read(migrationPath);

  // Checks both RPCs are defined
  assert.match(migration, /CREATE FUNCTION public\.close_expired_gcash_payment/);
  assert.match(migration, /CREATE FUNCTION public\.list_expired_gcash_payments/);

  // Checks security definer and hardened search_path
  assert.match(migration, /SECURITY DEFINER/);
  assert.match(migration, /SET search_path = ''/);

  // Checks admin AAL2 verification
  assert.match(migration, /private\.has_role\('admin'\)/);
  assert.match(migration, /auth\.jwt\(\) ->> 'aal'.*aal2/);

  // Checks least-privilege grants
  assert.match(migration, /REVOKE ALL ON FUNCTION public\.close_expired_gcash_payment.*FROM PUBLIC, anon, authenticated, service_role/);
  assert.match(migration, /GRANT EXECUTE ON FUNCTION public\.close_expired_gcash_payment.*TO authenticated/);
  assert.match(migration, /REVOKE ALL ON FUNCTION public\.list_expired_gcash_payments\(\) FROM PUBLIC, anon, authenticated, service_role/);
  assert.match(migration, /GRANT EXECUTE ON FUNCTION public\.list_expired_gcash_payments\(\) TO authenticated/);

  // Verifies existing canonical primitive is delegated to and NOT modified
  assert.match(migration, /private\.close_expired_gcash_payment/);
  assert.doesNotMatch(migration, /REVOKE EXECUTE ON FUNCTION private\.close_expired_gcash_payment.*FROM service_role/);
});

test("GCash Expiration: Server action enforces AAL2, derives stable idempotency key, and rejects browser keys", async () => {
  const actions = await read("src/lib/admin/actions.ts");

  // Verifies export of action
  assert.match(actions, /export async function expireGcashPayment\(formData: FormData\)/);

  // Verifies AAL2 check
  assert.match(actions, /await requireAdminAal2\("\/admin\/payments"\)/);

  // Verifies server-derived idempotency key: const idempotencyKey = `gcash_expire_${paymentId}`;
  assert.match(actions, /const idempotencyKey = `gcash_expire_\$\{paymentId\}`;/);

  // Verifies NO browser-submitted idempotency key is accepted or trusted from formData
  assert.doesNotMatch(actions, /formData\.get\(["']idempotency_key["']\)/);

  // Verifies canonical RPC invocation
  assert.match(actions, /rpc.*["']close_expired_gcash_payment["']/);
  assert.match(actions, /p_payment_id:\s*paymentId/);
  assert.match(actions, /p_idempotency_key:\s*idempotencyKey/);
  assert.match(actions, /p_reason:\s*reason/);

  // Verifies success redirect notice
  assert.match(actions, /redirect\(.*notice=gcash_expired.*\)/);
});

test("GCash Expiration: Admin payments UI consumes database-authoritative eligibility RPC without duplicating rules", async () => {
  const paymentsPage = await read("src/app/admin/payments/page.tsx");

  // Authoritative database RPC queried for expired GCash payments
  assert.match(paymentsPage, /rpc.*list_expired_gcash_payments/);

  // Does NOT duplicate expiration math (e.g. interval arithmetic) in page
  assert.doesNotMatch(paymentsPage, /Date\.now\(\)\s*-\s*expiresAt/);
  assert.doesNotMatch(paymentsPage, /expires_at\s*<\s*new\s*Date\(\)/);

  // Renders section and table for expired GCash payments
  assert.match(paymentsPage, /Expired Unresolved GCash Orders/);
  assert.match(paymentsPage, /expireGcashPayment/);
  assert.match(paymentsPage, /notice === "gcash_expired"/);
});

test("GCash Expiration: Action prevents open redirect vulnerability and ignores attacker-controlled return_to", async () => {
  const actions = await read("src/lib/admin/actions.ts");

  // Extract expireGcashPayment function implementation
  const expireMatch = actions.match(/export async function expireGcashPayment\(formData: FormData\) \{([\s\S]*?)\n\}/);
  assert.ok(expireMatch, "expireGcashPayment function must exist");
  const expireBody = expireMatch[1];

  // Must NEVER read raw return_to from formData
  assert.doesNotMatch(
    expireBody,
    /formData\.get\(["']return_to["']\)/,
    "Must not read or trust raw return_to from formData"
  );

  // Must use fixed safe internal return destination
  assert.match(
    expireBody,
    /const returnTo = ["']\/admin\/payments["'];/,
    "Must use fixed safe internal destination /admin/payments"
  );

  // Must pass fixed internal returnTo to requireAdminAal2
  assert.match(
    expireBody,
    /requireAdminAal2\(returnTo\)/,
    "requireAdminAal2 must use safe internal returnTo"
  );

  // All redirects in expireGcashPayment must use the fixed safe returnTo
  const redirectMatches = [...expireBody.matchAll(/redirect\((.*?)\)/g)];
  assert.ok(redirectMatches.length > 0, "expireGcashPayment must have redirects");
  for (const match of redirectMatches) {
    const target = match[1];
    assert.match(
      target,
      /`\$\{returnTo\}\?/,
      `Redirect target ${target} must strictly prefix with \${returnTo}?`
    );
  }
});

