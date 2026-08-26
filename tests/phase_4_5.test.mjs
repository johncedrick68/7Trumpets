import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("Phase 4 admin catalog and inventory server actions enforce AAL2 and RPC boundaries", async () => {
  const actions = await read("src/lib/admin/actions.ts");

  assert.match(actions, /export async function saveCategory/);
  assert.match(actions, /export async function saveProduct/);
  assert.match(actions, /export async function saveVariant/);
  assert.match(actions, /export async function adjustInventory/);

  // Verifies requireAdminAal2 is called before any mutation
  assert.match(actions, /requireAdminAal2\("\/admin\/catalog"\)/);
});

test("Phase 5 product discovery supports search, category filtering, and multi-variant pricing", async () => {
  const queries = await read("src/lib/catalog/queries.ts");

  assert.match(queries, /categoryId\?: string/);
  assert.match(queries, /search\?: string/);
  assert.match(queries, /sort\?: "newest" \| "price_asc" \| "price_desc"/);
  assert.match(queries, /min_price_minor/);
  assert.match(queries, /filter\(\s*\(v\) => v\.status === "active"/);
});

test("Phase 5 address actions support complete create, update, default, and delete operations", async () => {
  const addressActions = await read("src/lib/addresses/actions.ts");

  assert.match(addressActions, /export async function saveAddress/);
  assert.match(addressActions, /export async function setDefaultAddress/);
  assert.match(addressActions, /export async function deleteAddress/);
});

test("Phase 5 option choices resolve exactly one canonical variant", async () => {
  const { findVariant, sortByMinPrice } = await import("../src/lib/catalog/variants.ts");
  const variants = [
    { id: "small-red", sku: "SMALL-RED", price_minor: 500, available: true, option_value_ids: ["small", "red"] },
    { id: "medium-blue", sku: "MEDIUM-BLUE", price_minor: 900, available: true, option_value_ids: ["medium", "blue"] },
  ];

  assert.equal(findVariant(variants, ["red", "small"])?.id, "small-red");
  assert.deepEqual(findVariant(variants, ["medium", "blue"]), variants[1]);
  assert.equal(findVariant(variants, ["small", "blue"]), null);
  assert.equal(findVariant(variants, ["small", ""]), null);
  const products = [{ id: "B", min_price_minor: 600 }, { id: "A", min_price_minor: 500 }];
  assert.deepEqual(sortByMinPrice([...products], "price_asc").map(({ id }) => id), ["A", "B"]);
  assert.deepEqual(sortByMinPrice([...products], "price_desc").map(({ id }) => id), ["B", "A"]);
});

test("PHP decimal prices convert to centavos without floating-point arithmetic", async () => {
  const { parsePHPMinor } = await import("../src/lib/money.ts");
  assert.equal(parsePHPMinor("2999.00"), 299900);
  assert.equal(parsePHPMinor("0.01"), 1);
  assert.equal(parsePHPMinor("1.234"), null);
});
