import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("admin foundation files and routes exist and are server components with dynamic rendering", async () => {
  assert.ok(existsSync("src/app/admin/layout.tsx"));
  assert.ok(existsSync("src/app/admin/page.tsx"));
  assert.ok(existsSync("src/app/admin/orders/page.tsx"));
  assert.ok(existsSync("src/app/admin/orders/[id]/page.tsx"));
  assert.ok(existsSync("src/app/admin/payments/page.tsx"));
  assert.ok(existsSync("src/app/admin/catalog/page.tsx"));
  assert.ok(existsSync("src/app/admin/audit/page.tsx"));
  assert.ok(existsSync("src/app/admin/users/page.tsx"));
  assert.ok(existsSync("src/lib/admin/auth.ts"));
  assert.ok(existsSync("src/lib/admin/actions.ts"));

  const layout = await read("src/app/admin/layout.tsx");
  const dashPage = await read("src/app/admin/page.tsx");
  const ordersPage = await read("src/app/admin/orders/page.tsx");
  const orderDetailPage = await read("src/app/admin/orders/[id]/page.tsx");
  const paymentsPage = await read("src/app/admin/payments/page.tsx");
  const catalogPage = await read("src/app/admin/catalog/page.tsx");
  const auditPage = await read("src/app/admin/audit/page.tsx");
  const usersPage = await read("src/app/admin/users/page.tsx");

  for (const content of [layout, dashPage, ordersPage, orderDetailPage, paymentsPage, catalogPage, auditPage, usersPage]) {
    assert.match(content, /dynamic = "force-dynamic"/);
    assert.doesNotMatch(content, /"use client"/);
  }
});

test("admin auth helper verifies role through the authenticated PostgreSQL boundary", async () => {
  const authHelper = await read("src/lib/admin/auth.ts");

  assert.match(authHelper, /getAdminAuthContext/);
  assert.match(authHelper, /auth\.getClaims\(\)/);
  assert.match(authHelper, /\.rpc\("current_user_role"\)/);
  assert.doesNotMatch(authHelper, /createServiceClient|\.schema\("private"\)/);

  // Does NOT trust user_metadata or query parameters for role assignment
  assert.doesNotMatch(authHelper, /user_metadata\.role|user_metadata\.admin/);
  assert.doesNotMatch(authHelper, /searchParams\.get\(["']role["']\)/);
});

test("admin layout requires AAL2 and admin pages retain server-side authentication", async () => {
  const layout = await read("src/app/admin/layout.tsx");
  const dashPage = await read("src/app/admin/page.tsx");
  const paymentsPage = await read("src/app/admin/payments/page.tsx");
  const usersPage = await read("src/app/admin/users/page.tsx");

  assert.match(layout, /requireAdminAal2\("\/admin"\)/);

  assert.match(dashPage, /getAdminAuthContext\(\)/);
  assert.match(paymentsPage, /getAdminAuthContext\(\)/);

  // Users page specifically requires super_admin
  assert.match(usersPage, /requireAdminAal2\("\/admin\/users"\)/);
  assert.match(usersPage, /adminCtx\.role !== "super_admin"/);
  assert.match(usersPage, /notFound\(\)/);
});

test("AAL2 is strictly enforced for super_admin role mutations", async () => {
  const adminActions = await read("src/lib/admin/actions.ts");
  const usersPage = await read("src/app/admin/users/page.tsx");

  assert.match(adminActions, /manageUserRole/);
  assert.match(adminActions, /requireAdminAal2\("\/admin\/users"\)/);
  assert.match(adminActions, /adminCtx\.role !== "super_admin"/);
  assert.match(adminActions, /manage_user_role/);

  // Users page displays warning if AAL2 is not satisfied
  assert.match(usersPage, /adminCtx\.aal !== "aal2"/);
  assert.match(usersPage, /AAL2 MFA Verification Required/);
});

test("GCash payment review actions use canonical database RPCs and do not mutate payments table directly", async () => {
  const adminActions = await read("src/lib/admin/actions.ts");

  // Approve GCash action uses approve_gcash_submission RPC
  assert.match(adminActions, /approveGcashSubmission/);
  assert.match(adminActions, /\.rpc\("approve_gcash_submission"/);

  // Reject GCash action uses reject_gcash_submission RPC
  assert.match(adminActions, /rejectGcashSubmission/);
  assert.match(adminActions, /\.rpc\("reject_gcash_submission"/);

  // Settle COD action uses settle_cod_payment RPC
  assert.match(adminActions, /settleCodPayment/);
  assert.match(adminActions, /\.rpc\("settle_cod_payment"/);

  // Does NOT directly UPDATE payments status to PAID without RPC
  assert.doesNotMatch(adminActions, /\.from\("payments"\)\.update\(\{\s*status:\s*["']PAID["']/);
});

test("Order fulfillment transitions use the authenticated admin boundary", async () => {
  const adminActions = await read("src/lib/admin/actions.ts");

  assert.match(adminActions, /transitionOrderStatus/);
  assert.match(adminActions, /\.rpc\("admin_transition_order"/);
  assert.doesNotMatch(adminActions, /\.from\("orders"\)\.update\(\{\s*status:/);
});

test("Audit logs view queries append-only audit_logs table via authorized server boundary", async () => {
  const auditPage = await read("src/app/admin/audit/page.tsx");

  assert.match(auditPage, /getAdminAuthContext/);
  assert.match(auditPage, /createServiceClient/);
  assert.match(auditPage, /\.from\("audit_logs"\)/);
  assert.match(auditPage, /\.order\("created_at", \{\s*ascending:\s*false\s*\}\)/);
});

test("Admin actions derive actor identity from the verified session and reject client-supplied identities", async () => {
  const adminActions = await read("src/lib/admin/actions.ts");

  assert.match(adminActions, /requireAdminAal2/);
  assert.doesNotMatch(adminActions, /p_reviewer_id:\s*formData\.get\(/);
  assert.doesNotMatch(adminActions, /p_changed_by:\s*formData\.get\(/);
  assert.doesNotMatch(adminActions, /p_actor_id:\s*formData\.get\(/);
});

test("Customer cannot call admin actions or transition order states", async () => {
  const adminActions = await read("src/lib/admin/actions.ts");
  const authHelper = await read("src/lib/admin/auth.ts");

  assert.match(adminActions, /requireAdminAal2/);
  assert.match(authHelper, /if \(!context\) redirect\(`\/login/);
});
