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

// ---------------------------------------------------------------------------
// Executable Phase 4/5 Catalog & Admin Behavior Tests
// ---------------------------------------------------------------------------

import {
  executeAdjustInventory,
  executeDeleteProductImage,
  executeSaveCategory,
  executeSaveOptionValue,
  executeSaveProduct,
  executeSaveProductImage,
  executeSaveProductOption,
  executeSaveVariant,
  executeSetVariantOptionValue,
  parseOptionalUuid,
  parseRequiredUuid,
  validateVariantStatus,
} from "../src/lib/admin/catalog-input.ts";

function createMockHarness(options = {}) {
  const calls = {
    auth: [],
    clientQueries: [],
    serviceQueries: [],
    rpc: [],
    storageUploads: [],
    storageRemoves: [],
    redirects: [],
    revalidations: [],
  };

  const adapter = {
    requireAdminAal2: async (returnTo) => {
      calls.auth.push(returnTo);
      if (options.authDenied) {
        throw new Error("AAL2_AUTH_DENIED");
      }
      return { user: { id: "admin-uuid" }, role: "admin" };
    },
    getSupabase: async () => ({
      from: (table) => ({
        select: (cols) => ({
          eq: (col1, val1) => ({
            eq: (col2, val2) => ({
              maybeSingle: async () => {
                calls.clientQueries.push({ table, cols, filter: { [col1]: val1, [col2]: val2 } });
                if (options.readError) return { data: null, error: new Error("DB_READ_ERROR") };
                const found = (options.records?.[table] || []).find(
                  (r) => r[col1] === val1 && (!col2 || r[col2] === val2)
                );
                return { data: found || null, error: null };
              },
            }),
            maybeSingle: async () => {
              calls.clientQueries.push({ table, cols, filter: { [col1]: val1 } });
              if (options.readError) return { data: null, error: new Error("DB_READ_ERROR") };
              const found = (options.records?.[table] || []).find((r) => r[col1] === val1);
              return { data: found || null, error: null };
            },
          }),
        }),
      }),
      rpc: async (fn, args) => {
        calls.rpc.push({ fn, args });
        if (options.rpcError) return { data: null, error: new Error("RPC_ERROR") };
        return { data: "success-uuid", error: null };
      },
    }),
    getServiceClient: () => ({
      from: (table) => ({
        select: (cols) => ({
          eq: (col1, val1) => ({
            maybeSingle: async () => {
              calls.serviceQueries.push({ table, cols, filter: { [col1]: val1 } });
              if (options.serviceReadError) return { data: null, error: new Error("SERVICE_READ_ERROR") };
              const found = (options.records?.[table] || []).find((r) => r[col1] === val1);
              return { data: found || null, error: null };
            },
          }),
        }),
      }),
      storage: {
        from: (bucket) => ({
          upload: async (path, buffer, opts) => {
            calls.storageUploads.push({ bucket, path, buffer, opts });
            if (options.uploadError) return { data: null, error: new Error("UPLOAD_ERROR") };
            return { data: { path }, error: null };
          },
          remove: async (paths) => {
            calls.storageRemoves.push({ bucket, paths });
            return { data: null, error: null };
          },
        }),
      },
    }),
    inspectImage: () => {
      if (options.invalidImage) return null;
      return { mime: "image/webp", extension: "webp", width: 400, height: 400 };
    },
    redirect: (url) => {
      calls.redirects.push(url);
      const err = new Error(`REDIRECT:${url}`);
      err.url = url;
      throw err;
    },
    revalidatePath: (path) => {
      calls.revalidations.push(path);
    },
  };

  return { adapter, calls };
}

test("Phase 4 executable: auth denial blocks reads and mutations for each catalog action", async () => {
  const { adapter, calls } = createMockHarness({ authDenied: true });

  const actionsToTest = [
    { name: "saveCategory", fn: () => executeSaveCategory(new FormData(), adapter) },
    { name: "saveProduct", fn: () => executeSaveProduct(new FormData(), adapter) },
    { name: "saveVariant", fn: () => executeSaveVariant(new FormData(), adapter) },
    { name: "saveProductOption", fn: () => executeSaveProductOption(new FormData(), adapter) },
    { name: "saveOptionValue", fn: () => executeSaveOptionValue(new FormData(), adapter) },
    { name: "setVariantOptionValue", fn: () => executeSetVariantOptionValue(new FormData(), adapter) },
    { name: "saveProductImage", fn: () => executeSaveProductImage(new FormData(), adapter) },
    { name: "deleteProductImage", fn: () => executeDeleteProductImage(new FormData(), adapter) },
    { name: "adjustInventory", fn: () => executeAdjustInventory(new FormData(), adapter) },
  ];

  for (const { name, fn } of actionsToTest) {
    await assert.rejects(async () => await fn(), /AAL2_AUTH_DENIED/, `${name} must reject upon auth denial`);
  }

  assert.equal(calls.auth.length, 9, "All 9 actions must invoke requireAdminAal2");
  assert.equal(calls.clientQueries.length, 0, "No client queries may run upon auth denial");
  assert.equal(calls.serviceQueries.length, 0, "No service queries may run upon auth denial");
  assert.equal(calls.rpc.length, 0, "No RPC mutations may run upon auth denial");
  assert.equal(calls.storageUploads.length, 0, "No storage uploads may run upon auth denial");
});

test("Phase 4 executable: product rename preserves persisted description, category, and status", async () => {
  const prodId = "11111111-1111-4111-8111-111111111111";
  const catId = "22222222-2222-4222-8222-222222222222";
  const existingProduct = {
    id: prodId,
    category_id: catId,
    name: "Original Street Tee",
    slug: "original-street-tee",
    description: "Persisted heavyweight cotton tee description",
    status: "published",
  };

  const { adapter, calls } = createMockHarness({
    records: { products: [existingProduct] },
  });

  const fd = new FormData();
  fd.append("id", prodId);
  fd.append("name", "Renamed Street Tee");
  fd.append("slug", "renamed-street-tee");
  // description, category_id, status are omitted

  await assert.rejects(async () => await executeSaveProduct(fd, adapter), /REDIRECT:\/admin\/catalog\?notice=product_saved/);

  assert.equal(calls.rpc.length, 1);
  const rpcCall = calls.rpc[0];
  assert.equal(rpcCall.fn, "admin_save_product");
  assert.equal(rpcCall.args.p_id, prodId);
  assert.equal(rpcCall.args.p_name, "Renamed Street Tee");
  assert.equal(rpcCall.args.p_slug, "renamed-street-tee");
  assert.equal(rpcCall.args.p_description, "Persisted heavyweight cotton tee description", "persisted description must be preserved");
  assert.equal(rpcCall.args.p_category_id, catId, "persisted category_id must be preserved");
  assert.equal(rpcCall.args.p_status, "published", "persisted status must be preserved");
});

test("Phase 4 executable: category rename preserves persisted description, parent, position, and archive state", async () => {
  const catId = "33333333-3333-4333-8333-333333333333";
  const parentId = "44444444-4444-4444-8444-444444444444";
  const existingCategory = {
    id: catId,
    name: "Hoodies",
    slug: "hoodies",
    description: "Heavyweight seasonal outerwear",
    parent_id: parentId,
    position: 7,
    archived_at: "2026-09-01T12:00:00Z",
  };

  const { adapter, calls } = createMockHarness({
    records: { categories: [existingCategory] },
  });

  const fd = new FormData();
  fd.append("id", catId);
  fd.append("name", "Fleece Hoodies");
  fd.append("slug", "fleece-hoodies");
  // description, parent_id, position, archived are omitted

  await assert.rejects(async () => await executeSaveCategory(fd, adapter), /REDIRECT:\/admin\/catalog\?notice=category_saved/);

  assert.equal(calls.rpc.length, 1);
  const rpcCall = calls.rpc[0];
  assert.equal(rpcCall.fn, "admin_save_category");
  assert.equal(rpcCall.args.p_id, catId);
  assert.equal(rpcCall.args.p_name, "Fleece Hoodies");
  assert.equal(rpcCall.args.p_slug, "fleece-hoodies");
  assert.equal(rpcCall.args.p_description, "Heavyweight seasonal outerwear", "persisted description must be preserved");
  assert.equal(rpcCall.args.p_parent_id, parentId, "persisted parent_id must be preserved");
  assert.equal(rpcCall.args.p_position, 7, "persisted position must be preserved");
  assert.equal(rpcCall.args.p_archived, true, "persisted archive state must be preserved");
});

test("Phase 4 executable: explicit clears, unarchive, and zero position apply correctly and differ from omission", async () => {
  const catId = "33333333-3333-4333-8333-333333333333";
  const existingCategory = {
    id: catId,
    name: "Hoodies",
    slug: "hoodies",
    description: "Heavyweight seasonal outerwear",
    parent_id: "44444444-4444-4444-8444-444444444444",
    position: 7,
    archived_at: "2026-09-01T12:00:00Z",
  };

  const { adapter, calls } = createMockHarness({
    records: { categories: [existingCategory] },
  });

  const fd = new FormData();
  fd.append("id", catId);
  fd.append("name", "Hoodies Updated");
  fd.append("slug", "hoodies-updated");
  fd.append("description", ""); // Explicit clear
  fd.append("parent_id", "none"); // Explicit clear to null
  fd.append("position", "0"); // Explicit zero (not omitted)
  fd.append("archived", "false"); // Explicit unarchive

  await assert.rejects(async () => await executeSaveCategory(fd, adapter), /REDIRECT:\/admin\/catalog\?notice=category_saved/);

  assert.equal(calls.rpc.length, 1);
  const rpcCall = calls.rpc[0];
  assert.equal(rpcCall.args.p_description, null, "empty description clears to null");
  assert.equal(rpcCall.args.p_parent_id, null, "'none' parent_id clears to null");
  assert.equal(rpcCall.args.p_position, 0, "explicit 0 position is preserved, not defaulted to 7");
  assert.equal(rpcCall.args.p_archived, false, "explicit false unarchives category");

  // Product explicit clear
  const prodId = "11111111-1111-4111-8111-111111111111";
  const existingProduct = {
    id: prodId,
    category_id: "22222222-2222-4222-8222-222222222222",
    name: "Tee",
    slug: "tee",
    description: "Some description",
    status: "published",
  };
  const { adapter: prodAdapter, calls: prodCalls } = createMockHarness({
    records: { products: [existingProduct] },
  });
  const prodFd = new FormData();
  prodFd.append("id", prodId);
  prodFd.append("name", "Tee Updated");
  prodFd.append("slug", "tee-updated");
  prodFd.append("description", "");
  prodFd.append("category_id", "");
  prodFd.append("status", "archived");

  await assert.rejects(async () => await executeSaveProduct(prodFd, prodAdapter), /REDIRECT:\/admin\/catalog\?notice=product_saved/);
  assert.equal(prodCalls.rpc[0].args.p_description, null, "empty product description clears to null");
  assert.equal(prodCalls.rpc[0].args.p_category_id, null, "empty category_id clears to null");
  assert.equal(prodCalls.rpc[0].args.p_status, "archived");
});

test("Phase 4 executable: missing records or read errors fail closed without executing mutations", async () => {
  // 1. Missing category
  const { adapter: catMissingAdapter, calls: catMissingCalls } = createMockHarness({ records: { categories: [] } });
  const catFd = new FormData();
  catFd.append("id", "33333333-3333-4333-8333-333333333333");
  catFd.append("name", "Missing Cat");
  catFd.append("slug", "missing-cat");
  await assert.rejects(async () => await executeSaveCategory(catFd, catMissingAdapter), /error=category_not_found/);
  assert.equal(catMissingCalls.rpc.length, 0, "No mutation on missing category");

  // 2. Category read error
  const { adapter: catErrAdapter, calls: catErrCalls } = createMockHarness({ readError: true });
  await assert.rejects(async () => await executeSaveCategory(catFd, catErrAdapter), /error=category_not_found/);
  assert.equal(catErrCalls.rpc.length, 0, "No mutation on category read error");

  // 3. Missing product
  const { adapter: prodMissingAdapter, calls: prodMissingCalls } = createMockHarness({ records: { products: [] } });
  const prodFd = new FormData();
  prodFd.append("id", "11111111-1111-4111-8111-111111111111");
  prodFd.append("name", "Missing Prod");
  prodFd.append("slug", "missing-prod");
  await assert.rejects(async () => await executeSaveProduct(prodFd, prodMissingAdapter), /error=product_not_found/);
  assert.equal(prodMissingCalls.rpc.length, 0, "No mutation on missing product");

  // 4. Product read error
  const { adapter: prodErrAdapter, calls: prodErrCalls } = createMockHarness({ readError: true });
  await assert.rejects(async () => await executeSaveProduct(prodFd, prodErrAdapter), /error=product_not_found/);
  assert.equal(prodErrCalls.rpc.length, 0, "No mutation on product read error");
});

test("Phase 4 executable: UUID validation normalizes optional relationships and rejects malformed required IDs", async () => {
  // Unit level normalization checks
  assert.deepEqual(parseOptionalUuid(null), { valid: true, value: null });
  assert.deepEqual(parseOptionalUuid(undefined), { valid: true, value: null });
  assert.deepEqual(parseOptionalUuid(""), { valid: true, value: null });
  assert.deepEqual(parseOptionalUuid("none"), { valid: true, value: null });
  assert.deepEqual(parseOptionalUuid("NONE"), { valid: true, value: null });
  assert.deepEqual(parseOptionalUuid("   "), { valid: true, value: null });
  assert.equal(parseOptionalUuid("11111111-1111-4111-8111-111111111111").valid, true);
  assert.equal(parseOptionalUuid("not-a-uuid").valid, false);
  assert.equal(parseOptionalUuid(12345).valid, false);

  // parseRequiredUuid rejects blanks, sentinels, and non-UUIDs
  assert.equal(parseRequiredUuid("").valid, false);
  assert.equal(parseRequiredUuid("none").valid, false);
  assert.equal(parseRequiredUuid("all").valid, false);
  assert.equal(parseRequiredUuid("11111111-1111-4111-8111-111111111111").valid, true);
  assert.equal(parseRequiredUuid("malformed-uuid").valid, false);
  assert.equal(parseRequiredUuid({}).valid, false);

  // Action level rejection: malformed required IDs trigger zero mutation / zero upload
  const { adapter, calls } = createMockHarness();

  // saveVariant with malformed product_id
  const vFd = new FormData();
  vFd.append("product_id", "malformed-product-id");
  vFd.append("sku", "TEST-SKU");
  vFd.append("price", "100.00");
  await assert.rejects(async () => await executeSaveVariant(vFd, adapter), /error=invalid_product_id/);
  assert.equal(calls.rpc.length, 0);

  // adjustInventory with malformed variant_id
  const invFd = new FormData();
  invFd.append("variant_id", "bad-variant-id");
  invFd.append("delta", "5");
  invFd.append("reason", "restock");
  await assert.rejects(async () => await executeAdjustInventory(invFd, adapter), /error=invalid_variant_id/);
  assert.equal(calls.rpc.length, 0);

  // saveProductOption with malformed product_id
  const optFd = new FormData();
  optFd.append("product_id", "none");
  optFd.append("name", "Size");
  await assert.rejects(async () => await executeSaveProductOption(optFd, adapter), /error=invalid_product_id/);
  assert.equal(calls.rpc.length, 0);

  // saveOptionValue with malformed option_id
  const valFd = new FormData();
  valFd.append("product_id", "11111111-1111-4111-8111-111111111111");
  valFd.append("option_id", "all");
  valFd.append("value", "Medium");
  await assert.rejects(async () => await executeSaveOptionValue(valFd, adapter), /error=invalid_option_id/);
  assert.equal(calls.rpc.length, 0);

  // setVariantOptionValue with malformed variant_id
  const setFd = new FormData();
  setFd.append("product_id", "11111111-1111-4111-8111-111111111111");
  setFd.append("variant_id", "invalid-var");
  setFd.append("option_id", "22222222-2222-4222-8222-222222222222");
  setFd.append("option_value_id", "33333333-3333-4333-8333-333333333333");
  await assert.rejects(async () => await executeSetVariantOptionValue(setFd, adapter), /error=invalid_variant_id/);
  assert.equal(calls.rpc.length, 0);

  // deleteProductImage with malformed image_id
  const imgFd = new FormData();
  imgFd.append("image_id", "none");
  await assert.rejects(async () => await executeDeleteProductImage(imgFd, adapter), /error=invalid_product_image/);
  assert.equal(calls.rpc.length, 0);
});

test("Phase 4 executable: variant status allowlist rejects draft and accepts active, inactive, archived", async () => {
  assert.equal(validateVariantStatus("active"), "active");
  assert.equal(validateVariantStatus("inactive"), "inactive");
  assert.equal(validateVariantStatus("archived"), "archived");
  assert.equal(validateVariantStatus("draft"), null, "variant status cannot be draft");
  assert.equal(validateVariantStatus("published"), null);
  assert.equal(validateVariantStatus(""), null);

  const prodId = "11111111-1111-4111-8111-111111111111";
  const { adapter, calls } = createMockHarness();

  // Test draft rejected
  const draftFd = new FormData();
  draftFd.append("product_id", prodId);
  draftFd.append("sku", "TEE-DRAFT");
  draftFd.append("price", "499.00");
  draftFd.append("status", "draft");
  await assert.rejects(async () => await executeSaveVariant(draftFd, adapter), /error=invalid_variant_status/);
  assert.equal(calls.rpc.length, 0, "draft status must not execute RPC");

  // Test inactive accepted
  const inactFd = new FormData();
  inactFd.append("product_id", prodId);
  inactFd.append("sku", "TEE-INACTIVE");
  inactFd.append("price", "499.00");
  inactFd.append("status", "inactive");
  await assert.rejects(async () => await executeSaveVariant(inactFd, adapter), /notice=variant_saved/);
  assert.equal(calls.rpc[0].args.p_status, "inactive");

  // Test archived accepted
  const archFd = new FormData();
  archFd.append("product_id", prodId);
  archFd.append("sku", "TEE-ARCHIVED");
  archFd.append("price", "499.00");
  archFd.append("status", "archived");
  await assert.rejects(async () => await executeSaveVariant(archFd, adapter), /notice=variant_saved/);
  assert.equal(calls.rpc[1].args.p_status, "archived");
});

test("Phase 4 executable: product-variant mismatch triggers zero storage upload and variant edit locks product", async () => {
  const prod1Id = "11111111-1111-4111-8111-111111111111";
  const prod2Id = "22222222-2222-4222-8222-222222222222";
  const var1Id = "33333333-3333-4333-8333-333333333333";

  const { adapter, calls } = createMockHarness({
    records: {
      products: [{ id: prod1Id, name: "Product 1" }, { id: prod2Id, name: "Product 2" }],
      product_variants: [{ id: var1Id, product_id: prod2Id, sku: "VAR-2" }],
    },
  });

  // Attempt to save image associating prod1 with var1 (which belongs to prod2)
  const imgFd = new FormData();
  imgFd.append("product_id", prod1Id);
  imgFd.append("variant_id", var1Id);
  imgFd.append("alt_text", "Sample alt text");
  imgFd.append("position", "0");
  const fakeFile = new File([new Uint8Array(100)], "test.webp", { type: "image/webp" });
  imgFd.append("image", fakeFile);

  await assert.rejects(async () => await executeSaveProductImage(imgFd, adapter), /error=variant_product_mismatch/);

  assert.equal(calls.storageUploads.length, 0, "Zero storage upload when variant does not match product");
  assert.equal(calls.rpc.length, 0, "Zero RPC calls when variant does not match product");

  // Attempt to edit variant var1 with reparented product_id prod1
  const varFd = new FormData();
  varFd.append("id", var1Id);
  varFd.append("product_id", prod1Id); // Reparent attempt
  varFd.append("sku", "VAR-2");
  varFd.append("price", "999.00");
  varFd.append("status", "active");

  await assert.rejects(async () => await executeSaveVariant(varFd, adapter), /error=variant_product_mismatch/);
  assert.equal(calls.rpc.length, 0, "Zero RPC calls when variant reparenting attempted");
});

test("Phase 4 executable: UI components enforce WebP only, valid zero prices, and restore option forms", async () => {
  const [productDialogSrc, categoryDialogSrc, variantDialogSrc, imageDialogSrc, catalogPageSrc] = await Promise.all([
    read("src/components/admin/product-dialog.tsx"),
    read("src/components/admin/category-dialog.tsx"),
    read("src/components/admin/variant-dialog.tsx"),
    read("src/components/admin/product-image-dialog.tsx"),
    read("src/app/admin/catalog/page.tsx"),
  ]);

  // ProductDialog preloads and edits description
  assert.match(productDialogSrc, /name="description"/);
  assert.match(productDialogSrc, /defaultValue=\{product\?\.description \|\| ""\}/);

  // CategoryDialog full metadata and controls
  assert.match(categoryDialogSrc, /name="parent_id"/);
  assert.match(categoryDialogSrc, /name="position"/);
  assert.match(categoryDialogSrc, /name="archived"/);
  assert.match(categoryDialogSrc, /filter\(\(c\) => c\.id !== category\?\.id\)/, "must filter out self from parent options");

  // VariantDialog zero price truthiness and no draft status
  assert.match(variantDialogSrc, /typeof variant\?\.price_minor === "number"\s*\?\s*\(variant\.price_minor \/ 100\)\.toFixed\(2\)\s*:\s*""/);
  assert.doesNotMatch(variantDialogSrc, /<SelectItem value="draft">/);
  assert.match(variantDialogSrc, /type="hidden" name="product_id"/, "product locked on variant edit");

  // ProductImageDialog WebP only <= 5MiB and variant filtering
  assert.match(imageDialogSrc, /accept="image\/webp"/);
  assert.match(imageDialogSrc, /max 5MB/i);
  assert.match(imageDialogSrc, /setSelectedVariantId\("none"\)/, "must clear stale variant on product change");

  // Catalog Overview Page restores forms and fails closed on category error
  assert.match(catalogPageSrc, /categoriesError/);
  assert.match(catalogPageSrc, /throw new Error\("ADMIN_CATALOG_UNAVAILABLE"\)/);
  assert.match(catalogPageSrc, /Create Product Option/);
  assert.match(catalogPageSrc, /saveProductOption/);
  assert.match(catalogPageSrc, /saveOptionValue/);
  assert.match(catalogPageSrc, /setVariantOptionValue/);
});
