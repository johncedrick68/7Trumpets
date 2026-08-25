import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("required foundation files exist", () => {
  assert.ok(existsSync(".env.example"), ".env.example must exist");
  assert.ok(existsSync(".gitignore"), ".gitignore must exist");
  assert.ok(existsSync("package.json"), "package.json must exist");
  assert.ok(existsSync("tsconfig.json"), "tsconfig.json must exist");
  assert.ok(existsSync("next.config.ts"), "next.config.ts must exist");
  assert.ok(existsSync("eslint.config.mjs"), "eslint.config.mjs must exist");
  assert.ok(existsSync("src/app/layout.tsx"), "src/app/layout.tsx must exist");
  assert.ok(existsSync("src/app/page.tsx"), "src/app/page.tsx must exist");
  assert.ok(existsSync("src/app/globals.css"), "src/app/globals.css must exist");
});

test("stale types, unapproved SSR clients, and auth routes do not exist in Phase 2A", () => {
  assert.strictEqual(existsSync("src/types/database.ts"), false, "stale generated types must not exist in 2A");
  assert.strictEqual(existsSync("src/lib/supabase/client.ts"), false, "Supabase client helper must not exist in 2A");
  assert.strictEqual(existsSync("src/lib/supabase/server.ts"), false, "Supabase server helper must not exist in 2A");
  assert.strictEqual(existsSync("src/lib/supabase/proxy.ts"), false, "Supabase proxy helper must not exist in 2A");
  assert.strictEqual(existsSync("src/proxy.ts"), false, "proxy.ts must not exist in 2A");
  assert.strictEqual(existsSync("src/lib/auth/actions.ts"), false, "auth actions must not exist in 2A");
  assert.strictEqual(existsSync("src/app/login"), false, "login route must not exist in 2A");
  assert.strictEqual(existsSync("src/app/signup"), false, "signup route must not exist in 2A");
  assert.strictEqual(existsSync("src/app/account"), false, "account route must not exist in 2A");
});

test("package.json has expected scripts and minimal dependency surface", async () => {
  const pkg = JSON.parse(await read("package.json"));
  assert.strictEqual(pkg.name, "7trumpets");
  assert.strictEqual(pkg.private, true);
  assert.strictEqual(pkg.type, "module");
  assert.ok(pkg.scripts.dev);
  assert.ok(pkg.scripts.build);
  assert.ok(pkg.scripts.start);
  assert.ok(pkg.scripts.lint);
  assert.ok(pkg.scripts.test);

  // Runtime dependencies should only be next, react, react-dom
  const runtimeDeps = Object.keys(pkg.dependencies || {}).sort();
  assert.deepStrictEqual(runtimeDeps, ["next", "react", "react-dom"]);
  assert.strictEqual(pkg.dependencies["@supabase/ssr"], undefined, "@supabase/ssr deferred to 2B");
  assert.strictEqual(pkg.dependencies["@supabase/supabase-js"], undefined, "@supabase/supabase-js deferred to 2B");
});

test(".env.example contract uses modern placeholder names only", async () => {
  const envContent = await read(".env.example");
  assert.match(envContent, /^NEXT_PUBLIC_SUPABASE_URL=$/m);
  assert.match(envContent, /^NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=$/m);
  assert.match(envContent, /^SUPABASE_SECRET_KEY=$/m);

  assert.doesNotMatch(envContent, /ANON_KEY/);
  assert.doesNotMatch(envContent, /SERVICE_ROLE_KEY/);
});

test("source code does not expose secrets or simulate business/money logic", async () => {
  const layout = await read("src/app/layout.tsx");
  const page = await read("src/app/page.tsx");
  const combined = `${layout}\n${page}`;

  assert.doesNotMatch(combined, /SUPABASE_SECRET_KEY/);
  assert.doesNotMatch(combined, /SERVICE_ROLE/);
  assert.doesNotMatch(combined, /ANON_KEY/);
  assert.doesNotMatch(combined, /user_metadata/);
  assert.doesNotMatch(combined, /localStorage/);
  assert.doesNotMatch(combined, /admin/i);
  assert.doesNotMatch(combined, /price/i);
  assert.doesNotMatch(combined, /inventory/i);
  assert.doesNotMatch(combined, /payment/i);
});
