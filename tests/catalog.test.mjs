import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import test from "node:test";

function formatMinorUnitsToPHP(minorUnits) {
  const php = minorUnits / 100;
  return new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(php);
}

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("minor units format correctly to PHP currency string", () => {
  assert.strictEqual(formatMinorUnitsToPHP(299900), "₱2,999.00");
  assert.strictEqual(formatMinorUnitsToPHP(15000), "₱150.00");
  assert.strictEqual(formatMinorUnitsToPHP(0), "₱0.00");
});

test("catalog query helpers use server client and active filters", async () => {
  const queries = await read("src/lib/catalog/queries.ts");

  assert.match(queries, /from\("categories"\)/);
  assert.match(queries, /is\("archived_at", null\)/);
  assert.match(queries, /from\("products"\)/);
  assert.match(queries, /eq\("status", "active"\)/);
  assert.match(queries, /from\("product_variants"\)/);
  assert.match(queries, /eq\("status", "active"\)/);
  assert.match(queries, /from\("product_images"\)/);
  assert.doesNotMatch(queries, /SUPABASE_SECRET_KEY|service_role/i);
});

test("catalog pages exist and are server components with dynamic rendering", async () => {
  assert.ok(existsSync("src/app/products/page.tsx"));
  assert.ok(existsSync("src/app/products/[slug]/page.tsx"));
  assert.ok(existsSync("src/app/categories/[slug]/page.tsx"));

  const productsPage = await read("src/app/products/page.tsx");
  const productDetail = await read("src/app/products/[slug]/page.tsx");
  const categoryPage = await read("src/app/categories/[slug]/page.tsx");

  assert.match(productsPage, /dynamic = "force-dynamic"/);
  assert.match(productDetail, /dynamic = "force-dynamic"/);
  assert.match(categoryPage, /dynamic = "force-dynamic"/);

  assert.doesNotMatch(productsPage, /"use client"/);
  assert.doesNotMatch(productDetail, /"use client"/);
  assert.doesNotMatch(categoryPage, /"use client"/);
});

test("catalog does not contain hardcoded products or prices in markup", async () => {
  const productsPage = await read("src/app/products/page.tsx");
  const homePage = await read("src/app/page.tsx");

  assert.doesNotMatch(productsPage, /₱[0-9]+(?:\.[0-9]{2})?/);
  assert.doesNotMatch(homePage, /₱[0-9]+(?:\.[0-9]{2})?/);
});
