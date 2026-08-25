import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("required foundation and Phase 2B-2E files exist", () => {
  assert.ok(existsSync(".env.example"), ".env.example must exist");
  assert.ok(existsSync(".gitignore"), ".gitignore must exist");
  assert.ok(existsSync("package.json"), "package.json must exist");
  assert.ok(existsSync("tsconfig.json"), "tsconfig.json must exist");
  assert.ok(existsSync("next.config.ts"), "next.config.ts must exist");
  assert.ok(existsSync("eslint.config.mjs"), "eslint.config.mjs must exist");
  assert.ok(existsSync("src/app/layout.tsx"), "src/app/layout.tsx must exist");
  assert.ok(existsSync("src/app/page.tsx"), "src/app/page.tsx must exist");
  assert.ok(existsSync("src/app/globals.css"), "src/app/globals.css must exist");
  assert.ok(existsSync("src/types/database.ts"), "src/types/database.ts must exist");
  assert.ok(existsSync("src/lib/supabase/client.ts"), "src/lib/supabase/client.ts must exist");
  assert.ok(existsSync("src/lib/supabase/server.ts"), "src/lib/supabase/server.ts must exist");
  assert.ok(existsSync("src/lib/supabase/proxy.ts"), "src/lib/supabase/proxy.ts must exist");
  assert.ok(existsSync("src/proxy.ts"), "src/proxy.ts must exist");

  // Phase 2C auth files
  assert.ok(existsSync("src/lib/auth/actions.ts"), "auth actions must exist in 2C");
  assert.ok(existsSync("src/lib/auth/redirect.ts"), "auth redirect helper must exist in 2C");
  assert.ok(existsSync("src/app/login/page.tsx"), "login route must exist in 2C");
  assert.ok(existsSync("src/app/signup/page.tsx"), "signup route must exist in 2C");
  assert.ok(existsSync("src/app/account/page.tsx"), "account route must exist in 2C");
  assert.ok(existsSync("src/app/auth/confirm/route.ts"), "auth confirm route must exist in 2C");
  assert.ok(existsSync("src/app/auth/error/page.tsx"), "auth error page must exist in 2C");
  assert.ok(existsSync("src/app/forgot-password/page.tsx"), "forgot-password route must exist in 2C");
  assert.ok(existsSync("src/app/update-password/page.tsx"), "update-password route must exist in 2C");
  assert.ok(existsSync("supabase/templates/confirmation.html"), "confirmation template must exist in 2C");
  assert.ok(existsSync("supabase/templates/recovery.html"), "recovery template must exist in 2C");

  // Phase 2D catalog files
  assert.ok(existsSync("src/lib/catalog/queries.ts"), "catalog queries helper must exist in 2D");
  assert.ok(existsSync("src/app/products/page.tsx"), "products route must exist in 2D");
  assert.ok(existsSync("src/app/products/[slug]/page.tsx"), "product detail route must exist in 2D");
  assert.ok(existsSync("src/app/categories/[slug]/page.tsx"), "category products route must exist in 2D");

  // Phase 2E cart and address files
  assert.ok(existsSync("src/lib/cart/actions.ts"), "cart actions must exist in 2E");
  assert.ok(existsSync("src/lib/addresses/actions.ts"), "address actions must exist in 2E");
  assert.ok(existsSync("src/app/cart/page.tsx"), "cart page must exist in 2E");
  assert.ok(existsSync("src/app/account/addresses/page.tsx"), "addresses page must exist in 2E");
});

test("Phase 2F-2H checkout, payment, and admin features do not exist in Phase 2E", () => {
  assert.strictEqual(existsSync("src/app/checkout"), false, "checkout route must not exist in 2E");
  assert.strictEqual(existsSync("src/app/orders"), false, "orders route must not exist in 2E");
  assert.strictEqual(existsSync("src/app/admin"), false, "admin routes must not exist in 2E");
});

test("package.json includes approved Supabase packages", async () => {
  const pkg = JSON.parse(await read("package.json"));
  assert.strictEqual(pkg.name, "7trumpets");
  assert.strictEqual(pkg.private, true);
  assert.strictEqual(pkg.type, "module");
  assert.ok(pkg.scripts.dev);
  assert.ok(pkg.scripts.build);
  assert.ok(pkg.scripts.start);
  assert.ok(pkg.scripts.lint);
  assert.ok(pkg.scripts.test);

  const runtimeDeps = Object.keys(pkg.dependencies || {}).sort();
  assert.deepStrictEqual(runtimeDeps, [
    "@supabase/ssr",
    "@supabase/supabase-js",
    "next",
    "react",
    "react-dom",
  ]);
});

test(".env.example contract uses modern placeholder names only", async () => {
  const envContent = await read(".env.example");
  assert.match(envContent, /^NEXT_PUBLIC_SUPABASE_URL=$/m);
  assert.match(envContent, /^NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=$/m);
  assert.match(envContent, /^SUPABASE_SECRET_KEY=$/m);

  assert.doesNotMatch(envContent, /ANON_KEY/);
  assert.doesNotMatch(envContent, /SERVICE_ROLE_KEY/);
});

test("Supabase client helpers use modern env keys and never expose secrets to browser", async () => {
  const browserClient = await read("src/lib/supabase/client.ts");
  const serverClient = await read("src/lib/supabase/server.ts");
  const proxyClient = await read("src/lib/supabase/proxy.ts");

  assert.match(browserClient, /NEXT_PUBLIC_SUPABASE_URL/);
  assert.match(browserClient, /NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY/);
  assert.doesNotMatch(browserClient, /SUPABASE_SECRET_KEY/);
  assert.doesNotMatch(browserClient, /SERVICE_ROLE/);
  assert.doesNotMatch(browserClient, /ANON_KEY/);

  assert.match(serverClient, /NEXT_PUBLIC_SUPABASE_URL/);
  assert.match(serverClient, /NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY/);
  assert.doesNotMatch(serverClient, /SUPABASE_SECRET_KEY/);

  assert.match(proxyClient, /NEXT_PUBLIC_SUPABASE_URL/);
  assert.match(proxyClient, /NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY/);
  assert.doesNotMatch(proxyClient, /SUPABASE_SECRET_KEY/);
});

test("generated database types contain the 22-table schema and Phase 1D RPC definitions", async () => {
  const typesContent = await read("src/types/database.ts");

  assert.match(typesContent, /profiles: \{/);
  assert.match(typesContent, /categories: \{/);
  assert.match(typesContent, /products: \{/);
  assert.match(typesContent, /product_variants: \{/);
  assert.match(typesContent, /orders: \{/);
  assert.match(typesContent, /order_items: \{/);
  assert.match(typesContent, /order_status_history: \{/);
  assert.match(typesContent, /payments: \{/);
  assert.match(typesContent, /payment_submissions: \{/);
  assert.match(typesContent, /payment_events: \{/);
  assert.match(typesContent, /audit_logs: \{/);
  assert.match(typesContent, /inventory: \{/);
  assert.match(typesContent, /inventory_movements: \{/);
  assert.match(typesContent, /inventory_reservations: \{/);

  assert.match(typesContent, /checkout_order: \{/);
  assert.match(typesContent, /transition_order: \{/);
  assert.match(typesContent, /manage_user_role: \{/);
});
