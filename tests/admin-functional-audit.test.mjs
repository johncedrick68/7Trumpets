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
  assert.match(orderDetailSource, /Array\.isArray\(order\.payments\) \? order\.payments\[0\] : order\.payments/);
  assert.doesNotMatch(orderDetailSource, /order\.payments as any/);
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

test("Admin Functional Audit: Orders page normalizes Supabase relation shapes before rendering", async () => {
  const pageSource = await read("src/app/admin/orders/page.tsx");

  assert.match(pageSource, /Array\.isArray\(order\.payments\)/);
  assert.match(pageSource, /\? \[order\.payments\]/);
  assert.match(pageSource, /Array\.isArray\(order\.shipments\)/);
  assert.match(pageSource, /Array\.isArray\(order\.order_items\)/);
  assert.doesNotMatch(pageSource, /as unknown as AdminOrderSummary\[\]/);
});

test("Admin Functional Audit: Dialog portals preserve select stacking and variant creation keeps product context", async () => {
  const dialogSource = await read("src/components/ui/dialog.tsx");
  const selectSource = await read("src/components/ui/select.tsx");
  const variantSource = await read("src/components/admin/variant-dialog.tsx");
  const catalogSource = await read("src/app/admin/catalog/page.tsx");

  assert.match(dialogSource, /fixed inset-0 z-40/);
  assert.match(dialogSource, /left-\[50%\] z-50/);
  assert.match(selectSource, /relative z-60/);
  assert.match(variantSource, /type="hidden" name="product_id" value=\{productId\}/);
  assert.match(variantSource, /<DialogClose asChild>/);
  assert.match(variantSource, /grid gap-4 sm:grid-cols-2/);
  assert.match(catalogSource, /<VariantDialog products=\{productList\} productId=\{product\.id\} \/>/);
  assert.match(catalogSource, /Array\.isArray\(variant\.inventory\) \? variant\.inventory\[0\] : variant\.inventory/);
  assert.doesNotMatch(catalogSource, /const inv = variant\.inventory\?\.\[0\]/);
});

test("Admin Functional Audit: catalog dialogs let redirecting server actions own submission", async () => {
  for (const file of ["category-dialog.tsx", "product-dialog.tsx", "variant-dialog.tsx", "product-image-dialog.tsx"]) {
    const source = await read(`src/components/admin/${file}`);
    assert.doesNotMatch(source, /await save(?:Category|Product|Variant|ProductImage)\(formData\)/);
    assert.match(source, /<form action=\{save(?:Category|Product|Variant|ProductImage)\}/);
  }
});

test("Admin Functional Audit: mutation fixtures are hard-guarded to local Supabase", async () => {
  const guard = await read("scripts/local-supabase-guard.mjs");
  const fullDomain = await read("scripts/verify-full-domain-e2e.mjs");
  const retailFlows = await read("scripts/verify-master-retail-flows.mjs");
  const demoUsers = await read("scripts/create-demo-users.mjs");

  assert.match(guard, /new Set\(\["localhost", "127\.0\.0\.1", "::1"\]\)/);
  assert.match(guard, /process\.env\.NODE_ENV === "production"/);
  assert.match(guard, /process\.env\.VERCEL/);
  for (const source of [fullDomain, retailFlows, demoUsers]) {
    assert.match(source, /assertLocalSupabaseTarget\(/);
  }
});

test("Admin Functional Audit: payment settings preserve the configured COD ceiling", async () => {
  const settingsPage = await read("src/app/admin/settings/page.tsx");
  assert.match(settingsPage, /cod_max_minor: payment\.cod_max_minor/);
  assert.match(settingsPage, /const payment = \{ \.\.\.paymentDefaults, \.\.\.\(\(settings\.payment\?\.value as Partial<PaymentSettings>\) \|\| \{\}\) \}/);
  assert.match(settingsPage, /const footer = \{ \.\.\.footerDefaults, \.\.\.\(\(settings\.footer\?\.value as Partial<FooterSettings>\) \|\| \{\}\) \}/);
});

test("Admin Functional Audit: settings writes can reach admin-only RLS without delete grants", async () => {
  const migration = await read("supabase/migrations/20260924010000_store_settings_admin_grants.sql");
  assert.match(migration, /GRANT INSERT, UPDATE ON TABLE public\.store_settings TO authenticated/);
  assert.match(migration, /REVOKE DELETE ON TABLE public\.store_settings FROM authenticated/);
  assert.doesNotMatch(migration, /GRANT[^;]*DELETE[^;]*authenticated/);
  const foundation = await read("supabase/migrations/20260920000000_domain_hierarchy_expansion.sql");
  assert.match(foundation, /store_settings_admin_mutate/);
  assert.match(foundation, /private\.has_role\('admin'/);
  assert.match(foundation, /private\.has_role\('super_admin'/);
});

test("Admin Functional Audit: GCash review idempotency keys fit the database limit", async () => {
  const actions = await read("src/lib/admin/actions.ts");
  assert.match(actions, /`gcash_appr_\$\{randomUUID\(\)\}`/);
  assert.match(actions, /`gcash_rej_\$\{randomUUID\(\)\}`/);
  assert.doesNotMatch(actions, /gcash_(?:appr|rej)_\$\{paymentId\}_\$\{submissionId\}/);
});

test("Admin Functional Audit: product media storage accepts every server-validated format", async () => {
  const migration = await read("supabase/migrations/20260925010000_product_images_png_jpeg.sql");
  assert.match(migration, /allowed_mime_types\s*=\s*ARRAY\['image\/jpeg', 'image\/png', 'image\/webp'\]/);
  const actions = await read("src/lib/admin/actions.ts");
  assert.match(actions, /inspectReceiptImage\(buffer\)/);
  assert.match(actions, /file\.type !== image\.mime/);
});

test("Admin Functional Audit: support composer communicates its keyboard behavior", async () => {
  const inbox = await read("src/components/admin/support-inbox.tsx");
  assert.match(inbox, /htmlFor="admin-support-message"/);
  assert.match(inbox, /aria-describedby="admin-support-message-hint"/);
  assert.match(inbox, /Enter to send · Shift\+Enter for a new line/);
  assert.match(inbox, /aria-label=\{replyMode === "internal" \? "Save internal staff note" : "Send message"\}/);
});

test("Admin Functional Audit: returns disclosure does not nest a button inside summary", async () => {
  const returnsPage = await read("src/app/admin/returns/page.tsx");
  assert.doesNotMatch(returnsPage, /<summary[^>]*>[\s\S]{0,300}<Button/);
});

test("Admin Functional Audit: POS visibly and functionally blocks sales while the register is closed", async () => {
  const terminalSource = await read("src/components/admin/pos-terminal.tsx");
  const actionsSource = await read("src/lib/pos/actions.ts");

  assert.match(terminalSource, /if \(!activeSession \|\| variant\.available_count <= 0\) return/);
  assert.match(terminalSource, /disabled=\{isOutOfStock \|\| !activeSession\}/);
  assert.match(terminalSource, /disabled=\{!activeSession \|\| cart\.length === 0/);
  assert.match(terminalSource, /Open Register to Start Sale/);
  assert.match(terminalSource, /lg:sticky lg:top-20/);
  assert.match(actionsSource, /\.rpc\("create_pos_sale"/);
});

test("Admin Functional Audit: POS database boundary requires an owned AAL2 open register under row lock", async () => {
  const migration = await read("supabase/migrations/20260923010000_pos_register_session_enforcement.sql");
  const actionsSource = await read("src/lib/pos/actions.ts");
  const pageSource = await read("src/app/admin/pos/page.tsx");

  assert.match(migration, /coalesce\(auth\.jwt\(\) ->> 'aal', ''\) <> 'aal2'/);
  assert.match(migration, /v_session\.cashier_id <> v_actor/);
  assert.match(migration, /v_session\.status <> 'OPEN'/);
  assert.match(migration, /FROM public\.register_sessions AS rs[\s\S]*FOR UPDATE/);
  assert.match(migration, /RETURN private\.create_pos_sale/);
  assert.match(migration, /REVOKE ALL ON FUNCTION private\.create_pos_sale[\s\S]*PUBLIC, anon, authenticated, service_role/);
  assert.match(migration, /GRANT EXECUTE ON FUNCTION public\.create_pos_sale[\s\S]*TO authenticated/);
  assert.match(actionsSource, /POS_REGISTER_SESSION_CLOSED/);
  assert.match(pageSource, /register_session_required/);
  assert.match(pageSource, /register_session_closed/);
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

test("Admin Functional Audit: operational query failures are not presented as empty queues", async () => {
  const paymentsSource = await read("src/app/admin/payments/page.tsx");
  const returnsSource = await read("src/app/admin/returns/page.tsx");
  const settingsSource = await read("src/app/admin/settings/page.tsx");

  assert.match(paymentsSource, /const expiredUnavailable = Boolean\(expiredRes\.error\)/);
  assert.match(paymentsSource, /Unable to load expired payments/);
  assert.match(returnsSource, /throw new Error\("ADMIN_RETURNS_UNAVAILABLE"\)/);
  assert.doesNotMatch(returnsSource, /Error: \{error\}/);
  assert.doesNotMatch(settingsSource, /Error saving settings: \{error\}/);
});

test("Admin Functional Audit: dashboard localizes non-critical query failures", async () => {
  const dashboard = await read("src/app/admin/page.tsx");

  assert.doesNotMatch(dashboard, /throw new Error\("ADMIN_DASHBOARD_UNAVAILABLE"\)/);
  assert.match(dashboard, /partial_database_failure/);
  assert.match(dashboard, /queryErrors\.payments \? "Queue unavailable"/);
  assert.match(dashboard, /queryErrors\.inventory \? "Inventory unavailable"/);
  assert.match(dashboard, /queryErrors\.orders \? "Unavailable"/);
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
