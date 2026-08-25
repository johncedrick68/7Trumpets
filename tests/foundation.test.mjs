import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("required foundation and Phase 2B Supabase client files exist", () => {
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
});

test("Phase 2C auth routes and actions do not exist in Phase 2B", () => {
  assert.strictEqual(existsSync("src/lib/auth/actions.ts"), false, "auth actions must not exist in 2B");
  assert.strictEqual(existsSync("src/lib/auth/redirect.ts"), false, "auth redirect helper must not exist in 2B");
  assert.strictEqual(existsSync("src/app/login"), false, "login route must not exist in 2B");
  assert.strictEqual(existsSync("src/app/signup"), false, "signup route must not exist in 2B");
  assert.strictEqual(existsSync("src/app/account"), false, "account route must not exist in 2B");
  assert.strictEqual(existsSync("src/app/auth"), false, "auth routes must not exist in 2B");
  assert.strictEqual(existsSync("src/app/forgot-password"), false, "forgot-password route must not exist in 2B");
  assert.strictEqual(existsSync("src/app/update-password"), false, "update-password route must not exist in 2B");
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

  // Table spot checks from 22 tables
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

  // Functions spot checks
  assert.match(typesContent, /checkout_order: \{/);
  assert.match(typesContent, /transition_order: \{/);
  assert.match(typesContent, /manage_user_role: \{/);
});
